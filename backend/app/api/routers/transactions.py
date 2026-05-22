from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from prisma import Json
from pydantic import BaseModel, Field

from db import prisma
from routers.auth import SESSION_COOKIE_NAME, _ensure_db_connection, _get_user_by_session_token, _now

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])


async def _require_authenticated_user(request: Request):
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    result = await _get_user_by_session_token(raw, request.headers.get("user-agent"))
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user, session = result
    await prisma.session.update(where={"id": session.id}, data={"last_seen_at": _now()})
    return user


def _dec_to_str(value: Decimal | None) -> str | None:
    return str(value) if value is not None else None


def _participants_from_tx(tx) -> dict[str, str]:
    candidate = tx.selected_candidate
    if not candidate:
        raise HTTPException(400, "Transaction has no selected candidate")
    if not candidate.inventory_entry or not candidate.inventory_entry.factory_profile:
        raise HTTPException(400, "Factory participant missing")
    if not candidate.logistic_offer or not candidate.logistic_offer.logist_profile:
        raise HTTPException(400, "Logistics participant missing")
    if not tx.request or not tx.request.customer_profile:
        raise HTTPException(400, "Customer participant missing")

    return {
        "CUSTOMER": tx.request.customer_profile.user_id,
        "FACTORY": candidate.inventory_entry.factory_profile.user_id,
        "LOGIST": candidate.logistic_offer.logist_profile.user_id,
    }


async def _load_tx_with_context(transaction_id: str):
    tx = await prisma.transaction.find_first(
        where={"id": transaction_id, "deleted_at": None},
        include={
            "request": {"include": {"customer_profile": True}},
            "selected_candidate": {
                "include": {
                    "inventory_entry": {"include": {"factory_profile": True, "item": True}},
                    "logistic_offer": {"include": {"logist_profile": True}},
                    "currency": True,
                }
            },
            "contract_packet": True,
            "signatures": {"include": {"user": True}},
            "payments": True,
        },
    )
    if not tx:
        raise HTTPException(404, "Transaction not found")
    return tx


async def _ensure_contract_setup(tx, user_agent: str | None):
    participants = _participants_from_tx(tx)
    candidate = tx.selected_candidate

    if not tx.contract_packet:
        terms_payload: dict[str, Any] = {
            "request_id": tx.request_id,
            "candidate_id": candidate.id,
            "item": candidate.inventory_entry.item.name if candidate.inventory_entry and candidate.inventory_entry.item else None,
            "quoted_quantity": _dec_to_str(candidate.quoted_quantity),
            "goods_cost": _dec_to_str(candidate.inventory_entry.price_per_unit * candidate.quoted_quantity)
            if candidate.inventory_entry and candidate.quoted_quantity is not None
            else None,
            "delivery_price": _dec_to_str(candidate.delivery_price),
            "total_cost": _dec_to_str(candidate.total_cost),
            "currency_code": candidate.currency_code,
            "delivery_days": candidate.delivery_days,
            "payment_terms": "Full payment before fulfillment start",
        }
        await prisma.contractpacket.create(
            data={
                "transaction": {"connect": {"id": tx.id}},
                "version": 1,
                "document_hash": f"tx-{tx.id}-v1",
                "terms_json": Json(terms_payload),
            }
        )
        await prisma.eventlog.create(
            data={
                "transaction": {"connect": {"id": tx.id}},
                "entity_type": "TRANSACTION",
                "entity_id": tx.id,
                "event_type": "contract.ready",
                "payload_json": Json({"version": 1, "user_agent": user_agent}),
            }
        )

    existing = await prisma.signature.find_many(
        where={"transaction_id": tx.id},
        take=10,
    )
    existing_user_ids = {row.user_id for row in existing}
    for role, participant_user_id in participants.items():
        if participant_user_id in existing_user_ids:
            continue
        await prisma.signature.create(
            data={
                "transaction": {"connect": {"id": tx.id}},
                "user": {"connect": {"id": participant_user_id}},
                "role_at_signing": role,
                "status": "PENDING",
            }
        )


