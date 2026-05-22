from __future__ import annotations

import asyncio
import os
import random
import sys
from decimal import Decimal
from pathlib import Path

from prisma import Json, Prisma

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

# Factory / logistics archetype definitions
# Factory: (label, unit_price_eur, qty_available, archetype, reliability_factor, days_offset)
# Logistic: (label, days_min, days_max, reliability, base_price_eur, archetype)

_FACTORY_ARCHETYPES = [
    # Budget tier 
    ("Discount Steelworks Almaty",   Decimal("92"),  Decimal("4500"),  "budget",  0.65, 7),
    ("Karaganda Bulk Supply",        Decimal("108"), Decimal("5500"),  "budget",  0.68, 6),
    ("Talgar Materials Co.",         Decimal("128"), Decimal("6000"),  "budget",  0.72, 5),
    ("Shymkent Heavy Goods",         Decimal("148"), Decimal("6800"),  "budget",  0.75, 5),
    ("Kapchagay Industrial",         Decimal("168"), Decimal("7000"),  "budget",  0.77, 4),
    ("Ust-Kamenogorsk Standard",     Decimal("188"), Decimal("7500"),  "budget",  0.79, 4),
    ("Pavlodar Resource Group",      Decimal("212"), Decimal("6500"),  "budget",  0.81, 3),

    # Mid tier 
    ("Almaty Trade House",           Decimal("245"), Decimal("9000"),  "mid",     0.84, 2),
    ("Astana Procurement Ltd",       Decimal("268"), Decimal("9500"),  "mid",     0.86, 2),
    ("Kazakh Industrial Mid-Co",     Decimal("292"), Decimal("10500"), "mid",     0.88, 1),
    ("Aktobe Forge Partners",        Decimal("312"), Decimal("11000"), "mid",     0.89, 1),
    ("Atyrau Refining Mid",          Decimal("328"), Decimal("9000"),  "mid",     0.90, 1),

    # Premium tier 
    ("Tau-Ken Premium Steel",        Decimal("358"), Decimal("8000"),  "premium", 0.91, 0),
    ("KazMineral Top Grade",         Decimal("395"), Decimal("8500"),  "premium", 0.93, 0),
    ("Eurasian Quality Holding",     Decimal("432"), Decimal("9000"),  "premium", 0.95, -1),
    ("Caspian Elite Metals",         Decimal("478"), Decimal("7500"),  "premium", 0.97, -1),

    # Mixed wildcards 
    ("Family Plant Talgar (Gem)",    Decimal("152"), Decimal("4000"),  "mixed",   0.90, 1),
    ("Co-op Pavlodar (Underdog)",    Decimal("178"), Decimal("4500"),  "mixed",   0.92, 0),
    ("Boutique Slow Premium",        Decimal("415"), Decimal("3500"),  "mixed",   0.82, 5),
    ("Astana Inflated Standard",     Decimal("358"), Decimal("4000"),  "mixed",   0.77, 4),
]

_LOGISTIC_ARCHETYPES = [
    # Express tier 
    ("Air Astana Cargo Premium",    1,  3,  0.97, Decimal("56000"), "express"),
    ("KTZ Express Rail Alpha",      2,  4,  0.94, Decimal("46000"), "express"),
    ("Almaty Premium Roadway",      2,  5,  0.91, Decimal("40000"), "express"),

    # Standard tier
    ("KTZ Standard Rail",           4,  6,  0.87, Decimal("30000"), "standard"),
    ("Silk Road Trucking",          5,  7,  0.84, Decimal("25000"), "standard"),
    ("Eurasian Mid-Freight",        5,  8,  0.81, Decimal("21000"), "standard"),
    ("Kazpost Bulk Standard",       6,  9,  0.78, Decimal("18000"), "standard"),

    # Economy tier
    ("Almaty Bulk Rail Discount",   8,  10, 0.74, Decimal("14500"), "economy"),
    ("Pavlodar Slow Freight",       9,  11, 0.70, Decimal("11500"), "economy"),
    ("Shymkent Road Budget",        10, 12, 0.67, Decimal("9500"),  "economy"),
    ("Backhaul Consolidator KZ",    11, 13, 0.65, Decimal("8000"),  "economy"),
    ("Steppe Long-Haul Economy",    12, 15, 0.63, Decimal("7000"),  "economy"),

    # Wildcard
    ("Hybrid Reliable Carrier",     4,  7,  0.91, Decimal("32000"), "mixed"),
]


