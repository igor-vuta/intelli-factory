from __future__ import annotations

import asyncio
import os
import random
import sys
from decimal import Decimal
from pathlib import Path

from prisma import Json, Prisma

# Ensure the API root is on the path so optimization_engine can be imported
_API_ROOT = Path(__file__).resolve().parent
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from seed_helpers import (  # noqa: E402
    _ensure_address,
    _ensure_category,
    _ensure_city,
    _ensure_coverage,
    _ensure_currency,
    _ensure_inventory,
    _ensure_item,
    _ensure_logistic_offer,
    _ensure_region,
    _ensure_user,
)
from seed_reference_geo import seed as seed_reference_geo  # noqa: E402


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


async def _ensure_demo_profiles(prisma: Prisma, address_id: str) -> dict[str, str]:
    customer_user = await _ensure_user(prisma, "customer.demo@intelli.local", "CUSTOMER")
    factory_user = await _ensure_user(prisma, "factory.demo@intelli.local", "FACTORY")
    logist_user = await _ensure_user(prisma, "logist.demo@intelli.local", "LOGIST")

    customer_profile = await prisma.customerprofile.upsert(
        where={"user_id": customer_user.id},
        data={
            "create": {
                "user_id": customer_user.id,
                "display_name": "Demo Customer",
                "registration_country_code": "KZ",
                "registration_address": "Abay Ave 10",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
            },
            "update": {
                "display_name": "Demo Customer",
                "registration_country_code": "KZ",
                "registration_address": "Abay Ave 10",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
                "deleted_at": None,
            },
        },
    )

    factory_profile = await prisma.factoryprofile.upsert(
        where={"user_id": factory_user.id},
        data={
            "create": {
                "user_id": factory_user.id,
                "legal_name": "Demo Coal Factory",
                "registration_country_code": "KZ",
                "registration_address": "Dostyk Ave 42",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
            },
            "update": {
                "legal_name": "Demo Coal Factory",
                "registration_country_code": "KZ",
                "registration_address": "Dostyk Ave 42",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
                "deleted_at": None,
            },
        },
    )

    logist_profile = await prisma.logistprofile.upsert(
        where={"user_id": logist_user.id},
        data={
            "create": {
                "user_id": logist_user.id,
                "company_name": "Demo Logistics",
                "registration_country_code": "KZ",
                "registration_address": "Mangilik El 15",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
            },
            "update": {
                "company_name": "Demo Logistics",
                "registration_country_code": "KZ",
                "registration_address": "Mangilik El 15",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
                "deleted_at": None,
            },
        },
    )

    return {
        "customer_user_id": customer_user.id,
        "factory_user_id": factory_user.id,
        "logist_user_id": logist_user.id,
        "customer_profile_id": customer_profile.id,
        "factory_profile_id": factory_profile.id,
        "logist_profile_id": logist_profile.id,
    }


async def _ensure_secondary_demo_profiles(prisma: Prisma, address_id: str) -> dict[str, str]:
    factory_user = await _ensure_user(prisma, "factory.alt@intelli.local", "FACTORY")
    logist_user = await _ensure_user(prisma, "logist.alt@intelli.local", "LOGIST")

    factory_profile = await prisma.factoryprofile.upsert(
        where={"user_id": factory_user.id},
        data={
            "create": {
                "user_id": factory_user.id,
                "legal_name": "Alt Carbon Industries",
                "registration_country_code": "KZ",
                "registration_address": "Satpayev 77",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
            },
            "update": {
                "legal_name": "Alt Carbon Industries",
                "registration_country_code": "KZ",
                "registration_address": "Satpayev 77",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
                "deleted_at": None,
            },
        },
    )

    logist_profile = await prisma.logistprofile.upsert(
        where={"user_id": logist_user.id},
        data={
            "create": {
                "user_id": logist_user.id,
                "company_name": "Alt Freight Network",
                "registration_country_code": "KZ",
                "registration_address": "Nazarbayev 88",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
            },
            "update": {
                "company_name": "Alt Freight Network",
                "registration_country_code": "KZ",
                "registration_address": "Nazarbayev 88",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
                "deleted_at": None,
            },
        },
    )

    return {
        "factory_user_id": factory_user.id,
        "logist_user_id": logist_user.id,
        "factory_profile_id": factory_profile.id,
        "logist_profile_id": logist_profile.id,
    }