def _serialize_transaction(tx, current_user_id: str) -> dict[str, Any]:
    participants = _participants_from_tx(tx)
    my_role = next((role for role, user_id in participants.items() if user_id == current_user_id), None)
    if not my_role:
        raise HTTPException(403, "Forbidden")

    signature_by_role = {role: "PENDING" for role in ("CUSTOMER", "FACTORY", "LOGIST")}
    for sig in tx.signatures:
        signature_by_role[sig.role_at_signing] = sig.status

    sorted_payments = sorted(
        tx.payments or [],
        key=lambda payment: payment.created_at,
        reverse=True,
    )
    paid = any(payment.status == "CAPTURED" for payment in sorted_payments)
    latest_payment = sorted_payments[0] if sorted_payments else None
    candidate = tx.selected_candidate
    factory_profile = (
        candidate.inventory_entry.factory_profile
        if candidate and candidate.inventory_entry and candidate.inventory_entry.factory_profile
        else None
    )
    logist_profile = (
        candidate.logistic_offer.logist_profile
        if candidate and candidate.logistic_offer and candidate.logistic_offer.logist_profile
        else None
    )
    customer_profile = tx.request.customer_profile if tx.request and tx.request.customer_profile else None
    contract_terms = tx.contract_packet.terms_json if tx.contract_packet and isinstance(tx.contract_packet.terms_json, dict) else {}

    return {
        "id": tx.id,
        "request_id": tx.request_id,
        "status": tx.status,
        "my_role": my_role,
        "item_name": (
            candidate.inventory_entry.item.name
            if candidate and candidate.inventory_entry and candidate.inventory_entry.item
            else None
        ),
        "currency_code": candidate.currency_code if candidate else None,
        "total_cost": _dec_to_str(candidate.total_cost) if candidate else None,
        "delivery_days": candidate.delivery_days if candidate else None,
        "contract_version": tx.contract_packet.version if tx.contract_packet else None,
        "signature_status": signature_by_role,
        "payment_status": latest_payment.status if latest_payment else ("CAPTURED" if paid else "PENDING"),
        "payment_amount": _dec_to_str(latest_payment.amount) if latest_payment else None,
        "can_sign": tx.status in ("CONTRACT_DRAFTED", "CONTRACT_SIGNING")
        and signature_by_role[my_role] != "SIGNED",
        "can_pay": my_role == "CUSTOMER" and tx.status == "FULLY_SIGNED",
        "can_start_fulfillment": my_role == "FACTORY" and tx.status == "PAYMENT_CONFIRMED",
        "can_mark_in_progress": my_role == "LOGIST" and tx.status == "FULFILLMENT_STARTED",
        "can_accept_completion": my_role == "CUSTOMER" and tx.status == "IN_PROGRESS",
        "contract_reference": tx.id,
        "contract_date": tx.created_at.isoformat(),
        "factory_legal_name": factory_profile.legal_name if factory_profile else None,
        "client_legal_name": customer_profile.display_name if customer_profile else None,
        "logist_legal_name": logist_profile.company_name if logist_profile else None,
        "match_candidate_id": candidate.id if candidate else None,
        "inventory_entry_id": candidate.inventory_entry_id if candidate else None,
        "logistic_offer_id": candidate.logistic_offer_id if candidate else None,
        "candidate_status": candidate.status if candidate else None,
        "request_status": tx.request.status if tx.request else None,
        "quoted_quantity": _dec_to_str(candidate.quoted_quantity) if candidate else None,
        "factory_note": candidate.factory_note if candidate else None,
        "delivery_price": _dec_to_str(candidate.delivery_price) if candidate else None,
        "reliability_score": candidate.reliability_score if candidate else None,
        "fitness_score": candidate.fitness_score if candidate else None,
        "candidate_created_at": candidate.created_at.isoformat() if candidate else None,
        "candidate_updated_at": candidate.updated_at.isoformat() if candidate else None,
        "candidate_deleted_at": candidate.deleted_at.isoformat() if candidate and candidate.deleted_at else None,
        "goods_cost": contract_terms.get("goods_cost") if isinstance(contract_terms, dict) else None,
        "payment_terms": contract_terms.get("payment_terms") if isinstance(contract_terms, dict) else None,
        "created_at": tx.created_at.isoformat(),
        "updated_at": tx.updated_at.isoformat(),
    }


@router.get("/mine")
async def list_my_transactions(request: Request, user=Depends(_require_authenticated_user)):
    txs = await prisma.transaction.find_many(
        where={"deleted_at": None},
        include={
            "request": {"include": {"customer_profile": True}},
            "selected_candidate": {
                "include": {
                    "inventory_entry": {"include": {"factory_profile": True, "item": True}},
                    "logistic_offer": {"include": {"logist_profile": True}},
                    "currency": True,
                }
            },
            "contract_packet": True,
            "signatures": True,
            "payments": True,
        },
        order={"updated_at": "desc"},
        take=200,
    )

    visible = []
    for tx in txs:
        try:
            participants = _participants_from_tx(tx)
        except HTTPException:
            continue
        if user.id not in participants.values():
            continue
        await _ensure_contract_setup(tx, request.headers.get("user-agent"))
        refreshed_tx = await _load_tx_with_context(tx.id)
        visible.append(_serialize_transaction(refreshed_tx, user.id))
    return visible