async def create_large_scale_request_scenario(
    prisma: Prisma,
    address_id: str,
    country_id: str,
    region_id: str,
    city_id: str,
    category_id: str,
    item_id: str,
    request_name: str = "Large_Test_Request",
    num_factories: int = 20,
    num_logistics: int = 13,
    target_candidates: int = 150,
    optimization_profile: str = "balanced",
) -> str:
    """
    Create one Request backed by N factories × M logistics = N*M MatchCandidates.
    Returns the new request ID.
    """
    import time

    rng = random.Random(12345)  # fixed seed for reproducibility

    archetypes = _FACTORY_ARCHETYPES[:num_factories]
    log_archetypes = _LOGISTIC_ARCHETYPES[:num_logistics]

    ls_customer_user = await _ensure_user(prisma, "customer.demo@intelli.local", "CUSTOMER")
    ls_customer_profile = await prisma.customerprofile.find_first(
        where={"user_id": ls_customer_user.id}
    )
    if ls_customer_profile is None:
        ls_customer_profile = await prisma.customerprofile.create(
            data={
                "user_id": ls_customer_user.id,
                "display_name": "Demo Customer",
                "registration_country_code": "KZ",
                "registration_address": "Abay Ave 10",
                "preferred_currency_code": "EUR",
                "primary_address_id": address_id,
            }
        )

    # Request 
    req_qty = Decimal("300")
    request_full_name = f"[LARGE_SCALE] {request_name} - Coal 99% pure"
    existing_req = await prisma.request.find_first(
        where={
            "customer_profile_id": ls_customer_profile.id,
            "requested_name_text": request_full_name,
            "deleted_at": None,
        }
    )
    req_payload = {
        "category_id": category_id,
        "item_id": item_id,
        "requested_name_text": request_full_name,
        "quantity": req_qty,
        "destination_address_id": address_id,
        "preferred_currency_code": "EUR",
        "requested_characteristics_json": Json({"quality": "99%", "quantity_unit": "tons"}),
        "optimization_profile": optimization_profile,
        "status": "PAIRING_IN_PROGRESS",
        "deleted_at": None,
    }
    if existing_req:
        ls_request = await prisma.request.update(where={"id": existing_req.id}, data=req_payload)
    else:
        ls_request = await prisma.request.create(
            data={"customer_profile_id": ls_customer_profile.id, **req_payload}
        )

    # Factory profiles + inventory
    inventory_entries = []
    factory_meta: dict[str, tuple[float, int]] = {}  # inventory_id - (rel_factor, days_offset)
    for i, (label, unit_price, qty_avail, _arch, rel_factor, days_offset) in enumerate(archetypes):
        email = f"ls.factory.{i + 1:02d}@intelli.local"
        f_user = await _ensure_user(prisma, email, "FACTORY")
        f_profile = await prisma.factoryprofile.upsert(
            where={"user_id": f_user.id},
            data={
                "create": {
                    "user_id": f_user.id,
                    "legal_name": label,
                    "registration_country_code": "KZ",
                    "registration_address": f"Industrial Zone {i + 1}, Almaty",
                    "preferred_currency_code": "EUR",
                    "primary_address_id": address_id,
                },
                "update": {"legal_name": label, "deleted_at": None},
            },
        )
        jitter = Decimal(str(rng.randint(-3, 3)))
        inv = await _ensure_inventory(
            prisma,
            f_profile.id,
            item_id,
            address_id,
            qty_avail,
            unit_price + jitter,
            "EUR",
            {"purity_percent": 99, "archetype": _arch},
        )
        inventory_entries.append(inv)
        factory_meta[inv.id] = (rel_factor, days_offset)

    # Logistics profiles + offers + coverage 
    logistic_offers = []
    for j, (label, days_min, days_max, reliability, base_price, _arch) in enumerate(log_archetypes):
        email = f"ls.logist.{j + 1:02d}@intelli.local"
        l_user = await _ensure_user(prisma, email, "LOGIST")
        l_profile = await prisma.logistprofile.upsert(
            where={"user_id": l_user.id},
            data={
                "create": {
                    "user_id": l_user.id,
                    "company_name": label,
                    "registration_country_code": "KZ",
                    "registration_address": f"Logistics Hub {j + 1}, Almaty",
                    "preferred_currency_code": "EUR",
                    "primary_address_id": address_id,
                },
                "update": {"company_name": label, "deleted_at": None},
            },
        )
        price_jitter = Decimal(str(rng.randint(-1500, 1500)))
        rel_jitter = round(rng.uniform(-0.02, 0.02), 3)
        actual_reliability = max(0.60, min(0.99, reliability + rel_jitter))
        offer = await _ensure_logistic_offer(
            prisma,
            l_profile.id,
            label,
            f"{_arch.capitalize()} freight — {label}",
            base_price + price_jitter,
            Decimal("1.00"),
            Decimal("0.70"),
            days_min,
            days_max,
            round(actual_reliability, 3),
            "EUR",
        )
        await _ensure_coverage(prisma, offer.id, country_id, region_id, city_id)
        logistic_offers.append((offer, days_min, days_max))

    # MatchCandidates: all inventory × logistic offer pairs
    await prisma.matchcandidate.delete_many(
        where={"request_id": ls_request.id, "deleted_at": None}
    )

    t0 = time.perf_counter()
    candidate_count = 0
    for inv in inventory_entries:
        rel_factor, days_offset = factory_meta[inv.id]
        for (offer, days_min, days_max) in logistic_offers:
            if candidate_count >= target_candidates:
                break

            # delivery days: logistic base + factory offset
            base_days = rng.randint(days_min, days_max)
            delivery_days = max(3, min(15, base_days + days_offset))

            # reliability: 60% logistic + 40% factory + noise
            offer_rel = float(offer.reliability_score)
            blended = 0.6 * offer_rel + 0.4 * rel_factor + rng.uniform(-0.01, 0.01)
            candidate_reliability = round(max(0.65, min(0.97, blended)), 3)

            delivery_price = Decimal(str(
                int(offer.base_price) + rng.randint(-2000, 2000)
            ))
            if delivery_price < Decimal("5000"):
                delivery_price = Decimal("5000")
            total_cost = (req_qty * inv.price_per_unit) + delivery_price
            await _upsert_candidate(
                prisma,
                ls_request.id,
                inv.id,
                offer.id,
                req_qty,
                delivery_price,
                delivery_days,
                candidate_reliability,
                total_cost,
                "PENDING",
                f"{inv.factory_profile_id[:6]}×{offer.logist_profile_id[:6]}",
            )
            candidate_count += 1
        if candidate_count >= target_candidates:
            break
    elapsed_seed = time.perf_counter() - t0

    print(f"\n{'='*62}")
    print(f"  Large-Scale Scenario: {request_full_name}")
    print(f"{'='*62}")
    print(f"  Factories:         {len(inventory_entries)}")
    print(f"  Logistics offers:  {len(logistic_offers)}")
    print(f"  MatchCandidates:   {candidate_count}")
    print(f"  Seeding time:      {elapsed_seed:.2f}s")

    # Run three strategies and print comparison 
    try:
        from services.optimization_engine import OptimizationEngine  # noqa: E402
        engine = OptimizationEngine()

        print(f"\n  Running optimization strategies on {candidate_count} candidates…")

        t_compare = time.perf_counter()
        comparison = await engine.compare_baselines(ls_request.id)
        t_compare = time.perf_counter() - t_compare

        print(f"\n  Candidate pool size: {comparison.get('candidate_pool_size', candidate_count)}")
        print(f"  Profile / weights:   {comparison.get('optimization_profile', 'balanced')}  "
              f"{comparison.get('weights', {})}")
        print(f"\n  {'Strategy':<14} {'Top Cost (EUR)':>14} {'Days':>6} {'Reliability':>12} {'Score':>8}")
        print(f"  {'-'*14} {'-'*14} {'-'*6} {'-'*12} {'-'*8}")

        scoreboard: list[tuple[str, float]] = []
        for key, label in [
            ("greedy",    "greedy"),
            ("fast",      "fast"),
            ("deep",      "deep (GA)"),
        ]:
            results = comparison.get(key, [])
            if not results:
                print(f"  {label:<14} {'—':>14} {'—':>6} {'—':>12} {'—':>8}")
                scoreboard.append((key, -1.0))
                continue
            top = results[0]
            cost  = float(top.get("total_cost", 0))
            days  = top.get("delivery_days", "?")
            rel   = float(top.get("reliability", 0))
            score = float(top.get("fitness_score") or 0)
            print(f"  {label:<14} {cost:>14,.0f} {days:>6} {rel:>12.3f} {score:>8.4f}")
            scoreboard.append((key, score))

        scoreboard.sort(key=lambda kv: (kv[1], 1 if kv[0] == "deep" else 0), reverse=True)
        winner_key, winner_score = scoreboard[0]
        winner_pretty = {
            "greedy": "Greedy",
            "fast": "Fast", "deep": "Deep (NSGA-II GA)",
        }.get(winner_key, winner_key)

        print(f"\n  Winner: {winner_pretty} @ weighted score {winner_score:.4f}")
        if winner_key == "deep":
            print("  ✓ Deep GA wins with best balanced score")
        else:
            print(f"  Note: Deep GA matched the global optimum within {abs(winner_score - dict(scoreboard).get('deep', 0)):.4f}")
        print(f"\n  Total optimization time: {t_compare:.2f}s")
        print(f"{'='*62}\n")

    except Exception as exc:  # noqa: BLE001
        print(f"  [Warning] Optimization comparison failed: {exc}")

    return ls_request.id


