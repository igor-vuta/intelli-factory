"""
Pairing / matching workflow endpoints.

Status flow
-----------
PENDING  ─► factory creates a factory bid (MatchCandidate with no logist)
         ─► Request.status → PAIRING_IN_PROGRESS
PAIRING_IN_PROGRESS ─► logist attaches a delivery quote to a factory bid
                     ─► MatchCandidate gains logistic_offer_id, delivery_price, total_cost
PAIRING_IN_PROGRESS ─► customer selects one complete candidate
                     ─► Transaction created, Request.status → MATCHED, candidate → ACCEPTED,
                        others → REJECTED
"""

from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from prisma import Json
from pydantic import BaseModel, Field

from db import prisma
from routers.auth import SESSION_COOKIE_NAME, _ensure_db_connection, _get_user_by_session_token, _now
from services.optimization_engine import OptimizationEngine

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])


# ── Auth helpers ─────────────────────────────────────────────────────────────

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


def _require_role(*roles: str):
    async def dep(user=Depends(_require_authenticated_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' cannot access this endpoint",
            )
        return user
    return dep


def _to_dec(value: float) -> Decimal:
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise HTTPException(422, "Invalid decimal value") from exc


def _address_label(address) -> str | None:
    if not address:
        return None
    city = getattr(getattr(address, "city", None), "default_name", None)
    region = getattr(getattr(address, "region", None), "default_name", None)
    country = getattr(getattr(address, "country", None), "default_name", None)
    parts = [address.street, city, region, country]
    return ", ".join([part for part in parts if part]) or None


# ── Serializers ──────────────────────────────────────────────────────────────

def _serialize_request(row) -> dict[str, Any]:
    quantity_unit = (
        row.item.unit
        if row.item and row.item.unit
        else str((row.requested_characteristics_json or {}).get("quantity_unit") or "pcs")
    )
    return {
        "id": row.id,
        "category_id": row.category_id,
        "category_name": row.category.default_name if row.category else None,
        "item_id": row.item_id,
        "item_name": row.item.name if row.item else None,
        "requested_name_text": row.requested_name_text,
        "quantity": str(row.quantity),
        "quantity_unit": quantity_unit,
        "preferred_currency_code": row.preferred_currency_code,
        "destination_address_id": row.destination_address_id,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
    }


def _serialize_candidate(c) -> dict[str, Any]:
    inv = c.inventory_entry
    item = inv.item if inv else None
    factory = inv.factory_profile if inv else None
    logist_offer = c.logistic_offer
    request_row = getattr(c, "request", None)
    source_address = getattr(inv, "stock_address", None) if inv else None
    destination_address = getattr(request_row, "destination_address", None) if request_row else None

    return {
        "id": c.id,
        "request_id": c.request_id,
        "request_status": request_row.status if request_row else None,
        "status": c.status,
        "quoted_quantity": str(c.quoted_quantity) if c.quoted_quantity is not None else None,
        "quantity_unit": item.unit if item and item.unit else "pcs",
        "factory_note": c.factory_note,
        "currency_code": c.currency_code,
        # Factory
        "inventory_entry_id": c.inventory_entry_id,
        "item_name": item.name if item else None,
        "inventory_price_per_unit": str(inv.price_per_unit) if inv else None,
        "factory_legal_name": factory.legal_name if factory else None,
        "source_address_label": _address_label(source_address),
        "destination_address_label": _address_label(destination_address),
        # Logistics
        "logistic_offer_id": c.logistic_offer_id,
        "logistic_title": logist_offer.title if logist_offer else None,
        "delivery_price": str(c.delivery_price) if c.delivery_price is not None else None,
        "delivery_days": c.delivery_days,
        # Combined
        "total_cost": str(c.total_cost) if c.total_cost is not None else None,
        "reliability_score": c.reliability_score,
        "fitness_score": c.fitness_score,
        "created_at": c.created_at.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════
#  FACTORY  – see open requests and place bids
# ═══════════════════════════════════════════════════════════════════════

@router.get("/open-requests")
async def get_open_requests(user=Depends(_require_role("FACTORY"))):
    """Open requests visible to factories (initially PENDING, then PAIRING_IN_PROGRESS)."""
    rows = await prisma.request.find_many(
        where={"status": {"in": ["PENDING", "PAIRING_IN_PROGRESS"]}, "deleted_at": None},
        include={"item": True, "category": True},
        order={"created_at": "desc"},
        take=100,
    )
    return [_serialize_request(r) for r in rows]


class FactoryBidBody(BaseModel):
    request_id: str
    inventory_entry_id: str
    quoted_quantity: float = Field(..., gt=0)
    factory_note: str | None = Field(default=None, max_length=500)


@router.post("/factory-bids", status_code=201)
async def create_factory_bid(payload: FactoryBidBody, user=Depends(_require_role("FACTORY"))):
    """Factory responds to a PENDING request by creating a factory bid."""
    factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        raise HTTPException(400, "Factory profile not found")

    # Validate request
    req = await prisma.request.find_first(
        where={"id": payload.request_id, "deleted_at": None}
    )
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status not in ("PENDING", "PAIRING_IN_PROGRESS"):
        raise HTTPException(400, f"Cannot bid on request in status '{req.status}'")

    # Validate inventory entry belongs to this factory
    inv = await prisma.inventoryentry.find_first(
        where={
            "id": payload.inventory_entry_id,
            "factory_profile_id": factory_profile.id,
            "deleted_at": None,
        }
    )
    if not inv:
        raise HTTPException(404, "Inventory entry not found or not yours")

    # Prevent duplicate bids from same factory on same request using same inventory
    existing = await prisma.matchcandidate.find_first(
        where={
            "request_id": payload.request_id,
            "inventory_entry_id": payload.inventory_entry_id,
            "deleted_at": None,
        }
    )
    if existing:
        raise HTTPException(409, "You already placed a bid on this request with this inventory entry")

    candidate = await prisma.matchcandidate.create(
        data={
            "request": {"connect": {"id": payload.request_id}},
            "inventory_entry": {"connect": {"id": payload.inventory_entry_id}},
            "currency": {"connect": {"code": inv.currency_code}},
            "quoted_quantity": _to_dec(payload.quoted_quantity),
            "factory_note": payload.factory_note,
            "status": "PENDING",
        }
    )

    # Advance request to PAIRING_IN_PROGRESS
    if req.status == "PENDING":
        await prisma.request.update(
            where={"id": payload.request_id},
            data={"status": "PAIRING_IN_PROGRESS"},
        )

    return {"status": "success", "candidate_id": candidate.id}


@router.get("/factory-bids/mine")
async def list_my_factory_bids(user=Depends(_require_role("FACTORY"))):
    """All factory bids placed by the current factory (including complete proposals)."""
    factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        return []

    # Get all inventory entry ids belonging to this factory
    inv_rows = await prisma.inventoryentry.find_many(
        where={"factory_profile_id": factory_profile.id, "deleted_at": None},
        take=200,
    )
    inv_ids = [i.id for i in inv_rows]
    if not inv_ids:
        return []

    candidates = await prisma.matchcandidate.find_many(
        where={"inventory_entry_id": {"in": inv_ids}, "deleted_at": None},
        include={
            "request": {
                "include": {
                    "item": True,
                    "category": True,
                    "destination_address": {
                        "include": {"city": True, "region": True, "country": True}
                    },
                }
            },
            "inventory_entry": {
                "include": {
                    "item": True,
                    "factory_profile": True,
                    "stock_address": {
                        "include": {"city": True, "region": True, "country": True}
                    },
                }
            },
            "logistic_offer": True,
        },
        order={"created_at": "desc"},
        take=200,
    )
    return [_serialize_candidate(c) for c in candidates]


# ═══════════════════════════════════════════════════════════════════════
#  LOGIST  – see factory bids and attach logistics quotes
# ═══════════════════════════════════════════════════════════════════════

@router.get("/factory-bids-needing-logistics")
async def get_factory_bids_needing_logistics(user=Depends(_require_role("LOGIST"))):
    """
    Returns all incomplete MatchCandidates (factory bid only, no logist yet)
    across all PAIRING_IN_PROGRESS requests.
    """
    logist_profile = await prisma.logistprofile.find_unique(where={"user_id": user.id})
    if not logist_profile:
        raise HTTPException(400, "Logistics profile not found")

    candidates = await prisma.matchcandidate.find_many(
        where={"logistic_offer_id": None, "deleted_at": None, "status": "PENDING"},
        include={
            "request": {
                "include": {
                    "item": True,
                    "category": True,
                    "destination_address": {
                        "include": {"city": True, "region": True, "country": True}
                    },
                }
            },
            "inventory_entry": {
                "include": {
                    "item": True,
                    "factory_profile": True,
                    "stock_address": {
                        "include": {"city": True, "region": True, "country": True}
                    },
                }
            },
            "logistic_offer": True,
        },
        order={"created_at": "desc"},
        take=200,
    )

    # Keep factory-only bids visible and mark whether this logist already quoted that pair.
    quoted_pairs = await prisma.matchcandidate.find_many(
        where={"logistic_offer_id": {"not": None}, "deleted_at": None},
        include={"logistic_offer": True},
        take=500,
    )
    quoted_keys = {
        (row.request_id, row.inventory_entry_id)
        for row in quoted_pairs
        if row.logistic_offer
        and row.logistic_offer.deleted_at is None
        and row.logistic_offer.logist_profile_id == logist_profile.id
    }

    enriched: list[dict[str, Any]] = []
    for c in candidates:
        serialized = _serialize_candidate(c)
        serialized["has_my_quote"] = (c.request_id, c.inventory_entry_id) in quoted_keys
        enriched.append(serialized)
    return enriched


class LogistQuoteBody(BaseModel):
    factory_bid_id: str          # id of the MatchCandidate (factory-only bid)
    title: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    base_price: float = Field(..., ge=0)
    price_per_km: float | None = Field(default=None, ge=0)
    price_per_kg: float | None = Field(default=None, ge=0)
    estimated_days_min: int | None = Field(default=None, ge=0)
    estimated_days_max: int | None = Field(default=None, ge=0)
    reliability_score: float = Field(..., ge=0, le=1)
    currency_code: str = Field(..., min_length=3, max_length=3)
    delivery_price: float = Field(..., ge=0)
    delivery_days: int = Field(..., gt=0)


@router.post("/logist-quotes", status_code=201)
async def create_logist_quote(payload: LogistQuoteBody, user=Depends(_require_role("LOGIST"))):
    """
    Logist attaches a delivery quote to an existing factory bid.
    For each factory bid × logistic offer combination, a separate complete
    MatchCandidate is created (or the existing incomplete one is promoted).
    """
    logist_profile = await prisma.logistprofile.find_unique(where={"user_id": user.id})
    if not logist_profile:
        raise HTTPException(400, "Logistics profile not found")

    # Load the factory-only bid
    factory_bid = await prisma.matchcandidate.find_first(
        where={"id": payload.factory_bid_id, "deleted_at": None, "logistic_offer_id": None},
        include={"inventory_entry": True, "request": True},
    )
    if not factory_bid:
        raise HTTPException(404, "Factory bid not found or already has a logistics quote")

    if (
        payload.estimated_days_min is not None
        and payload.estimated_days_max is not None
        and payload.estimated_days_min > payload.estimated_days_max
    ):
        raise HTTPException(422, "estimated_days_min cannot be greater than estimated_days_max")

    currency_code = payload.currency_code.upper()
    currency = await prisma.currency.find_unique(where={"code": currency_code})
    if not currency:
        raise HTTPException(404, "Currency not found")

    existing_offer = await prisma.logisticoffer.find_first(
        where={"logist_profile_id": logist_profile.id, "deleted_at": None},
        order={"updated_at": "desc"},
    )

    offer_data: dict[str, Any] = {
        "title": payload.title,
        "base_price": _to_dec(payload.base_price),
        "reliability_score": payload.reliability_score,
        "currency": {"connect": {"code": currency_code}},
        "status": "ACTIVE",
        "deleted_at": None,
    }
    if payload.description is not None:
        offer_data["description"] = payload.description
    if payload.price_per_km is not None:
        offer_data["price_per_km"] = _to_dec(payload.price_per_km)
    if payload.price_per_kg is not None:
        offer_data["price_per_kg"] = _to_dec(payload.price_per_kg)
    if payload.estimated_days_min is not None:
        offer_data["estimated_days_min"] = payload.estimated_days_min
    if payload.estimated_days_max is not None:
        offer_data["estimated_days_max"] = payload.estimated_days_max

    if existing_offer:
        logist_offer = await prisma.logisticoffer.update(
            where={"id": existing_offer.id},
            data=offer_data,
        )
    else:
        create_offer_data = {
            **offer_data,
            "logist_profile": {"connect": {"id": logist_profile.id}},
        }
        logist_offer = await prisma.logisticoffer.create(data=create_offer_data)

    # Check for duplicate: same factory bid + same logist offer
    duplicate = await prisma.matchcandidate.find_first(
        where={
            "request_id": factory_bid.request_id,
            "inventory_entry_id": factory_bid.inventory_entry_id,
            "logistic_offer_id": logist_offer.id,
            "deleted_at": None,
        }
    )
    inv = factory_bid.inventory_entry
    quoted_qty = factory_bid.quoted_quantity or inv.quantity_available
    goods_cost = inv.price_per_unit * quoted_qty
    delivery_cost = _to_dec(payload.delivery_price)
    total = goods_cost + delivery_cost

    reliability = logist_offer.reliability_score

    if duplicate:
        updated_candidate = await prisma.matchcandidate.update(
            where={"id": duplicate.id},
            data={
                "delivery_price": delivery_cost,
                "total_cost": total,
                "delivery_days": payload.delivery_days,
                "reliability_score": reliability,
                "status": "PENDING",
            },
        )
        # Re-score all candidates for this request via the optimization engine
        await OptimizationEngine().generate_candidates_for_request(
            factory_bid.request_id, mode="fast"
        )
        return {
            "status": "success",
            "candidate_id": updated_candidate.id,
            "message": "Quote updated",
        }

    # Create a new COMPLETE MatchCandidate (factory + logist)
    complete = await prisma.matchcandidate.create(
        data={
            "request": {"connect": {"id": factory_bid.request_id}},
            "inventory_entry": {"connect": {"id": factory_bid.inventory_entry_id}},
            "logistic_offer": {"connect": {"id": logist_offer.id}},
            "currency": {"connect": {"code": inv.currency_code}},
            "quoted_quantity": factory_bid.quoted_quantity,
            "factory_note": factory_bid.factory_note,
            "delivery_price": delivery_cost,
            "total_cost": total,
            "delivery_days": payload.delivery_days,
            "reliability_score": reliability,
            "status": "PENDING",
        }
    )

    # Score all candidates for this request via the optimization engine
    await OptimizationEngine().generate_candidates_for_request(
        factory_bid.request_id, mode="fast"
    )

    return {
        "status": "success",
        "candidate_id": complete.id,
        "message": "Quote created",
    }


# ═══════════════════════════════════════════════════════════════════════
#  CUSTOMER  – view complete proposals and select one
# ═══════════════════════════════════════════════════════════════════════

@router.get("/candidates/{request_id}")
async def list_candidates_for_request(
    request_id: str,
    user=Depends(_require_authenticated_user),
):
    """
    Complete MatchCandidates (both factory + logist) for a given request.
    Customers can only see their own requests; factories/logists/admins see all.
    """
    req = await prisma.request.find_first(
        where={"id": request_id, "deleted_at": None}
    )
    if not req:
        raise HTTPException(404, "Request not found")

    # Customers may only see their own
    if user.role == "CUSTOMER":
        profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
        if not profile or req.customer_profile_id != profile.id:
            raise HTTPException(403, "Forbidden")

    candidates = await prisma.matchcandidate.find_many(
        where={
            "request_id": request_id,
            "logistic_offer_id": {"not": None},   # complete proposals only
            "deleted_at": None,
            "status": {"in": ["PENDING", "ACCEPTED"]},
        },
        include={
            "request": {
                "include": {
                    "destination_address": {
                        "include": {"city": True, "region": True, "country": True}
                    }
                }
            },
            "inventory_entry": {
                "include": {
                    "item": True,
                    "factory_profile": True,
                    "stock_address": {
                        "include": {"city": True, "region": True, "country": True}
                    },
                }
            },
            "logistic_offer": True,
        },
        order={"fitness_score": "desc"},
        take=50,
    )
    return [_serialize_candidate(c) for c in candidates]


class SelectCandidateBody(BaseModel):
    candidate_id: str


@router.post("/select-candidate")
async def select_candidate(
    payload: SelectCandidateBody,
    user=Depends(_require_authenticated_user),
):
    """
    Customer (or admin) selects a complete MatchCandidate.
    Creates a Transaction, advances request to MATCHED,
    marks chosen candidate ACCEPTED, others REJECTED.
    """
    candidate = await prisma.matchcandidate.find_first(
        where={"id": payload.candidate_id, "deleted_at": None},
        include={"request": {"include": {"customer_profile": True}}},
    )
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    if not candidate.logistic_offer_id:
        raise HTTPException(400, "Cannot select an incomplete candidate (no logistics quote yet)")
    if candidate.status != "PENDING":
        raise HTTPException(400, f"Candidate is already '{candidate.status}'")

    req = candidate.request
    if req.status not in ("PAIRING_IN_PROGRESS", "PENDING"):
        raise HTTPException(400, f"Request cannot be matched in status '{req.status}'")

    # Authorisation: customer may only select their own request
    if user.role == "CUSTOMER":
        profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
        if not profile or req.customer_profile_id != profile.id:
            raise HTTPException(403, "Forbidden")

    # Idempotency: if a Transaction already exists for this request, refuse
    existing_tx = await prisma.transaction.find_unique(where={"request_id": req.id})
    if existing_tx:
        raise HTTPException(409, "A transaction already exists for this request")

    # Accept chosen candidate
    await prisma.matchcandidate.update(
        where={"id": candidate.id},
        data={"status": "ACCEPTED"},
    )

    # Reject all other PENDING candidates for this request
    all_other = await prisma.matchcandidate.find_many(
        where={
            "request_id": req.id,
            "id": {"not": candidate.id},
            "status": "PENDING",
            "deleted_at": None,
        }
    )
    for other in all_other:
        await prisma.matchcandidate.update(
            where={"id": other.id},
            data={"status": "REJECTED"},
        )

    # Create transaction
    transaction = await prisma.transaction.create(
        data={
            "request": {"connect": {"id": req.id}},
            "selected_candidate": {"connect": {"id": candidate.id}},
            "status": "CONTRACT_DRAFTED",
        }
    )

    # Bootstrap first contract packet and signature slots for all parties.
    await prisma.contractpacket.create(
        data={
            "transaction": {"connect": {"id": transaction.id}},
            "version": 1,
            "document_hash": f"tx-{transaction.id}-v1",
            "terms_json": Json(
                {
                    "request_id": req.id,
                    "candidate_id": candidate.id,
                    "payment_terms": "Full payment before fulfillment start",
                }
            ),
        }
    )

    enriched_candidate = await prisma.matchcandidate.find_first(
        where={"id": candidate.id},
        include={
            "inventory_entry": {"include": {"factory_profile": True}},
            "logistic_offer": {"include": {"logist_profile": True}},
        },
    )
    if (
        enriched_candidate
        and enriched_candidate.inventory_entry
        and enriched_candidate.inventory_entry.factory_profile
        and enriched_candidate.logistic_offer
        and enriched_candidate.logistic_offer.logist_profile
    ):
        signature_users = [
            (req.customer_profile.user_id, "CUSTOMER"),
            (enriched_candidate.inventory_entry.factory_profile.user_id, "FACTORY"),
            (enriched_candidate.logistic_offer.logist_profile.user_id, "LOGIST"),
        ]
        for signature_user_id, role in signature_users:
            await prisma.signature.create(
                data={
                    "transaction": {"connect": {"id": transaction.id}},
                    "user": {"connect": {"id": signature_user_id}},
                    "role_at_signing": role,
                    "status": "PENDING",
                }
            )

    # Advance request
    await prisma.request.update(
        where={"id": req.id},
        data={"status": "CONTRACT_DRAFTED"},
    )

    return {
        "status": "success",
        "transaction_id": transaction.id,
        "message": "Candidate selected. Transaction created.",
    }