async def _upsert_signature(prisma: Prisma, transaction_id: str, user_id: str, role: str, status: str):
    existing = await prisma.signature.find_first(
        where={"transaction_id": transaction_id, "user_id": user_id}
    )
    if existing:
        return await prisma.signature.update(
            where={"id": existing.id},
            data={
                "role_at_signing": role,
                "status": status,
                "signed_at": None if status != "SIGNED" else existing.signed_at,
            },
        )
    payload = {
        "transaction_id": transaction_id,
        "user_id": user_id,
        "role_at_signing": role,
        "status": status,
    }
    if status == "SIGNED":
        payload["signed_at"] = existing.signed_at if existing else None
    return await prisma.signature.create(data=payload)


async def _upsert_payment(prisma: Prisma, transaction_id: str, amount: Decimal, status: str, ref_suffix: str):
    existing = await prisma.payment.find_first(where={"transaction_id": transaction_id})
    if existing:
        return await prisma.payment.update(
            where={"id": existing.id},
            data={
                "amount": amount,
                "currency_code": "EUR",
                "status": status,
                "provider_reference": f"scenario-{ref_suffix}",
            },
        )
    return await prisma.payment.create(
        data={
            "transaction_id": transaction_id,
            "amount": amount,
            "currency_code": "EUR",
            "status": status,
            "provider_reference": f"scenario-{ref_suffix}",
        }
    )


async def _upsert_request(prisma: Prisma, customer_profile_id: str, category_id: str, item_id: str, address_id: str, name: str, qty: Decimal, status: str):
    existing = await prisma.request.find_first(
        where={
            "customer_profile_id": customer_profile_id,
            "requested_name_text": name,
            "deleted_at": None,
        }
    )
    payload = {
        "category_id": category_id,
        "item_id": item_id,
        "requested_name_text": name,
        "quantity": qty,
        "destination_address_id": address_id,
        "preferred_currency_code": "EUR",
        "requested_characteristics_json": Json({"quality": "99%", "quantity_unit": "tons"}),
        "status": status,
        "deleted_at": None,
    }
    if existing:
        return await prisma.request.update(where={"id": existing.id}, data=payload)
    return await prisma.request.create(
        data={
            **payload,
            "customer_profile_id": customer_profile_id,
        }
    )


async def _upsert_candidate(
    prisma: Prisma,
    request_id: str,
    inventory_entry_id: str,
    logistic_offer_id: str | None,
    qty: Decimal,
    delivery_price: Decimal | None,
    days: int | None,
    reliability: float | None,
    total_cost: Decimal | None,
    status: str,
    note: str,
):
    existing = await prisma.matchcandidate.find_first(
        where={
            "request_id": request_id,
            "inventory_entry_id": inventory_entry_id,
            "logistic_offer_id": logistic_offer_id,
            "deleted_at": None,
        }
    )
    payload = {
        "quoted_quantity": qty,
        "factory_note": note,
        "delivery_price": delivery_price,
        "delivery_days": days,
        "reliability_score": reliability,
        "total_cost": total_cost,
        "currency_code": "EUR",
        "status": status,
        "deleted_at": None,
    }
    if existing:
        return await prisma.matchcandidate.update(where={"id": existing.id}, data=payload)
    return await prisma.matchcandidate.create(
        data={
            "request_id": request_id,
            "inventory_entry_id": inventory_entry_id,
            "logistic_offer_id": logistic_offer_id,
            **payload,
        }
    )