# Random name pools 

_RAND_FACTORY_NAMES = [
    "Karaganda Bulk Supply",
    "Talgar Materials Co.",
    "Shymkent Heavy Goods",
    "Kapchagay Industrial",
    "Ust-Kamenogorsk Standard",
    "Pavlodar Resource Group",
    "Almaty Trade House",
    "Astana Procurement Ltd",
    "Kazakh Industrial Corp",
    "Aktobe Forge Partners",
    "Atyrau Refining Co.",
    "Tau-Ken Premium Steel",
    "KazMineral Holdings",
    "Eurasian Quality Metals",
    "Caspian Elite Industries",
    "Semey Carbon Corp",
    "Oskemen Bulk Traders",
    "Zhezkazgan Minerals",
    "Taraz Supply Partners",
    "Kostanay Ore & Coal",
    "Ekibastuz Energy Supply",
    "Ridder Metallurgy",
    "Kentau Industrial Group",
    "Temirtau Steel Partners",
    "Balkhash Raw Materials",
]

_RAND_LOGIST_NAMES = [
    "Air Astana Cargo Premium",
    "KTZ Express Rail",
    "Almaty Premium Roadway",
    "KTZ Standard Rail",
    "Silk Road Trucking",
    "Eurasian Mid-Freight",
    "Kazpost Bulk",
    "Almaty Bulk Rail",
    "Pavlodar Slow Freight",
    "Shymkent Road Budget",
    "Backhaul Consolidator KZ",
    "Steppe Long-Haul",
    "Hybrid Reliable Carrier",
    "KazTrans Express",
    "Tengri Freight",
    "Trans-Caspian Logistics",
    "Central Asia Forwarding",
    "Alatau Road Services",
    "NurSultan Air Cargo",
    "QazLogistics Standard",
]