class SignContractBody(BaseModel):
    signer_name: str | None = Field(default=None, max_length=120)
    jurisdiction: str | None = Field(default=None, max_length=120)
    negotiation_days: int | None = Field(default=None, ge=1)
    dispute_window_days: int | None = Field(default=None, ge=1)
    contract_date: str | None = Field(default=None, max_length=40)
    rendered_contract_text: str | None = Field(default=None, max_length=30000)


@router.post("/{transaction_id}/sign")
async def sign_contract(
    transaction_id: str,
    request: Request,
    payload: SignContractBody,
    user=Depends(_require_authenticated_user),
):
    tx = await _load_tx_with_context(transaction_id)
    participants = _participants_from_tx(tx)
    my_role = next((role for role, user_id in participants.items() if user_id == user.id), None)
    if not my_role:
        raise HTTPException(403, "Forbidden")

    if tx.status not in ("CONTRACT_DRAFTED", "CONTRACT_SIGNING"):
        raise HTTPException(400, f"Cannot sign in status '{tx.status}'")

    await _ensure_contract_setup(tx, request.headers.get("user-agent"))
    tx = await _load_tx_with_context(transaction_id)

    if tx.contract_packet and isinstance(tx.contract_packet.terms_json, dict):
        current_terms = dict(tx.contract_packet.terms_json)
        signing_snapshots = current_terms.get("signing_snapshots")
        if not isinstance(signing_snapshots, list):
            signing_snapshots = []
        signing_snapshots.append(
            {
                "signer_user_id": user.id,
                "signer_role": my_role,
                "signer_name": payload.signer_name,
                "jurisdiction": payload.jurisdiction,
                "negotiation_days": payload.negotiation_days,
                "dispute_window_days": payload.dispute_window_days,
                "contract_date": payload.contract_date,
                "rendered_contract_text": payload.rendered_contract_text,
                "signed_at": _now().isoformat(),
            }
        )
        current_terms["signing_snapshots"] = signing_snapshots

        await prisma.contractpacket.update(
            where={"id": tx.contract_packet.id},
            data={
                "terms_json": Json(current_terms),
                "document_hash": f"tx-{tx.id}-v{tx.contract_packet.version}-signed-{len(signing_snapshots)}",
            },
        )

    signature = await prisma.signature.find_first(
        where={"transaction_id": tx.id, "user_id": user.id}
    )
    if not signature:
        raise HTTPException(400, "Signature slot not found")

    if signature.status != "SIGNED":
        await prisma.signature.update(
            where={"id": signature.id},
            data={
                "status": "SIGNED",
                "signed_at": _now(),
                "ip_address": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
            },
        )
        await prisma.eventlog.create(
            data={
                "actor_user": {"connect": {"id": user.id}},
                "transaction": {"connect": {"id": tx.id}},
                "entity_type": "SIGNATURE",
                "entity_id": signature.id,
                "event_type": "signature.recorded",
                "payload_json": Json({"role": my_role}),
            }
        )

    all_signatures = await prisma.signature.find_many(where={"transaction_id": tx.id}, take=10)
    all_signed = len(all_signatures) >= 3 and all(row.status == "SIGNED" for row in all_signatures)

    next_status = "FULLY_SIGNED" if all_signed else "CONTRACT_SIGNING"
    await prisma.transaction.update(where={"id": tx.id}, data={"status": next_status})
    await prisma.request.update(where={"id": tx.request_id}, data={"status": next_status})

    if all_signed:
        await prisma.eventlog.create(
            data={
                "transaction": {"connect": {"id": tx.id}},
                "entity_type": "TRANSACTION",
                "entity_id": tx.id,
                "event_type": "contract.fully_signed",
                "payload_json": Json({"status": next_status}),
            }
        )

    return {"status": "success", "transaction_status": next_status}


