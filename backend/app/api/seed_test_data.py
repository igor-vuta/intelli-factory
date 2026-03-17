"""Seed practical test data for local end-to-end workflow.

Run from backend/app/api:
    poetry run python seed_test_data.py
"""

from __future__ import annotations

import asyncio
import hashlib
import secrets
from decimal import Decimal

from prisma import Prisma


def _hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password_bytes, salt, 600_000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


async def _ensure_region(prisma: Prisma, country_id: str, code: str, default_name: str):
    region = await prisma.region.find_first(where={"country_id": country_id, "code": code})
    if region:
        return await prisma.region.update(
            where={"id": region.id},
            data={"default_name": default_name, "is_active": True},
        )
    return await prisma.region.create(
        data={
            "country_id": country_id,
            "code": code,
            "default_name": default_name,
            "is_active": True,
        }
    )


async def _ensure_city(prisma: Prisma, region_id: str, default_name: str):
    city = await prisma.city.find_first(where={"region_id": region_id, "default_name": default_name})
    if city:
        return await prisma.city.update(
            where={"id": city.id},
            data={"is_active": True},
        )
    return await prisma.city.create(
        data={
            "region_id": region_id,
            "default_name": default_name,
            "is_active": True,
        }
    )


async def _ensure_address(
    prisma: Prisma,
    country_id: str,
    region_id: str,
    city_id: str,
    street: str,
    postal_code: str,
):
    row = await prisma.address.find_first(
        where={
            "country_id": country_id,
            "region_id": region_id,
            "city_id": city_id,
            "street": street,
            "deleted_at": None,
        }
    )
    if row:
        return row
    return await prisma.address.create(
        data={
            "country_id": country_id,
            "region_id": region_id,
            "city_id": city_id,
            "street": street,
            "postal_code": postal_code,
        }
    )


async def _ensure_category(prisma: Prisma, slug: str, default_name: str):
    return await prisma.category.upsert(
        where={"slug": slug},
        data={
            "create": {
                "slug": slug,
                "default_name": default_name,
                "status": "ACTIVE",
            },
            "update": {
                "default_name": default_name,
                "status": "ACTIVE",
                "deleted_at": None,
            },
        },
    )


async def _ensure_item(prisma: Prisma, category_id: str, name: str, unit: str):
    normalized_name = name.lower().strip().replace(" ", "-")
    item = await prisma.item.find_first(
        where={
            "category_id": category_id,
            "normalized_name": normalized_name,
        }
    )
    if item:
        return await prisma.item.update(
            where={"id": item.id},
            data={"name": name, "unit": unit, "status": "ACTIVE", "deleted_at": None},
        )
    return await prisma.item.create(
        data={
            "category_id": category_id,
            "name": name,
            "normalized_name": normalized_name,
            "unit": unit,
            "status": "ACTIVE",
        }
    )


async def _ensure_user(prisma: Prisma, email: str, role: str):
    existing = await prisma.user.find_unique(where={"email": email})
    if existing:
        return existing

    return await prisma.user.create(
        data={
            "email": email,
            "password_hash": _hash_password("password123"),
            "role": role,
            "is_email_verified": True,
        }
    )


