"""This script creates cross-referenced demo data for: geo references, users and role profiles, categories and items, 
inventory and logistics offers, requests, match candidates, transactions, signatures, payments, and event logs.
Run seed_reference_geo.py first to load countries.
"""

from __future__ import annotations

import asyncio
import os
from decimal import Decimal

from prisma import Json, Prisma
from seed_reference_geo import seed as seed_reference_geo
from seed_helpers import (
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


def _require(schema_name: str, value):
    if value is None:
        raise RuntimeError(f"Required schema dependency missing: {schema_name}")
    return value


async def seed(with_reference_geo: bool = False) -> None:
    if with_reference_geo:
        print("Seeding reference geo data first...")
        await seed_reference_geo()

    prisma = Prisma()
    await prisma.connect()

    try:
        country_kz = await prisma.country.find_unique(where={"iso2": "KZ"})
        _require("Country(iso2=KZ)", country_kz)

        region_almaty = await _ensure_region(prisma, country_kz.id, "ALA", "Almaty Region")
        region_astana = await _ensure_region(prisma, country_kz.id, "AST", "Astana Region")
        region_shymkent = await _ensure_region(prisma, country_kz.id, "SHY", "Shymkent Region")

        city_almaty = await _ensure_city(prisma, region_almaty.id, "Almaty")
        city_astana = await _ensure_city(prisma, region_astana.id, "Astana")
        city_shymkent = await _ensure_city(prisma, region_shymkent.id, "Shymkent")

        addr_almaty_factory = await _ensure_address(
            prisma, country_kz.id, region_almaty.id, city_almaty.id, "Dostyk Ave 42", "050051"
        )
        addr_almaty_customer = await _ensure_address(
            prisma, country_kz.id, region_almaty.id, city_almaty.id, "Abay Ave 10", "050000"
        )
        addr_astana_hub = await _ensure_address(
            prisma, country_kz.id, region_astana.id, city_astana.id, "Mangilik El 15", "010000"
        )
        addr_shymkent_factory = await _ensure_address(
            prisma, country_kz.id, region_shymkent.id, city_shymkent.id, "Tauke Khan 97", "160000"
        )

        for code, name, symbol, decimals, is_base, rate in [
            ("USD", "US Dollar", "$", 2, True, Decimal("1.0")),
            ("KZT", "Kazakhstani Tenge", "KZT", 2, False, Decimal("0.0022")),
            ("EUR", "Euro", "EUR", 2, False, Decimal("1.08")),
            ("TRY", "Turkish Lira", "TRY", 2, False, Decimal("0.031")),
        ]:
            await _ensure_currency(prisma, code, name, symbol, decimals, is_base, rate)

        categories = {
            "textile": await _ensure_category(prisma, "textile", "Textile"),
            "electronics": await _ensure_category(prisma, "electronics", "Electronics"),
            "food": await _ensure_category(prisma, "food", "Food"),
            "packaging": await _ensure_category(prisma, "packaging", "Packaging"),
        }

        item_specs = [
            ("textile", "Cotton T-Shirt", "pcs", {"material": "cotton", "gsm": 180}),
            ("textile", "Silk Scarf", "pcs", {"material": "silk", "size": "180x60"}),
            ("textile", "Wool Sweater", "pcs", {"material": "wool", "sizes": ["M", "L", "XL"]}),
            ("textile", "Denim Jacket", "pcs", {"material": "denim", "season": "all"}),
            ("electronics", "Power Supply", "pcs", {"voltage": "220V", "wattage": 750}),
            ("electronics", "Circuit Board", "pcs", {"layers": 6, "type": "FR4"}),
            ("electronics", "Sensor Module", "pcs", {"protocol": "I2C", "temp_range": "-20..80"}),
            ("food", "Pasta", "kg", {"type": "durum", "shelf_months": 18}),
            ("food", "Canned Vegetables", "kg", {"container": "tin", "shelf_months": 24}),
            ("food", "Sunflower Oil", "l", {"bottle_l": 1, "refined": True}),
            ("packaging", "Cardboard Box", "pcs", {"size": "40x30x20", "wall": "double"}),
            ("packaging", "Stretch Film", "roll", {"width_mm": 500, "thickness_micron": 20}),
        ]

        items = {}
        for category_slug, name, unit, schema_json in item_specs:
            item = await _ensure_item(
                prisma,
                categories[category_slug].id,
                name,
                unit,
                characteristics_schema=schema_json,
            )
            items[name] = item

        customer_user = await _ensure_user(prisma, "customer.demo@intelli.local", "CUSTOMER")
        customer_user_2 = await _ensure_user(prisma, "buyer.2@intelli.local", "CUSTOMER")
        factory_user_demo = await _ensure_user(prisma, "factory.demo@intelli.local", "FACTORY")  # noqa: F841
        factory_user_1 = await _ensure_user(prisma, "factory.textile@intelli.local", "FACTORY")
        factory_user_2 = await _ensure_user(prisma, "factory.electro@intelli.local", "FACTORY")
        logist_user_demo = await _ensure_user(prisma, "logist.demo@intelli.local", "LOGIST")  # noqa: F841
        logist_user_1 = await _ensure_user(prisma, "logist.regional@intelli.local", "LOGIST")
        logist_user_2 = await _ensure_user(prisma, "logist.fast@intelli.local", "LOGIST")
        admin_user = await _ensure_user(prisma, "admin.demo@intelli.local", "ADMIN")

        customer_profile_1 = await prisma.customerprofile.upsert(
            where={"user_id": customer_user.id},
            data={
                "create": {
                    "user_id": customer_user.id,
                    "display_name": "Customer One",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_almaty_customer.id,
                },
                "update": {
                    "display_name": "Customer One",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_almaty_customer.id,
                    "deleted_at": None,
                },
            },
        )
        customer_profile_2 = await prisma.customerprofile.upsert(
            where={"user_id": customer_user_2.id},
            data={
                "create": {
                    "user_id": customer_user_2.id,
                    "display_name": "Customer Two",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "KZT",
                    "primary_address_id": addr_astana_hub.id,
                },
                "update": {
                    "display_name": "Customer Two",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "KZT",
                    "primary_address_id": addr_astana_hub.id,
                    "deleted_at": None,
                },
            },
        )

        factory_profile_1 = await prisma.factoryprofile.upsert(
            where={"user_id": factory_user_1.id},
            data={
                "create": {
                    "user_id": factory_user_1.id,
                    "legal_name": "Almaty Textile Works",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_almaty_factory.id,
                },
                "update": {
                    "legal_name": "Almaty Textile Works",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_almaty_factory.id,
                    "deleted_at": None,
                },
            },
        )
        factory_profile_2 = await prisma.factoryprofile.upsert(
            where={"user_id": factory_user_2.id},
            data={
                "create": {
                    "user_id": factory_user_2.id,
                    "legal_name": "Shymkent Electro Hub",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_shymkent_factory.id,
                },
                "update": {
                    "legal_name": "Shymkent Electro Hub",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_shymkent_factory.id,
                    "deleted_at": None,
                },
            },
        )

        logist_profile_1 = await prisma.logistprofile.upsert(
            where={"user_id": logist_user_1.id},
            data={
                "create": {
                    "user_id": logist_user_1.id,
                    "company_name": "Regional Carrier",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_astana_hub.id,
                },
                "update": {
                    "company_name": "Regional Carrier",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_astana_hub.id,
                    "deleted_at": None,
                },
            },
        )
        logist_profile_2 = await prisma.logistprofile.upsert(
            where={"user_id": logist_user_2.id},
            data={
                "create": {
                    "user_id": logist_user_2.id,
                    "company_name": "Fast Freight KZ",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_almaty_factory.id,
                },
                "update": {
                    "company_name": "Fast Freight KZ",
                    "registration_country_code": "KZ",
                    "preferred_currency_code": "USD",
                    "primary_address_id": addr_almaty_factory.id,
                    "deleted_at": None,
                },
            },
        )

        await _ensure_user(prisma, admin_user.email, "ADMIN")

        inventory_specs = [
            (factory_profile_1.id, "Cotton T-Shirt", addr_almaty_factory.id, Decimal("3000"), Decimal("14.50"), "USD", {"color": "white"}),
            (factory_profile_1.id, "Silk Scarf", addr_almaty_factory.id, Decimal("1500"), Decimal("11.80"), "USD", {"color": "navy"}),
            (factory_profile_1.id, "Wool Sweater", addr_almaty_factory.id, Decimal("900"), Decimal("27.00"), "USD", {"season": "winter"}),
            (factory_profile_2.id, "Power Supply", addr_shymkent_factory.id, Decimal("700"), Decimal("42.00"), "USD", {"voltage": "220V"}),
            (factory_profile_2.id, "Circuit Board", addr_shymkent_factory.id, Decimal("1400"), Decimal("31.50"), "USD", {"layers": 6}),
            (factory_profile_2.id, "Sensor Module", addr_shymkent_factory.id, Decimal("2100"), Decimal("19.40"), "USD", {"protocol": "I2C"}),
            (factory_profile_1.id, "Cardboard Box", addr_almaty_factory.id, Decimal("8000"), Decimal("1.20"), "USD", {"size": "40x30x20"}),
            (factory_profile_1.id, "Stretch Film", addr_almaty_factory.id, Decimal("2500"), Decimal("2.10"), "USD", {"thickness": 20}),
        ]

        inventory_rows = {}
        for factory_profile_id, item_name, stock_address_id, qty, price, currency, chars in inventory_specs:
            row = await _ensure_inventory(
                prisma,
                factory_profile_id,
                items[item_name].id,
                stock_address_id,
                qty,
                price,
                currency,
                chars,
            )
            inventory_rows[item_name] = row

        offer_1 = await _ensure_logistic_offer(
            prisma,
            logist_profile_1.id,
            "Regional Economy",
            "Best cost for intercity delivery.",
            Decimal("38.00"),
            Decimal("0.95"),
            Decimal("0.55"),
            3,
            6,
            0.91,
            "USD",
        )
        offer_2 = await _ensure_logistic_offer(
            prisma,
            logist_profile_2.id,
            "Regional Express",
            "Priority lanes between Almaty and Astana.",
            Decimal("62.00"),
            Decimal("1.45"),
            Decimal("0.90"),
            1,
            3,
            0.96,
            "USD",
        )

        for offer in [offer_1, offer_2]:
            await _ensure_coverage(prisma, offer.id, country_kz.id, region_almaty.id, city_almaty.id)
            await _ensure_coverage(prisma, offer.id, country_kz.id, region_astana.id, city_astana.id)

        requests_data = [
            {
                "profile_id": customer_profile_1.id,
                "category": categories["textile"],
                "item": items["Cotton T-Shirt"],
                "qty": Decimal("500"),
                "addr": addr_almaty_customer.id,
                "currency": "USD",
                "name": "Q2 T-shirt restock",
            },
            {
                "profile_id": customer_profile_2.id,
                "category": categories["electronics"],
                "item": items["Power Supply"],
                "qty": Decimal("240"),
                "addr": addr_astana_hub.id,
                "currency": "USD",
                "name": "Power supply batch",
            },
            {
                "profile_id": customer_profile_1.id,
                "category": categories["packaging"],
                "item": items["Cardboard Box"],
                "qty": Decimal("1800"),
                "addr": addr_almaty_customer.id,
                "currency": "USD",
                "name": "Packaging for seasonal launch",
            },
        ]

        request_rows = []
        for req in requests_data:
            existing = await prisma.request.find_first(
                where={
                    "customer_profile_id": req["profile_id"],
                    "item_id": req["item"].id,
                    "status": "PENDING",
                    "deleted_at": None,
                }
            )
            if existing:
                row = await prisma.request.update(
                    where={"id": existing.id},
                    data={
                        "requested_name_text": req["name"],
                        "quantity": req["qty"],
                        "destination_address_id": req["addr"],
                        "preferred_currency_code": req["currency"],
                        "status": "PENDING",
                        "deleted_at": None,
                    },
                )
            else:
                row = await prisma.request.create(
                    data={
                        "customer_profile_id": req["profile_id"],
                        "category_id": req["category"].id,
                        "item_id": req["item"].id,
                        "requested_name_text": req["name"],
                        "quantity": req["qty"],
                        "destination_address_id": req["addr"],
                        "preferred_currency_code": req["currency"],
                        "status": "PENDING",
                    }
                )
            request_rows.append(row)

        candidate_specs = [
            (request_rows[0], inventory_rows["Cotton T-Shirt"], offer_1, Decimal("500"), Decimal("220.00"), 4, 0.91, 0.87),
            (request_rows[0], inventory_rows["Cotton T-Shirt"], offer_2, Decimal("500"), Decimal("360.00"), 2, 0.96, 0.90),
            (request_rows[1], inventory_rows["Power Supply"], offer_2, Decimal("240"), Decimal("180.00"), 2, 0.96, 0.89),
            (request_rows[2], inventory_rows["Cardboard Box"], offer_1, Decimal("1800"), Decimal("140.00"), 5, 0.91, 0.82),
        ]

        candidates = []
        for req, inv, offer, qty, delivery_price, days, reliability, fitness in candidate_specs:
            existing = await prisma.matchcandidate.find_first(
                where={
                    "request_id": req.id,
                    "inventory_entry_id": inv.id,
                    "logistic_offer_id": offer.id,
                    "deleted_at": None,
                }
            )
            total_cost = (inv.price_per_unit * qty) + delivery_price
            if existing:
                row = await prisma.matchcandidate.update(
                    where={"id": existing.id},
                    data={
                        "quoted_quantity": qty,
                        "factory_note": "Auto-seeded candidate",
                        "delivery_price": delivery_price,
                        "total_cost": total_cost,
                        "delivery_days": days,
                        "reliability_score": reliability,
                        "fitness_score": fitness,
                        "currency_code": "USD",
                        "status": "PENDING",
                        "deleted_at": None,
                    },
                )
            else:
                row = await prisma.matchcandidate.create(
                    data={
                        "request_id": req.id,
                        "inventory_entry_id": inv.id,
                        "logistic_offer_id": offer.id,
                        "quoted_quantity": qty,
                        "factory_note": "Auto-seeded candidate",
                        "delivery_price": delivery_price,
                        "total_cost": total_cost,
                        "delivery_days": days,
                        "reliability_score": reliability,
                        "fitness_score": fitness,
                        "currency_code": "USD",
                        "status": "PENDING",
                    }
                )
            candidates.append(row)

        primary_request = request_rows[0]
        selected_candidate = candidates[1]

        tx = await prisma.transaction.upsert(
            where={"request_id": primary_request.id},
            data={
                "create": {
                    "request_id": primary_request.id,
                    "selected_candidate_id": selected_candidate.id,
                    "status": "AWAITING_PAYMENT",
                },
                "update": {
                    "selected_candidate_id": selected_candidate.id,
                    "status": "AWAITING_PAYMENT",
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
                    "document_hash": "seeded-contract-v1",
                    "terms_json": Json(
                        {
                            "incoterm": "DAP",
                            "payment_terms": "50% upfront",
                            "warranty_days": 30,
                        }
                    ),
                },
                "update": {
                    "version": 1,
                    "document_hash": "seeded-contract-v1",
                    "terms_json": Json(
                        {
                            "incoterm": "DAP",
                            "payment_terms": "50% upfront",
                            "warranty_days": 30,
                        }
                    ),
                },
            },
        )

        for user, role in [
            (customer_user, "CUSTOMER"),
            (factory_user_1, "FACTORY"),
            (logist_user_2, "LOGIST"),
        ]:
            existing_sig = await prisma.signature.find_first(
                where={
                    "transaction_id": tx.id,
                    "user_id": user.id,
                }
            )
            if existing_sig:
                await prisma.signature.update(
                    where={"id": existing_sig.id},
                    data={
                        "role_at_signing": role,
                        "status": "PENDING",
                    },
                )
            else:
                await prisma.signature.create(
                    data={
                        "transaction_id": tx.id,
                        "user_id": user.id,
                        "role_at_signing": role,
                        "status": "PENDING",
                    }
                )

        existing_payment = await prisma.payment.find_first(
            where={
                "transaction_id": tx.id,
                "status": {"in": ["PENDING", "AUTHORIZED", "CAPTURED"]},
            }
        )
        payment_amount = selected_candidate.total_cost or Decimal("0")
        if existing_payment:
            await prisma.payment.update(
                where={"id": existing_payment.id},
                data={
                    "amount": payment_amount,
                    "currency_code": "USD",
                    "status": "AUTHORIZED",
                    "provider_reference": "seed-payment-001",
                },
            )
        else:
            await prisma.payment.create(
                data={
                    "transaction_id": tx.id,
                    "amount": payment_amount,
                    "currency_code": "USD",
                    "status": "AUTHORIZED",
                    "provider_reference": "seed-payment-001",
                }
            )

        for event_type, payload in [
            ("REQUEST_CREATED", {"request_id": primary_request.id}),
            ("CANDIDATE_SELECTED", {"candidate_id": selected_candidate.id}),
            ("TRANSACTION_CREATED", {"transaction_id": tx.id}),
            ("PAYMENT_AUTHORIZED", {"amount": str(payment_amount)}),
        ]:
            exists = await prisma.eventlog.find_first(
                where={
                    "transaction_id": tx.id,
                    "event_type": event_type,
                }
            )
            if not exists:
                await prisma.eventlog.create(
                    data={
                        "actor_user_id": admin_user.id,
                        "transaction_id": tx.id,
                        "entity_type": "Transaction",
                        "entity_id": tx.id,
                        "event_type": event_type,
                        "payload_json": Json(payload),
                    }
                )

        summary = {
            "categories": len(categories),
            "items": len(items),
            "inventory_entries": len(inventory_specs),
            "offers": 2,
            "requests": len(request_rows),
            "candidates": len(candidates),
        }

        print("Seed complete with schema-aligned cross references.")
        print(f"Summary: {summary}")
        print("Demo user password for all newly created users: password123")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    with_reference_geo = os.getenv("SEED_WITH_REFERENCE_GEO", "0").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    asyncio.run(seed(with_reference_geo=with_reference_geo))
