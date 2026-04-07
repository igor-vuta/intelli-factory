from __future__ import annotations

from decimal import Decimal

from argon2 import PasswordHasher
from prisma import Json, Prisma


_argon2_hasher = PasswordHasher()


def _hash_password(password: str) -> str:
    return _argon2_hasher.hash(password)


async def _ensure_region(prisma: Prisma, country_id: str, code: str, default_name: str):
    row = await prisma.region.find_first(where={"country_id": country_id, "code": code})
    if row:
        return await prisma.region.update(
            where={"id": row.id},
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
    row = await prisma.city.find_first(where={"region_id": region_id, "default_name": default_name})
    if row:
        return await prisma.city.update(
            where={"id": row.id},
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


async def _ensure_currency(
    prisma: Prisma,
    code: str,
    name: str,
    symbol: str,
    decimals: int,
    is_base_currency: bool,
    exchange_rate_to_base: Decimal,
):
    return await prisma.currency.upsert(
        where={"code": code},
        data={
            "create": {
                "code": code,
                "name": name,
                "symbol": symbol,
                "decimals": decimals,
                "is_base_currency": is_base_currency,
                "exchange_rate_to_base": exchange_rate_to_base,
            },
            "update": {
                "name": name,
                "symbol": symbol,
                "decimals": decimals,
                "is_base_currency": is_base_currency,
                "exchange_rate_to_base": exchange_rate_to_base,
            },
        },
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


async def _ensure_item(
    prisma: Prisma,
    category_id: str,
    name: str,
    unit: str,
    characteristics_schema: dict | None = None,
):
    normalized_name = name.lower().strip().replace(" ", "-")
    existing = await prisma.item.find_first(
        where={
            "category_id": category_id,
            "normalized_name": normalized_name,
        }
    )
    if existing:
        return await prisma.item.update(
            where={"id": existing.id},
            data={
                "name": name,
                "unit": unit,
                "characteristics_schema": Json(characteristics_schema)
                if characteristics_schema is not None
                else None,
                "status": "ACTIVE",
                "deleted_at": None,
            },
        )
    return await prisma.item.create(
        data={
            "category_id": category_id,
            "name": name,
            "normalized_name": normalized_name,
            "unit": unit,
            "characteristics_schema": Json(characteristics_schema)
            if characteristics_schema is not None
            else None,
            "status": "ACTIVE",
        }
    )


async def _ensure_user(prisma: Prisma, email: str, role: str):
    row = await prisma.user.find_unique(where={"email": email})
    if row:
        return row
    return await prisma.user.create(
        data={
            "email": email,
            "password_hash": _hash_password("password123"),
            "role": role,
            "is_email_verified": True,
        }
    )


async def _ensure_inventory(
    prisma: Prisma,
    factory_profile_id: str,
    item_id: str,
    stock_address_id: str,
    quantity: Decimal,
    price: Decimal,
    currency_code: str,
    characteristics_json: dict,
):
    existing = await prisma.inventoryentry.find_first(
        where={
            "factory_profile_id": factory_profile_id,
            "item_id": item_id,
            "stock_address_id": stock_address_id,
            "deleted_at": None,
        }
    )
    if existing:
        return await prisma.inventoryentry.update(
            where={"id": existing.id},
            data={
                "quantity_available": quantity,
                "price_per_unit": price,
                "currency_code": currency_code,
                "characteristics_json": Json(characteristics_json),
                "status": "ACTIVE",
                "deleted_at": None,
            },
        )
    return await prisma.inventoryentry.create(
        data={
            "factory_profile_id": factory_profile_id,
            "item_id": item_id,
            "stock_address_id": stock_address_id,
            "quantity_available": quantity,
            "price_per_unit": price,
            "currency_code": currency_code,
            "characteristics_json": Json(characteristics_json),
            "status": "ACTIVE",
        }
    )


async def _ensure_logistic_offer(
    prisma: Prisma,
    logist_profile_id: str,
    title: str,
    description: str,
    base_price: Decimal,
    price_per_km: Decimal,
    price_per_kg: Decimal,
    days_min: int,
    days_max: int,
    reliability_score: float,
    currency_code: str,
):
    existing = await prisma.logisticoffer.find_first(
        where={
            "logist_profile_id": logist_profile_id,
            "title": title,
            "deleted_at": None,
        }
    )
    if existing:
        return await prisma.logisticoffer.update(
            where={"id": existing.id},
            data={
                "description": description,
                "base_price": base_price,
                "price_per_km": price_per_km,
                "price_per_kg": price_per_kg,
                "estimated_days_min": days_min,
                "estimated_days_max": days_max,
                "reliability_score": reliability_score,
                "currency_code": currency_code,
                "status": "ACTIVE",
                "deleted_at": None,
            },
        )
    return await prisma.logisticoffer.create(
        data={
            "logist_profile_id": logist_profile_id,
            "title": title,
            "description": description,
            "base_price": base_price,
            "price_per_km": price_per_km,
            "price_per_kg": price_per_kg,
            "estimated_days_min": days_min,
            "estimated_days_max": days_max,
            "reliability_score": reliability_score,
            "currency_code": currency_code,
            "status": "ACTIVE",
        }
    )


async def _ensure_coverage(
    prisma: Prisma,
    offer_id: str,
    country_id: str,
    region_id: str,
    city_id: str,
):
    existing = await prisma.logisticscoveragearea.find_first(
        where={
            "logistic_offer_id": offer_id,
            "country_id": country_id,
            "region_id": region_id,
            "city_id": city_id,
            "deleted_at": None,
        }
    )
    if existing:
        return await prisma.logisticscoveragearea.update(
            where={"id": existing.id},
            data={"status": "ACTIVE", "deleted_at": None},
        )
    return await prisma.logisticscoveragearea.create(
        data={
            "logistic_offer_id": offer_id,
            "country_id": country_id,
            "region_id": region_id,
            "city_id": city_id,
            "status": "ACTIVE",
        }
    )