async def seed() -> None:
    prisma = Prisma()
    await prisma.connect()

    try:
        country_kz = await prisma.country.find_unique(where={"iso2": "KZ"})
        if not country_kz:
            raise RuntimeError("Country KZ not found. Run seed_reference_geo.py first")

        region_almaty = await _ensure_region(prisma, country_kz.id, "ALA", "Almaty Region")
        region_astana = await _ensure_region(prisma, country_kz.id, "AST", "Astana Region")

        city_almaty = await _ensure_city(prisma, region_almaty.id, "Almaty")
        city_astana = await _ensure_city(prisma, region_astana.id, "Astana")

        addr_almaty = await _ensure_address(
            prisma,
            country_kz.id,
            region_almaty.id,
            city_almaty.id,
            "Abay Ave 10",
            "050000",
        )
        addr_almaty_2 = await _ensure_address(
            prisma,
            country_kz.id,
            region_almaty.id,
            city_almaty.id,
            "Dostyk Ave 42",
            "050051",
        )
        addr_astana = await _ensure_address(
            prisma,
            country_kz.id,
            region_astana.id,
            city_astana.id,
            "Mangilik El 15",
            "010000",
        )

        for code, name, symbol, decimals, is_base, rate in [
            ("USD", "US Dollar", "$", 2, True, Decimal("1.0")),
            ("KZT", "Kazakhstani Tenge", "₸", 2, False, Decimal("0.0022")),
            ("EUR", "Euro", "€", 2, False, Decimal("1.08")),
        ]:
            await prisma.currency.upsert(
                where={"code": code},
                data={
                    "create": {
                        "code": code,
                        "name": name,
                        "symbol": symbol,
                        "decimals": decimals,
                        "is_base_currency": is_base,
                        "exchange_rate_to_base": rate,
                    },
                    "update": {
                        "name": name,
                        "symbol": symbol,
                        "decimals": decimals,
                        "is_base_currency": is_base,
                        "exchange_rate_to_base": rate,
                    },
                },
            )

        cat_textile = await _ensure_category(prisma, "textile", "Textile")
        cat_electronics = await _ensure_category(prisma, "electronics", "Electronics")
        cat_food = await _ensure_category(prisma, "food", "Food")

        item_textile = await _ensure_item(prisma, cat_textile.id, "Cotton T-Shirt", "pcs")
        await _ensure_item(prisma, cat_textile.id, "Silk Scarf", "pcs")
        await _ensure_item(prisma, cat_electronics.id, "Power Supply", "pcs")
        await _ensure_item(prisma, cat_food.id, "Pasta", "kg")

        factory_user = await _ensure_user(prisma, "factory.demo@intelli.local", "FACTORY")
        logist_user = await _ensure_user(prisma, "logist.demo@intelli.local", "LOGIST")
        customer_user = await _ensure_user(prisma, "customer.demo@intelli.local", "CUSTOMER")
        await _ensure_user(prisma, "admin.demo@intelli.local", "ADMIN")

        customer_profile = await prisma.customerprofile.find_unique(where={"user_id": customer_user.id})
        if not customer_profile:
            customer_profile = await prisma.customerprofile.create(
                data={
                    "user_id": customer_user.id,
                    "display_name": "Customer Demo",
                    "registration_country_code": "KZ",
                    "primary_address_id": addr_almaty.id,
                }
            )
        elif customer_profile.primary_address_id is None:
            customer_profile = await prisma.customerprofile.update(
                where={"id": customer_profile.id},
                data={"primary_address_id": addr_almaty.id},
            )

        factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": factory_user.id})
        if not factory_profile:
            factory_profile = await prisma.factoryprofile.create(
                data={
                    "user_id": factory_user.id,
                    "legal_name": "Factory Demo",
                    "registration_country_code": "KZ",
                    "primary_address_id": addr_almaty_2.id,
                }
            )
        elif factory_profile.primary_address_id is None:
            factory_profile = await prisma.factoryprofile.update(
                where={"id": factory_profile.id},
                data={"primary_address_id": addr_almaty_2.id},
            )

        logist_profile = await prisma.logistprofile.find_unique(where={"user_id": logist_user.id})
        if not logist_profile:
            logist_profile = await prisma.logistprofile.create(
                data={
                    "user_id": logist_user.id,
                    "company_name": "Logistics Demo",
                    "registration_country_code": "KZ",
                    "primary_address_id": addr_astana.id,
                }
            )
        elif logist_profile.primary_address_id is None:
            logist_profile = await prisma.logistprofile.update(
                where={"id": logist_profile.id},
                data={"primary_address_id": addr_astana.id},
            )

        existing_req = await prisma.request.find_first(
            where={
                "customer_profile_id": customer_profile.id,
                "status": "PENDING",
                "deleted_at": None,
            }
        )
        if not existing_req:
            await prisma.request.create(
                data={
                    "customer_profile_id": customer_profile.id,
                    "category_id": cat_textile.id,
                    "item_id": item_textile.id,
                    "requested_name_text": "Cotton T-Shirt batch",
                    "quantity": Decimal("150"),
                    "destination_address_id": addr_almaty.id,
                    "preferred_currency_code": "USD",
                    "status": "PENDING",
                }
            )

        existing_inventory = await prisma.inventoryentry.find_first(
            where={
                "factory_profile_id": factory_profile.id,
                "item_id": item_textile.id,
                "deleted_at": None,
            }
        )
        if not existing_inventory:
            await prisma.inventoryentry.create(
                data={
                    "factory_profile_id": factory_profile.id,
                    "item_id": item_textile.id,
                    "stock_address_id": addr_almaty_2.id,
                    "quantity_available": Decimal("1000"),
                    "price_per_unit": Decimal("24.50"),
                    "currency_code": "USD",
                    "status": "ACTIVE",
                }
            )

        existing_offer = await prisma.logisticoffer.find_first(
            where={
                "logist_profile_id": logist_profile.id,
                "title": "Regional delivery offer",
                "deleted_at": None,
            }
        )
        if not existing_offer:
            await prisma.logisticoffer.create(
                data={
                    "logist_profile_id": logist_profile.id,
                    "title": "Regional delivery offer",
                    "description": "Standard delivery for Almaty and Astana",
                    "base_price": Decimal("40"),
                    "price_per_km": Decimal("1.2"),
                    "price_per_kg": Decimal("0.6"),
                    "estimated_days_min": 2,
                    "estimated_days_max": 5,
                    "reliability_score": 0.92,
                    "currency_code": "USD",
                    "status": "ACTIVE",
                }
            )

        print("Seed complete.")
        print("Demo accounts (if newly created) password: password123")
        print("- customer.demo@intelli.local  (CUSTOMER)")
        print("- factory.demo@intelli.local   (FACTORY)")
        print("- logist.demo@intelli.local    (LOGIST)")
        print("- admin.demo@intelli.local     (ADMIN)")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())