class CapturePaymentBody(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    provider_reference: str | None = Field(default=None, max_length=120)


@router.post("/{transaction_id}/payments/capture")
async def capture_payment(
    transaction_id: str,
    payload: CapturePaymentBody,
    user=Depends(_require_authenticated_user),
):
    tx = await _load_tx_with_context(transaction_id)
    participants = _participants_from_tx(tx)
    if participants.get("CUSTOMER") != user.id:
        raise HTTPException(403, "Only customer can capture payment")
    if tx.status != "FULLY_SIGNED":
        raise HTTPException(400, f"Cannot capture payment in status '{tx.status}'")

    candidate = tx.selected_candidate
    if not candidate or candidate.total_cost is None:
        raise HTTPException(400, "Missing transaction amount")

    payment_amount = Decimal(str(payload.amount)) if payload.amount is not None else candidate.total_cost

    payment = await prisma.payment.create(
        data={
            "transaction": {"connect": {"id": tx.id}},
            "amount": payment_amount,
            "currency": {"connect": {"code": candidate.currency_code}},
            "status": "CAPTURED",
            "provider_reference": payload.provider_reference,
            "paid_at": _now(),
        }
    )

    await prisma.transaction.update(where={"id": tx.id}, data={"status": "PAYMENT_CONFIRMED"})
    await prisma.request.update(where={"id": tx.request_id}, data={"status": "PAYMENT_CONFIRMED"})
    await prisma.eventlog.create(
        data={
            "actor_user": {"connect": {"id": user.id}},
            "transaction": {"connect": {"id": tx.id}},
            "entity_type": "PAYMENT",
            "entity_id": payment.id,
            "event_type": "payment.status_changed",
            "payload_json": Json({"status": "CAPTURED", "amount": str(payment_amount)}),
        }
    )

    return {"status": "success", "transaction_status": "PAYMENT_CONFIRMED"}


class FulfillmentAdvanceBody(BaseModel):
    action: str = Field(..., pattern="^(START|MARK_IN_PROGRESS)$")


@router.post("/{transaction_id}/fulfillment/advance")
async def advance_fulfillment(
    transaction_id: str,
    payload: FulfillmentAdvanceBody,
    user=Depends(_require_authenticated_user),
):
    tx = await _load_tx_with_context(transaction_id)
    participants = _participants_from_tx(tx)
    is_factory_actor = user.id == participants.get("FACTORY")
    is_logist_actor = user.id == participants.get("LOGIST")
    if not (is_factory_actor or is_logist_actor):
        raise HTTPException(403, "Only factory/logistics can advance fulfillment")

    if payload.action == "START":
        if not is_factory_actor:
            raise HTTPException(403, "Only factory can hand over to logistics")
        if tx.status != "PAYMENT_CONFIRMED":
            raise HTTPException(400, f"Cannot start fulfillment in status '{tx.status}'")
        next_status = "FULFILLMENT_STARTED"
        event_type = "fulfillment.started"
    else:
        if not is_logist_actor:
            raise HTTPException(403, "Only logistics can mark delivery completion")
        if tx.status != "FULFILLMENT_STARTED":
            raise HTTPException(400, f"Cannot mark in progress in status '{tx.status}'")
        next_status = "IN_PROGRESS"
        event_type = "fulfillment.updated"

    await prisma.transaction.update(where={"id": tx.id}, data={"status": next_status})
    await prisma.request.update(where={"id": tx.request_id}, data={"status": next_status})
    await prisma.eventlog.create(
        data={
            "actor_user": {"connect": {"id": user.id}},
            "transaction": {"connect": {"id": tx.id}},
            "entity_type": "TRANSACTION",
            "entity_id": tx.id,
            "event_type": event_type,
            "payload_json": Json({"action": payload.action, "status": next_status}),
        }
    )

    return {"status": "success", "transaction_status": next_status}


@router.post("/{transaction_id}/accept-completion")
async def accept_completion(transaction_id: str, user=Depends(_require_authenticated_user)):
    tx = await _load_tx_with_context(transaction_id)
    participants = _participants_from_tx(tx)
    if participants.get("CUSTOMER") != user.id:
        raise HTTPException(403, "Only customer can accept completion")
    if tx.status != "IN_PROGRESS":
        raise HTTPException(400, f"Cannot accept completion in status '{tx.status}'")

    await prisma.transaction.update(where={"id": tx.id}, data={"status": "COMPLETED"})
    await prisma.request.update(where={"id": tx.request_id}, data={"status": "COMPLETED"})
    await prisma.eventlog.create(
        data={
            "actor_user": {"connect": {"id": user.id}},
            "transaction": {"connect": {"id": tx.id}},
            "entity_type": "TRANSACTION",
            "entity_id": tx.id,
            "event_type": "fulfillment.updated",
            "payload_json": Json({"action": "ACCEPT_COMPLETION", "status": "COMPLETED"}),
        }
    )

    return {"status": "success", "transaction_status": "COMPLETED"}