async def _seed_stage_scenario(
    prisma: Prisma,
    stage_name: str,
    request_status: str,
    tx_status: str | None,
    payment_status: str | None,
    qty: Decimal,
    unit_price: Decimal,
    delivery_price: Decimal,
    delivery_days: int,
    reliability: float,
    ids: dict[str, str],
    category_id: str,
    item_id: str,
    address_id: str,
    inventory_id: str,
    logistic_offer_id: str,
):
    name = f"[SCENARIO] {stage_name} - Coal 99% pure"
    req = await _upsert_request(
        prisma,
        ids["customer_profile_id"],
        category_id,
        item_id,
        address_id,
        name,
        qty,
        request_status,
    )

    await _upsert_candidate(
        prisma,
        req.id,
        inventory_id,
        None,
        qty,
        None,
        None,
        None,
        None,
        "PENDING",
        "Factory bid only",
    )

    total_cost = (qty * unit_price) + delivery_price
    complete_status = "ACCEPTED" if tx_status else "PENDING"
    complete = await _upsert_candidate(
        prisma,
        req.id,
        inventory_id,
        logistic_offer_id,
        qty,
        delivery_price,
        delivery_days,
        reliability,
        total_cost,
        complete_status,
        "Complete proposal",
    )

    if not tx_status:
        return

    tx = await prisma.transaction.upsert(
        where={"request_id": req.id},
        data={
            "create": {
                "request_id": req.id,
                "selected_candidate_id": complete.id,
                "status": tx_status,
            },
            "update": {
                "selected_candidate_id": complete.id,
                "status": tx_status,
                "deleted_at": None,
            },
        },
    )

    await prisma.contractpacket.upsert(
        where={"transaction_id": tx.id},
        data={
            "create": {
                "transaction_id": tx.id,
                "version": 1,
                "document_hash": f"scenario-{stage_name.lower()}",
                "terms_json": Json({"stage": stage_name, "item": "Coal 99% pure"}),
            },
            "update": {
                "version": 1,
                "document_hash": f"scenario-{stage_name.lower()}",
                "terms_json": Json({"stage": stage_name, "item": "Coal 99% pure"}),
            },
        },
    )

    signature_statuses = {
        "CUSTOMER": "PENDING",
        "FACTORY": "PENDING",
        "LOGIST": "PENDING",
    }
    if tx_status in {"CONTRACT_SIGNING", "FULLY_SIGNED", "AWAITING_PAYMENT", "PAYMENT_CONFIRMED", "FULFILLMENT_STARTED", "IN_PROGRESS", "COMPLETED"}:
        signature_statuses["CUSTOMER"] = "SIGNED"
    if tx_status in {"FULLY_SIGNED", "AWAITING_PAYMENT", "PAYMENT_CONFIRMED", "FULFILLMENT_STARTED", "IN_PROGRESS", "COMPLETED"}:
        signature_statuses["FACTORY"] = "SIGNED"
        signature_statuses["LOGIST"] = "SIGNED"

    await _upsert_signature(prisma, tx.id, ids["customer_user_id"], "CUSTOMER", signature_statuses["CUSTOMER"])
    await _upsert_signature(prisma, tx.id, ids["factory_user_id"], "FACTORY", signature_statuses["FACTORY"])
    await _upsert_signature(prisma, tx.id, ids["logist_user_id"], "LOGIST", signature_statuses["LOGIST"])

    if payment_status:
        await _upsert_payment(prisma, tx.id, total_cost, payment_status, stage_name.lower())


