import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from db import prisma
from services.auth_db_guard import ensure_db_connection as _ensure_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])


class RegionItem(BaseModel):
    code: str
    name: str


class CityItem(BaseModel):
    id: str
    name: str
    region_code: str


class AddressBootstrapResponse(BaseModel):
    regions: list[RegionItem]
    cities: list[CityItem]


class CreateAddressPayload(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=2)
    region_name: str = Field(..., min_length=1, max_length=100)
    city_name: str = Field(..., min_length=1, max_length=100)
    street: str = Field(..., min_length=2, max_length=300)
    postal_code: str | None = Field(None, max_length=20)


class AddressResponse(BaseModel):
    id: str
    label: str


@router.get("/bootstrap", response_model=AddressBootstrapResponse)
async def address_bootstrap(country_code: str):
    normalized = country_code.strip().upper()
    country = await prisma.country.find_unique(where={"iso2": normalized})
    if not country:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Country not found")

    regions = await prisma.region.find_many(
        where={"country_id": country.id, "is_active": True},
        order={"default_name": "asc"},
    )
    if not regions:
        return AddressBootstrapResponse(regions=[], cities=[])

    region_ids = [r.id for r in regions]
    cities = await prisma.city.find_many(
        where={"region_id": {"in": region_ids}, "is_active": True},
        order={"default_name": "asc"},
    )
    region_code_by_id = {r.id: r.code for r in regions}

    return AddressBootstrapResponse(
        regions=[RegionItem(code=r.code, name=r.default_name) for r in regions],
        cities=[
            CityItem(id=c.id, name=c.default_name, region_code=region_code_by_id.get(c.region_id, ""))
            for c in cities
        ],
    )


async def resolve_or_create_address(
    country_code: str,
    region_name: str,
    city_name: str,
    street: str,
    postal_code: str | None,
) -> dict:
    normalized_cc = country_code.strip().upper()
    country = await prisma.country.find_unique(where={"iso2": normalized_cc})
    if not country:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Country not found")

    region_name_clean = region_name.strip()

    # Try to match existing region by name
    all_regions = await prisma.region.find_many(where={"country_id": country.id})
    region = next(
        (r for r in all_regions if r.default_name.lower() == region_name_clean.lower()),
        None,
    )

    if not region:
        # Generate a unique code from the region name
        base_code = region_name_clean[:10].upper().replace(" ", "_")
        used_codes = {r.code for r in all_regions}
        code = base_code
        suffix = 2
        while code in used_codes:
            code = f"{base_code[:8]}_{suffix}"
            suffix += 1
        region = await prisma.region.create(
            data={
                "country_id": country.id,
                "code": code,
                "default_name": region_name_clean,
                "is_active": True,
            }
        )

    city_name_clean = city_name.strip()

    # Try to match existing city by name
    all_cities = await prisma.city.find_many(where={"region_id": region.id})
    city = next(
        (c for c in all_cities if c.default_name.lower() == city_name_clean.lower()),
        None,
    )
    if not city:
        city = await prisma.city.create(
            data={
                "region_id": region.id,
                "default_name": city_name_clean,
                "is_active": True,
            }
        )

    street_clean = street.strip()

    # Upsert address row
    all_addrs = await prisma.address.find_many(
        where={
            "country_id": country.id,
            "region_id": region.id,
            "city_id": city.id,
            "street": street_clean,
        }
    )
    if all_addrs:
        addr = all_addrs[0]
    else:
        addr = await prisma.address.create(
            data={
                "country_id": country.id,
                "region_id": region.id,
                "city_id": city.id,
                "street": street_clean,
                "postal_code": postal_code,
            }
        )

    label = f"{street_clean}, {city.default_name}, {region.default_name}, {country.default_name}"
    return {"id": addr.id, "label": label}


@router.post("", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_address(payload: CreateAddressPayload):
    result = await resolve_or_create_address(
        country_code=payload.country_code,
        region_name=payload.region_name,
        city_name=payload.city_name,
        street=payload.street,
        postal_code=payload.postal_code,
    )
    return AddressResponse(id=result["id"], label=result["label"])