def _print_comparison_summary(comparison: dict, candidate_count: int, request_name: str, t_compare: float) -> None:
    print(f"\n  Candidate pool size: {comparison.get('candidate_pool_size', candidate_count)}")
    print(f"  Profile / weights:   {comparison.get('optimization_profile', 'balanced')}  "
          f"{comparison.get('weights', {})}")
    print(f"\n  {'Strategy':<14} {'Top Cost (EUR)':>14} {'Days':>6} {'Reliability':>12} {'Score':>8}")
    print(f"  {'-'*14} {'-'*14} {'-'*6} {'-'*12} {'-'*8}")

    scoreboard: list[tuple[str, float]] = []
    for key, label in [
        ("greedy",    "Greedy"),
        ("fast",      "Fast"),
        ("deep",      "Deep (GA)"),
    ]:
        results = comparison.get(key, [])
        if not results:
            print(f"  {label:<14} {'—':>14} {'—':>6} {'—':>12} {'—':>8}")
            scoreboard.append((key, -1.0))
            continue
        top = results[0]
        cost  = float(top.get("total_cost", 0))
        days  = top.get("delivery_days", "?")
        rel   = float(top.get("reliability", 0))
        score = float(top.get("fitness_score") or 0)
        print(f"  {label:<14} {cost:>14,.0f} {days:>6} {rel:>12.3f} {score:>8.4f}")
        scoreboard.append((key, score))

    scoreboard.sort(key=lambda kv: (kv[1], 1 if kv[0] == "deep" else 0), reverse=True)
    winner_key, winner_score = scoreboard[0]
    winner_pretty = {
        "greedy": "Greedy",
        "fast": "Fast", "deep": "Deep (NSGA-II GA)",
    }.get(winner_key, winner_key)

    print(f"\n  Winner: {winner_pretty} @ weighted score {winner_score:.4f}")
    if winner_key == "deep":
        print("  ✓ Deep GA wins with best balanced score")
    else:
        deep_score = dict(scoreboard).get("deep", 0.0)
        print(f"  Note: Deep GA matched the global optimum within {abs(winner_score - deep_score):.4f}")
    print(f"\n  Total optimization time: {t_compare:.2f}s")
    print(f"{'='*62}\n")