async def seed() -> None:
    if _bool_env("SEED_WITH_REFERENCE_GEO", True):
        await seed_reference_geo()

    prisma = Prisma()
    await prisma.connect()

    try:
        country = await prisma.country.find_unique(where={"iso2": "KZ"})
        if not country:
            raise RuntimeError("Country KZ missing. Run seed_reference_geo.py first.")

        region = await _ensure_region(prisma, country.id, "ALA", "Almaty Region")
        city = await _ensure_city(prisma, region.id, "Almaty")
        address = await _ensure_address(prisma, country.id, region.id, city.id, "Abay Ave 10", "050000")

        await _ensure_currency(prisma, "EUR", "Euro", "EUR", 2, False, Decimal("1.08"))
        await _ensure_currency(prisma, "USD", "US Dollar", "$", 2, True, Decimal("1.0"))

        ids = await _ensure_demo_profiles(prisma, address.id)
        secondary_ids = await _ensure_secondary_demo_profiles(prisma, address.id)

        category = await _ensure_category(prisma, "energy-coal", "Energy")
        item = await _ensure_item(
            prisma,
            category.id,
            "Coal 99% pure",
            "tons",
            {"purity_percent": 99, "type": "anthracite"},
        )

        inventory = await _ensure_inventory(
            prisma,
            ids["factory_profile_id"],
            item.id,
            address.id,
            Decimal("9000"),
            Decimal("200"),
            "EUR",
            {"purity_percent": 99},
        )

        inventory_secondary = await _ensure_inventory(
            prisma,
            secondary_ids["factory_profile_id"],
            item.id,
            address.id,
            Decimal("7000"),
            Decimal("192"),
            "EUR",
            {"purity_percent": 99, "grade": "A"},
        )

        offer = await _ensure_logistic_offer(
            prisma,
            ids["logist_profile_id"],
            "Demo Rail + Road",
            "Balanced cost/time profile",
            Decimal("20000"),
            Decimal("1.10"),
            Decimal("0.80"),
            1,
            4,
            0.94,
            "EUR",
        )
        offer_secondary = await _ensure_logistic_offer(
            prisma,
            secondary_ids["logist_profile_id"],
            "Alt Rail",
            "Lower cost with longer lead time",
            Decimal("15000"),
            Decimal("0.90"),
            Decimal("0.65"),
            2,
            6,
            0.90,
            "EUR",
        )
        await _ensure_coverage(prisma, offer.id, country.id, region.id, city.id)
        await _ensure_coverage(prisma, offer_secondary.id, country.id, region.id, city.id)

        deterministic_stages: list[tuple[str, str, str | None, str | None]] = [
            ("REQUEST_PENDING", "PENDING", None, None),
            ("PAIRING_FACTORY_ONLY", "PAIRING_IN_PROGRESS", None, None),
            ("PAIRING_COMPLETE_PROPOSAL", "PAIRING_IN_PROGRESS", None, None),
            ("CONTRACT_DRAFTED", "CONTRACT_DRAFTED", "CONTRACT_DRAFTED", None),
            ("CONTRACT_SIGNING", "CONTRACT_SIGNING", "CONTRACT_SIGNING", None),
            ("FULLY_SIGNED", "FULLY_SIGNED", "FULLY_SIGNED", "PENDING"),
            ("AWAITING_PAYMENT", "AWAITING_PAYMENT", "AWAITING_PAYMENT", "AUTHORIZED"),
            ("PAYMENT_CONFIRMED", "PAYMENT_CONFIRMED", "PAYMENT_CONFIRMED", "CAPTURED"),
            ("FULFILLMENT_STARTED", "FULFILLMENT_STARTED", "FULFILLMENT_STARTED", "CAPTURED"),
            ("IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS", "CAPTURED"),
            ("COMPLETED", "COMPLETED", "COMPLETED", "CAPTURED"),
            ("CANCELLED", "CANCELLED", "CANCELLED", "CANCELLED"),
            ("DISPUTED", "DISPUTED", "DISPUTED", "FAILED"),
        ]

        for idx, (stage_name, request_status, tx_status, payment_status) in enumerate(deterministic_stages, start=1):
            await _seed_stage_scenario(
                prisma=prisma,
                stage_name=stage_name,
                request_status=request_status,
                tx_status=tx_status,
                payment_status=payment_status,
                qty=Decimal(str(100 + idx * 5)),
                unit_price=Decimal("200"),
                delivery_price=Decimal(str(35000 + (idx * 500))),
                delivery_days=max(1, min(7, idx % 7 + 1)),
                reliability=round(0.86 + (idx % 10) * 0.01, 2),
                ids=ids,
                category_id=category.id,
                item_id=item.id,
                address_id=address.id,
                inventory_id=inventory.id,
                logistic_offer_id=offer.id,
            )

        # Dedicated scenario for customer receiving proposals from several factories and logists.
        multi_request = await _upsert_request(
            prisma,
            ids["customer_profile_id"],
            category.id,
            item.id,
            address.id,
            "[SCENARIO] MULTI_FACTORY_MULTI_LOGIST - Coal 99% pure",
            Decimal("250"),
            "PAIRING_IN_PROGRESS",
        )

        # Factory-only bids from two factories.
        await _upsert_candidate(
            prisma,
            multi_request.id,
            inventory.id,
            None,
            Decimal("250"),
            None,
            None,
            None,
            None,
            "PENDING",
            "Factory bid only (primary factory)",
        )
        await _upsert_candidate(
            prisma,
            multi_request.id,
            inventory_secondary.id,
            None,
            Decimal("250"),
            None,
            None,
            None,
            None,
            "PENDING",
            "Factory bid only (secondary factory)",
        )

        # Complete proposals across both factories and both logist providers.
        await _upsert_candidate(
            prisma,
            multi_request.id,
            inventory.id,
            offer.id,
            Decimal("250"),
            Decimal("40000"),
            1,
            0.96,
            (Decimal("250") * Decimal("200")) + Decimal("40000"),
            "PENDING",
            "Primary factory + primary logist",
        )
        await _upsert_candidate(
            prisma,
            multi_request.id,
            inventory.id,
            offer_secondary.id,
            Decimal("250"),
            Decimal("32000"),
            3,
            0.90,
            (Decimal("250") * Decimal("200")) + Decimal("32000"),
            "PENDING",
            "Primary factory + secondary logist",
        )
        await _upsert_candidate(
            prisma,
            multi_request.id,
            inventory_secondary.id,
            offer.id,
            Decimal("250"),
            Decimal("42000"),
            2,
            0.95,
            (Decimal("250") * Decimal("192")) + Decimal("42000"),
            "PENDING",
            "Secondary factory + primary logist",
        )
        await _upsert_candidate(
            prisma,
            multi_request.id,
            inventory_secondary.id,
            offer_secondary.id,
            Decimal("250"),
            Decimal("30000"),
            4,
            0.89,
            (Decimal("250") * Decimal("192")) + Decimal("30000"),
            "PENDING",
            "Secondary factory + secondary logist",
        )

        random_bundles = _int_env("SCENARIO_RANDOM_BUNDLES", 4)
        random_stages = deterministic_stages
        for index in range(max(0, random_bundles)):
            stage_name, request_status, tx_status, payment_status = random.choice(random_stages)
            await _seed_stage_scenario(
                prisma=prisma,
                stage_name=f"RANDOM_{index + 1}_{stage_name}",
                request_status=request_status,
                tx_status=tx_status,
                payment_status=payment_status,
                qty=Decimal(str(random.randint(40, 500))),
                unit_price=Decimal(str(random.choice([180, 190, 200, 210, 220]))),
                delivery_price=Decimal(str(random.randint(8000, 70000))),
                delivery_days=random.randint(1, 10),
                reliability=round(random.uniform(0.75, 0.99), 2),
                ids=ids,
                category_id=category.id,
                item_id=item.id,
                address_id=address.id,
                inventory_id=inventory.id,
                logistic_offer_id=offer.id,
            )

        print("Workflow scenarios seeded successfully.")
        print("Demo users:")
        print("  customer.demo@intelli.local / password123")
        print("  factory.demo@intelli.local / password123")
        print("  logist.demo@intelli.local / password123")
        print("  factory.alt@intelli.local / password123")
        print("  logist.alt@intelli.local / password123")
        print("Deterministic stages created: 13")
        print("Multi factory/logist scenario: [SCENARIO] MULTI_FACTORY_MULTI_LOGIST - Coal 99% pure")
        print(f"Random scenario bundles created: {max(0, random_bundles)}")

        # Run OptimizationEngine on all PAIRING_IN_PROGRESS requests so that
        # fitness_score, score_breakdown, and rank are populated from seed data.
        print("Running OptimizationEngine on seeded requests...")
        try:
            from services.optimization_engine import OptimizationEngine

            engine = OptimizationEngine()
            pairing_requests = await prisma.request.find_many(
                where={"status": "PAIRING_IN_PROGRESS", "deleted_at": None},
                take=200,
            )
            scored_count = 0
            for req in pairing_requests:
                try:
                    results = await engine.generate_candidates_for_request(req.id, mode="fast")
                    if results:
                        scored_count += 1
                except Exception as eng_exc:  # noqa: BLE001
                    print(f"  Warning: engine failed for request {req.id}: {eng_exc}")
            print(f"OptimizationEngine scored {scored_count} request(s).")
        except Exception as opt_exc:  # noqa: BLE001
            print(f"OptimizationEngine post-seed run skipped: {opt_exc}")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())