async def create_random_large_scale_request(
    num_candidates: int = 150,
    random_seed: int | None = None,
    item_name: str = "Coal 99% pure",
) -> str:
    """Random large-scale scenario. random_seed=None - fresh, int - reproducible. Returns Request ID."""
    import time

    rng = random.Random(random_seed)

    await seed_reference_geo()

    prisma = Prisma()
    await prisma.connect()
    try:
        country = await prisma.country.find_unique(where={"iso2": "KZ"})
        if not country:
            raise RuntimeError("Country KZ missing after geo seed.")

        region = await _ensure_region(prisma, country.id, "ALA", "Almaty Region")
        city   = await _ensure_city(prisma, region.id, "Almaty")
        address = await _ensure_address(
            prisma, country.id, region.id, city.id, "Abay Ave 10", "050000"
        )
        await _ensure_currency(prisma, "EUR", "Euro",       "EUR", 2, False, Decimal("1.08"))
        await _ensure_currency(prisma, "USD", "US Dollar",  "$",   2, True,  Decimal("1.0"))

        category = await _ensure_category(prisma, "energy-coal", "Energy")
        item = await _ensure_item(
            prisma, category.id, item_name, "tons",
            {"purity_percent": 99, "type": "anthracite"},
        )

        cust_user = await _ensure_user(prisma, "customer.demo@intelli.local", "CUSTOMER")
        cust_profile = await prisma.customerprofile.find_first(
            where={"user_id": cust_user.id}
        )
        if cust_profile is None:
            cust_profile = await prisma.customerprofile.create(
                data={
                    "user_id": cust_user.id,
                    "display_name": "Demo Customer",
                    "registration_country_code": "KZ",
                    "registration_address": "Abay Ave 10",
                    "preferred_currency_code": "EUR",
                    "primary_address_id": address.id,
                }
            )

        # Determine factory / logistic counts
        n_factories = max(10, round((num_candidates * 1.3) ** 0.5))
        n_logistics = max(8,  (num_candidates // n_factories) + 2)
        # target: random in [130, 170] or ±20 of num_candidates
        target = rng.randint(
            max(130, num_candidates - 20),
            min(170, num_candidates + 20),
        )

        # Random factory archetypes
        inventory_entries: list = []
        factory_meta: dict[str, tuple[float, int]] = {}

        factory_name_pool = _RAND_FACTORY_NAMES[:]
        rng.shuffle(factory_name_pool)

        for i in range(n_factories):
            tier_roll = rng.random()
            if tier_roll < 0.35:
                price      = round(rng.uniform(90,  215), 2)
                days_off   = rng.randint(4, 7)
                rel_factor = round(rng.uniform(0.65, 0.78), 3)
                tier       = "budget"
            elif tier_roll < 0.65:
                price      = round(rng.uniform(215, 355), 2)
                days_off   = rng.randint(1, 3)
                rel_factor = round(rng.uniform(0.78, 0.90), 3)
                tier       = "mid"
            elif tier_roll < 0.85:
                price      = round(rng.uniform(355, 480), 2)
                days_off   = rng.randint(-1, 1)
                rel_factor = round(rng.uniform(0.88, 0.97), 3)
                tier       = "premium"
            else:
                wc = rng.choice(
                    ["cheap_reliable", "cheap_fast", "expensive_slow", "expensive_unreliable"]
                )
                if wc == "cheap_reliable":
                    price      = round(rng.uniform(130, 200), 2)
                    days_off   = rng.randint(0,  2)
                    rel_factor = round(rng.uniform(0.87, 0.94), 3)
                elif wc == "cheap_fast":
                    price      = round(rng.uniform(150, 220), 2)
                    days_off   = rng.randint(-1, 1)
                    rel_factor = round(rng.uniform(0.80, 0.90), 3)
                elif wc == "expensive_slow":
                    price      = round(rng.uniform(380, 460), 2)
                    days_off   = rng.randint(3, 6)
                    rel_factor = round(rng.uniform(0.78, 0.85), 3)
                else:
                    price      = round(rng.uniform(340, 420), 2)
                    days_off   = rng.randint(2, 4)
                    rel_factor = round(rng.uniform(0.68, 0.78), 3)
                tier = "mixed"

            label = factory_name_pool[i % len(factory_name_pool)]
            email = f"rand.factory.{i + 1:02d}@intelli.local"
            f_user = await _ensure_user(prisma, email, "FACTORY")
            f_profile = await prisma.factoryprofile.upsert(
                where={"user_id": f_user.id},
                data={
                    "create": {
                        "user_id": f_user.id,
                        "legal_name": label,
                        "registration_country_code": "KZ",
                        "registration_address": f"Industrial Zone {i + 1}, Almaty",
                        "preferred_currency_code": "EUR",
                        "primary_address_id": address.id,
                    },
                    "update": {"legal_name": label, "deleted_at": None},
                },
            )
            inv = await _ensure_inventory(
                prisma, f_profile.id, item.id, address.id,
                Decimal(str(rng.randint(3000, 12000))),
                Decimal(str(price)),
                "EUR",
                {"purity_percent": 99, "archetype": tier},
            )
            inventory_entries.append(inv)
            factory_meta[inv.id] = (rel_factor, days_off)

        # Random logistic archetypes
        logistic_offers: list = []
        logist_name_pool = _RAND_LOGIST_NAMES[:]
        rng.shuffle(logist_name_pool)

        for j in range(n_logistics):
            tier_roll = rng.random()
            if tier_roll < 0.25:
                days_min     = rng.randint(1, 2)
                days_max     = rng.randint(days_min + 1, 5)
                log_rel      = round(rng.uniform(0.91, 0.97), 3)
                base_price   = Decimal(str(rng.randint(42000, 60000)))
                tier         = "express"
            elif tier_roll < 0.55:
                days_min     = rng.randint(4, 6)
                days_max     = rng.randint(days_min + 1, 9)
                log_rel      = round(rng.uniform(0.78, 0.88), 3)
                base_price   = Decimal(str(rng.randint(18000, 32000)))
                tier         = "standard"
            elif tier_roll < 0.80:
                days_min     = rng.randint(8, 11)
                days_max     = rng.randint(days_min + 1, 15)
                log_rel      = round(rng.uniform(0.62, 0.75), 3)
                base_price   = Decimal(str(rng.randint(7000, 15000)))
                tier         = "economy"
            else:
                days_min     = rng.randint(3, 6)
                days_max     = rng.randint(days_min + 1, 10)
                log_rel      = round(rng.uniform(0.85, 0.93), 3)
                base_price   = Decimal(str(rng.randint(28000, 40000)))
                tier         = "mixed"

            label  = logist_name_pool[j % len(logist_name_pool)]
            email  = f"rand.logist.{j + 1:02d}@intelli.local"
            l_user = await _ensure_user(prisma, email, "LOGIST")
            l_profile = await prisma.logistprofile.upsert(
                where={"user_id": l_user.id},
                data={
                    "create": {
                        "user_id": l_user.id,
                        "company_name": label,
                        "registration_country_code": "KZ",
                        "registration_address": f"Logistics Hub {j + 1}, Almaty",
                        "preferred_currency_code": "EUR",
                        "primary_address_id": address.id,
                    },
                    "update": {"company_name": label, "deleted_at": None},
                },
            )
            if tier == "express":
                price_per_km = Decimal(str(round(rng.uniform(2.50, 4.00), 2)))
                price_per_kg = Decimal(str(round(rng.uniform(1.50, 2.50), 2)))
            elif tier == "standard":
                price_per_km = Decimal(str(round(rng.uniform(1.20, 2.20), 2)))
                price_per_kg = Decimal(str(round(rng.uniform(0.80, 1.40), 2)))
            elif tier == "economy":
                price_per_km = Decimal(str(round(rng.uniform(0.30, 0.80), 2)))
                price_per_kg = Decimal(str(round(rng.uniform(0.20, 0.50), 2)))
            else:
                price_per_km = Decimal(str(round(rng.uniform(1.50, 3.00), 2)))
                price_per_kg = Decimal(str(round(rng.uniform(0.90, 1.80), 2)))
            price_jitter = Decimal(str(rng.randint(-2000, 2000)))
            actual_price = max(Decimal("5000"), base_price + price_jitter)

            stable_title = f"rand-logist-{j + 1:02d}-primary"
            offer = await _ensure_logistic_offer(
                prisma, l_profile.id, stable_title,
                f"{tier.capitalize()} freight — {label}",
                actual_price,
                price_per_km, price_per_kg,
                days_min, days_max, log_rel, "EUR",
            )
            await _ensure_coverage(prisma, offer.id, country.id, region.id, city.id)
            logistic_offers.append((offer, days_min, days_max, log_rel))

        # Request 
        req_qty = Decimal("300")
        seed_label = str(random_seed) if random_seed is not None else "RandomRun"
        request_full_name = f"[LARGE_SCALE] {seed_label} - {item_name}"
        existing_req = await prisma.request.find_first(
            where={
                "customer_profile_id": cust_profile.id,
                "requested_name_text": request_full_name,
                "deleted_at": None,
            }
        )
        req_payload = {
            "category_id": category.id,
            "item_id": item.id,
            "requested_name_text": request_full_name,
            "quantity": req_qty,
            "destination_address_id": address.id,
            "preferred_currency_code": "EUR",
            "requested_characteristics_json": Json({"quality": "99%", "quantity_unit": "tons"}),
            "optimization_profile": "balanced",
            "status": "PAIRING_IN_PROGRESS",
            "deleted_at": None,
        }
        if existing_req:
            ls_request = await prisma.request.update(
                where={"id": existing_req.id}, data=req_payload
            )
        else:
            ls_request = await prisma.request.create(
                data={"customer_profile_id": cust_profile.id, **req_payload}
            )

        # Purge stale candidates then regenerate
        await prisma.matchcandidate.delete_many(
            where={"request_id": ls_request.id, "deleted_at": None}
        )

        t0 = time.perf_counter()
        candidate_count = 0

        pairs = [(inv, lo) for inv in inventory_entries for lo in logistic_offers]
        rng.shuffle(pairs)

        target = min(target, len(pairs))

        for inv, (offer, days_min, days_max, log_rel) in pairs:
            if candidate_count >= target:
                break

            rel_factor, days_off = factory_meta[inv.id]

            # delivery days: logistic base + factory offset
            base_days     = rng.randint(days_min, days_max)
            delivery_days = max(3, min(15, base_days + days_off))

            # Blended reliability: 60% logistic + 40% factory + tiny noise
            blended = 0.6 * log_rel + 0.4 * rel_factor + rng.uniform(-0.015, 0.015)
            cand_reliability = round(max(0.65, min(0.97, blended)), 3)

            # delivery price: base ± noise, floor 5 000 EUR
            delivery_price = Decimal(str(
                max(5000, int(offer.base_price) + rng.randint(-2500, 2500))
            ))
            total_cost = (req_qty * inv.price_per_unit) + delivery_price

            await _upsert_candidate(
                prisma,
                ls_request.id,
                inv.id,
                offer.id,
                req_qty,
                delivery_price,
                delivery_days,
                cand_reliability,
                total_cost,
                "PENDING",
                f"rand-{candidate_count + 1:03d}",
            )
            candidate_count += 1

        elapsed_seed = time.perf_counter() - t0

        print(f"\n{'='*62}")
        print("  Random Large-Scale Scenario")
        print(f"  Request: {request_full_name}")
        print(f"{'='*62}")
        print(f"  Seed:              {random_seed if random_seed is not None else '(none — fresh random)'}")
        print(f"  Factories:         {len(inventory_entries)}")
        print(f"  Logistics offers:  {len(logistic_offers)}")
        print(f"  MatchCandidates:   {candidate_count}  (target was {target})")
        print(f"  Seeding time:      {elapsed_seed:.2f}s")

        # Auto-run compare_baselines 
        try:
            from services.optimization_engine import OptimizationEngine  # noqa: E402
            engine = OptimizationEngine()
            print(f"\n  Running optimization strategies on {candidate_count} candidates…")
            t_compare = time.perf_counter()
            comparison = await engine.compare_baselines(ls_request.id)
            t_compare = time.perf_counter() - t_compare
            _print_comparison_summary(comparison, candidate_count, request_full_name, t_compare)
        except Exception as exc:  # noqa: BLE001
            print(f"  [Warning] Optimization comparison failed: {exc}")

        return ls_request.id

    finally:
        await prisma.disconnect()


async def seed(run_large: bool = False) -> None:
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

        # Multi-factory/multi-logist scenario.
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

        # Complete proposals (all factory+logist combos).
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

        # Score all PAIRING_IN_PROGRESS requests.
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

        # Optional large-scale scenario
        if run_large or _bool_env("SEED_LARGE_SCALE", False):
            await create_large_scale_request_scenario(
                prisma=prisma,
                address_id=address.id,
                country_id=country.id,
                region_id=region.id,
                city_id=city.id,
                category_id=category.id,
                item_id=item.id,
                request_name="Large_Test_Request",
                num_factories=15,
                num_logistics=12,
                target_candidates=150,
                optimization_profile="balanced",
            )
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed Intelli-Factory workflow scenarios.")
    parser.add_argument(
        "--large",
        action="store_true",
        help="Also create the large-scale scenario (150 MatchCandidates) and run all four optimization strategies.",
    )
    parser.add_argument(
        "--random",
        action="store_true",
        help="Use the new random generator (truly random data every run). Requires --large.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        metavar="N",
        help="Fix the random seed for a reproducible random run. Requires --large.",
    )
    args = parser.parse_args()

    if args.large and (args.random or args.seed is not None):
        actual_seed = None if args.random else args.seed
        asyncio.run(create_random_large_scale_request(random_seed=actual_seed))
    else:
        asyncio.run(seed(run_large=args.large))
