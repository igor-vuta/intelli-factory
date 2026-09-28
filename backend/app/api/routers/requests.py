from decimal import Decimal, InvalidOperation
import re
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, ValidationError
from prisma import Json

from db import prisma
from routers.addresses import matches_name
from routers.auth import SESSION_COOKIE_NAME, _ensure_db_connection, _get_user_by_session_token, _now
from routers.ratings import get_computed_reliability
from services.category_governance import (
    SUPPORTED_UNITS,
    catalogue_lock,
    eligible_category,
    require_verified,
    validate_attributes,
    validate_identity,
    validate_publication,
)

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])

UserRole = Literal["CUSTOMER", "FACTORY", "LOGIST", "ADMIN"]


class RequestSummaryResponse(BaseModel):
    id: str
    customer_profile_id: str
    category_id: str
    category_name: str | None
    item_id: str | None
    item_name: str | None
    requested_name_text: str | None
    quantity: str
    quantity_unit: str
    destination_address_id: str
    preferred_currency_code: str
    status: str
    created_at: str


class CreateRequestBody(BaseModel):
    category_id: str | None = None
    item_id: str | None = None
    requested_characteristics_json: dict[str, Any] | None = None
    quantity: float = Field(..., gt=0, allow_inf_nan=False)
    quantity_unit: str = Field(default="pcs", min_length=1, max_length=20)
    destination_address_id: str | None = None
    destination_country_code: str | None = Field(default=None, min_length=2, max_length=2)
    destination_region_name: str | None = Field(default=None, min_length=2, max_length=120)
    destination_city_name: str | None = Field(default=None, min_length=2, max_length=120)
    destination_street: str | None = Field(default=None, min_length=3, max_length=300)
    preferred_currency_code: str = Field(default="USD", min_length=3, max_length=3)


class CreateRequestResponse(BaseModel):
    status: str
    request_id: str
    message: str


class UpdateRequestStatusBody(BaseModel):
    status: str = Field(..., min_length=3, max_length=40)


class MessageResponse(BaseModel):
    status: str
    message: str


class UpdateRequestBody(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    preferred_currency_code: str | None = Field(default=None, min_length=3, max_length=3)


class UpdateInventoryEntryBody(BaseModel):
    quantity_available: float | None = Field(default=None, gt=0)
    price_per_unit: float | None = Field(default=None, gt=0)


class UpdateLogisticOfferBody(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    base_price: float | None = Field(default=None, ge=0)
    estimated_days_min: int | None = Field(default=None, ge=0)
    estimated_days_max: int | None = Field(default=None, ge=0)


class UpdateInventoryEntryStatusBody(BaseModel):
    status: str = Field(..., min_length=3, max_length=40)


class InventoryEntryCreateBody(BaseModel):
    # A shared catalogue product; create a missing one first through /catalogue/items.
    item_id: str | None = None
    category_id: str | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    stock_address_id: str | None = None
    stock_country_code: str | None = Field(default=None, min_length=2, max_length=2)
    stock_region_name: str | None = Field(default=None, min_length=2, max_length=120)
    stock_city_name: str | None = Field(default=None, min_length=2, max_length=120)
    stock_street: str | None = Field(default=None, min_length=3, max_length=300)
    quantity_available: float = Field(..., gt=0, allow_inf_nan=False)
    price_per_unit: float = Field(..., gt=0, allow_inf_nan=False)
    currency_code: str = Field(..., min_length=3, max_length=3)
    characteristics_json: dict[str, Any] | None = None


class LogisticOfferCreateBody(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    base_price: float = Field(..., ge=0)
    price_per_km: float | None = Field(default=None, ge=0)
    price_per_kg: float | None = Field(default=None, ge=0)
    estimated_days_min: int | None = Field(default=None, ge=0)
    estimated_days_max: int | None = Field(default=None, ge=0)
    currency_code: str = Field(..., min_length=3, max_length=3)


def _to_decimal(value: float) -> Decimal:
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid decimal value",
        ) from exc


def _validate_uuid(value: str | None, field_name: str, *, required: bool = False) -> str | None:
    if value is None:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_name} is required",
            )
        return None

    candidate = value.strip()
    if not candidate:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_name} is required",
            )
        return None

    try:
        return str(UUID(candidate))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} must be a valid UUID",
        ) from exc


def _norm_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _norm_for_match(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _slugify_geo_name(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug


async def _resolve_or_create_address(
    *,
    address_id: str | None,
    country_code: str | None,
    region_name: str | None,
    city_name: str | None,
    street: str | None,
    address_field_name: str,
    db=None,
) -> str | None:
    db = db or prisma
    normalized_address_id = _validate_uuid(address_id, address_field_name)
    if normalized_address_id:
        row = await db.address.find_first(
            where={"id": normalized_address_id, "deleted_at": None}
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
        return row.id

    normalized_country_code = _norm_text(country_code)
    normalized_region_name = _norm_text(region_name)
    normalized_city_name = _norm_text(city_name)
    normalized_street = _norm_text(street)

    any_manual = any(
        [normalized_country_code, normalized_region_name, normalized_city_name, normalized_street]
    )
    if not any_manual:
        return None

    if not all([normalized_country_code, normalized_region_name, normalized_city_name, normalized_street]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"When {address_field_name} is not provided, all manual address fields are required: "
                "country_code, region_name, city_name, street"
            ),
        )

    country = await db.country.find_unique(where={"iso2": normalized_country_code.upper()})
    if not country or not country.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported country code for manual address",
        )

    region_rows = await db.region.find_many(
        where={"country_id": country.id, "is_active": True},
        include={"translations": True},
    )
    region = next(
        (r for r in region_rows if matches_name(r, normalized_region_name)),
        None,
    )
    if not region:
        existing_codes = {row.code.upper() for row in region_rows}
        base = (_slugify_geo_name(normalized_region_name).upper() or "REG")[:12]
        candidate_code = base
        suffix = 1
        while candidate_code in existing_codes:
            suffix += 1
            candidate_code = f"{base[:9]}-{suffix}"
        region = await db.region.create(
            data={
                "country": {"connect": {"id": country.id}},
                "code": candidate_code,
                "default_name": normalized_region_name,
                "is_active": True,
            }
        )

    city_rows = await db.city.find_many(
        where={"region_id": region.id, "is_active": True},
        include={"translations": True},
    )
    city = next(
        (c for c in city_rows if matches_name(c, normalized_city_name)),
        None,
    )
    if not city:
        city = await db.city.create(
            data={
                "region": {"connect": {"id": region.id}},
                "default_name": normalized_city_name,
                "is_active": True,
            }
        )

    address_rows = await db.address.find_many(
        where={
            "country_id": country.id,
            "region_id": region.id,
            "city_id": city.id,
            "deleted_at": None,
        },
        take=500,
    )
    existing_address = next(
        (a for a in address_rows if _norm_for_match(a.street) == _norm_for_match(normalized_street)),
        None,
    )
    if existing_address:
        return existing_address.id

    created = await db.address.create(
        data={
            "country": {"connect": {"id": country.id}},
            "region": {"connect": {"id": region.id}},
            "city": {"connect": {"id": city.id}},
            "street": normalized_street,
        }
    )
    return created.id


async def _require_authenticated_user(request: Request):
    raw_session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_agent = request.headers.get("user-agent")
    user_and_session = await _get_user_by_session_token(raw_session_token, user_agent)
    if not user_and_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user, session = user_and_session
    await prisma.session.update(where={"id": session.id}, data={"last_seen_at": _now()})
    return user


def require_roles(*allowed_roles: UserRole):
    async def dependency(user=Depends(_require_authenticated_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' cannot access this endpoint",
            )
        return user

    return dependency


@router.get("/bootstrap")
async def bootstrap(locale: Literal["en", "ru", "kk"] = "en", user=Depends(_require_authenticated_user)):
    categories = await prisma.category.find_many(
        where={"deleted_at": None, "status": "ACTIVE"},
        order={"default_name": "asc"},
        include={"translations": True},
    )
    items = await prisma.item.find_many(
        where={"deleted_at": None, "status": "ACTIVE"},
        order={"name": "asc"},
        take=200,
    )
    currencies = await prisma.currency.find_many(order={"code": "asc"}, take=20)
    countries = await prisma.country.find_many(
        where={"is_active": True},
        order={"default_name": "asc"},
        take=250,
    )

    profile_primary_address_id: str | None = None
    profile_registration_country_code: str | None = None
    profile_registration_address: str | None = None
    if user.role == "CUSTOMER":
        profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
        if profile:
            profile_primary_address_id = profile.primary_address_id
            profile_registration_country_code = profile.registration_country_code
            profile_registration_address = profile.registration_address
    elif user.role == "FACTORY":
        profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
        if profile:
            profile_primary_address_id = profile.primary_address_id
            profile_registration_country_code = profile.registration_country_code
            profile_registration_address = profile.registration_address
    elif user.role == "LOGIST":
        profile = await prisma.logistprofile.find_unique(where={"user_id": user.id})
        if profile:
            profile_primary_address_id = profile.primary_address_id
            profile_registration_country_code = profile.registration_country_code
            profile_registration_address = profile.registration_address

    # Collect address IDs that belong to this user, either their primary address or destination address from the past.
    user_address_ids: set[str] = set()
    if profile_primary_address_id:
        user_address_ids.add(profile_primary_address_id)

    if user.role == "CUSTOMER" and profile:
        past_requests = await prisma.request.find_many(
            where={"customer_profile_id": profile.id, "deleted_at": None},
            take=200,
        )
        for req in past_requests:
            if req.destination_address_id:
                user_address_ids.add(req.destination_address_id)

    if user_address_ids:
        addresses = await prisma.address.find_many(
            where={"id": {"in": list(user_address_ids)}, "deleted_at": None},
            include={"country": True, "region": True, "city": True},
        )
    else:
        addresses = []

    if profile_primary_address_id:
        addresses.sort(key=lambda a: 0 if a.id == profile_primary_address_id else 1)

    return {
        "categories": [
            {"id": category.id, "name": next((t.name for t in (getattr(category, "translations", None) or []) if t.locale == locale), category.default_name), "slug": category.slug, "parent_id": getattr(category, "parent_id", None), "attributes_schema": getattr(category, "attributes_schema", None)}
            for category in categories
        ],
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "category_id": item.category_id,
                "unit": item.unit,
                "characteristics_schema": getattr(item, "characteristics_schema", None),
            }
            for item in items if item.category_id in {c.id for c in categories}
        ],
        "currencies": [{"code": currency.code, "name": currency.name} for currency in currencies],
        "countries": [
            {"code": country.iso2, "name": country.default_name}
            for country in countries
        ],
        "addresses": [
            {
                "id": address.id,
                "label": (
                    f"{address.street}, {address.city.default_name}, "
                    f"{address.region.default_name}, {address.country.default_name}"
                ),
            }
            for address in addresses
        ],
        "user": {
            "id": user.id,
            "role": user.role,
            "is_email_verified": user.is_email_verified,
            "primary_address_id": profile_primary_address_id,
            "registration_country_code": profile_registration_country_code,
            "registration_address": profile_registration_address,
        },
    }


@router.post("/", response_model=CreateRequestResponse)
async def create_request(
    payload: CreateRequestBody,
    user=Depends(require_roles("CUSTOMER")),
):
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification is required before creating requests",
        )

    customer_profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
    if not customer_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer profile not found")

    # New requests name a shared catalogue product by ID (create it first through /catalogue/items
    # if it is missing); older free-text requests stay readable and keep matching as before.
    if not payload.item_id:
        raise HTTPException(422, "Choose a product from the catalogue, or create it first")
    item_id = _validate_uuid(payload.item_id, "item_id", required=True)
    item = await prisma.item.find_first(
        where={"id": item_id, "deleted_at": None, "status": "ACTIVE", "merged_into_id": None}
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    category_id = _validate_uuid(payload.category_id, "category_id") or item.category_id
    if category_id != item.category_id:
        raise HTTPException(422, "Item and category must agree")
    if payload.quantity_unit not in SUPPORTED_UNITS or item.unit != payload.quantity_unit:
        raise HTTPException(422, "Choose the product's supported quantity unit")
    destination_address_id = await _destination_address(customer_profile, payload)
    created_request = await _insert_request(
        prisma,
        customer_profile,
        item,
        quantity=payload.quantity,
        currency_code=payload.preferred_currency_code,
        destination_address_id=destination_address_id,
        characteristics=payload.requested_characteristics_json,
    )
    return CreateRequestResponse(
        status="success",
        request_id=created_request.id,
        message="Request created successfully",
    )


class PendingProduct(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    locale: Literal["en", "ru", "kk"]
    unit: str
    attributes: dict[str, str] = Field(default_factory=dict, max_length=12)


class PendingCategory(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=5, max_length=1000)
    parent_id: str | None = None


class CreatePendingRequestBody(BaseModel):
    category: PendingCategory
    product: PendingProduct
    requested_characteristics_json: dict[str, Any] | None = None
    quantity: float = Field(..., gt=0, allow_inf_nan=False)
    destination_address_id: str | None = None
    destination_country_code: str | None = Field(default=None, min_length=2, max_length=2)
    destination_region_name: str | None = Field(default=None, min_length=2, max_length=120)
    destination_city_name: str | None = Field(default=None, min_length=2, max_length=120)
    destination_street: str | None = Field(default=None, min_length=3, max_length=300)
    preferred_currency_code: str = Field(default="USD", min_length=3, max_length=3)


@router.post("/pending", status_code=201)
async def create_pending_request(
    payload: CreatePendingRequestBody, user=Depends(require_roles("CUSTOMER"))
):
    """A request for a product whose category doesn't exist yet: proposes the category and keeps
    the request, which goes live on its own when an administrator approves the category."""
    from routers.catalogue import ItemBody
    from routers.categories import ProposalBody, create_proposal

    require_verified(user)
    customer_profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
    if not customer_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer profile not found")
    try:
        # The same product rules apply now as when it is created on approval.
        ItemBody(**payload.product.model_dump(), category_id=uuid4())
        proposal_body = ProposalBody(**payload.category.model_dump())
    except ValidationError as exc:
        raise HTTPException(422, exc.errors()[0]["msg"]) from None
    currency_code = payload.preferred_currency_code.upper()
    if not await prisma.currency.find_unique(where={"code": currency_code}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")
    destination_address_id = await _destination_address(customer_profile, payload)
    async with prisma.tx() as tx:
        proposal = await create_proposal(tx, proposal_body, user)
        pending = await tx.pendingrequest.create(
            data={
                "customer_profile_id": customer_profile.id,
                "proposal_id": proposal.id,
                "data": Json(
                    {
                        "product": payload.product.model_dump(),
                        "quantity": payload.quantity,
                        "currency_code": currency_code,
                        "destination_address_id": destination_address_id,
                        "characteristics": payload.requested_characteristics_json or {},
                    }
                ),
            }
        )
    return {"status": "success", "pending_request_id": pending.id, "proposal_id": proposal.id}


@router.get("/pending")
async def list_pending_requests(user=Depends(require_roles("CUSTOMER"))):
    customer_profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
    if not customer_profile:
        return []
    rows = await prisma.pendingrequest.find_many(
        where={"customer_profile_id": customer_profile.id, "status": {"not": "PUBLISHED"}},
        include={"proposal": True},
        order={"created_at": "desc"},
    )
    return [
        {
            "id": row.id,
            "status": row.status,
            "note": row.note,
            "category_name": row.proposal.name if row.proposal else None,
            "product_name": row.data["product"]["name"],
            "unit": row.data["product"]["unit"],
            "quantity": row.data["quantity"],
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.delete("/pending/{pending_id}", response_model=MessageResponse)
async def cancel_pending_request(pending_id: str, user=Depends(require_roles("CUSTOMER"))):
    customer_profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
    row = await prisma.pendingrequest.find_first(
        where={
            "id": _validate_uuid(pending_id, "pending_id", required=True),
            "customer_profile_id": customer_profile.id if customer_profile else "",
        }
    )
    if not row or row.status == "PUBLISHED":
        raise HTTPException(404, "Waiting request not found")
    await prisma.pendingrequest.delete(where={"id": row.id})
    return MessageResponse(status="success", message="Waiting request removed")


async def settle_pending_requests(proposal) -> None:
    """Publishes the requests that waited for an approved category (creating or reusing their
    product in it), or marks them rejected with the reviewer's note. Each request is settled on
    its own, so one that no longer validates doesn't hold back the others or the decision."""
    from routers.catalogue import ItemBody, create_locked

    rows = await prisma.pendingrequest.find_many(
        where={"proposal_id": proposal.id, "status": {"in": ["WAITING", "FAILED"]}}
    )
    if proposal.status == "REJECTED":
        for row in rows:
            await prisma.pendingrequest.update(
                where={"id": row.id}, data={"status": "REJECTED", "note": proposal.decision_note}
            )
        return
    if proposal.status != "APPROVED" or not proposal.category_id:
        return
    for row in rows:
        data = row.data
        try:
            async with prisma.tx() as tx:
                await catalogue_lock(tx)
                profile = await tx.customerprofile.find_unique(
                    where={"id": row.customer_profile_id}, include={"user": True}
                )
                product = ItemBody(**data["product"], category_id=proposal.category_id)
                created = await create_locked(tx, "items", product, profile.user)
                item = await tx.item.find_unique(where={"id": created["id"]})
                request = await _insert_request(
                    tx,
                    profile,
                    item,
                    quantity=data["quantity"],
                    currency_code=data["currency_code"],
                    destination_address_id=data["destination_address_id"],
                    characteristics=data["characteristics"],
                )
                await tx.pendingrequest.update(
                    where={"id": row.id},
                    data={"status": "PUBLISHED", "request_id": request.id, "note": None},
                )
        except (HTTPException, ValidationError) as exc:
            note = exc.detail if isinstance(exc, HTTPException) else str(exc.errors()[0]["msg"])
            await prisma.pendingrequest.update(
                where={"id": row.id}, data={"status": "FAILED", "note": str(note)}
            )


async def _destination_address(customer_profile, payload) -> str:
    """The chosen or typed destination, falling back to the customer's primary address."""
    destination_address_id = await _resolve_or_create_address(
        address_id=payload.destination_address_id,
        country_code=payload.destination_country_code,
        region_name=payload.destination_region_name,
        city_name=payload.destination_city_name,
        street=payload.destination_street,
        address_field_name="destination_address_id",
    )
    if not destination_address_id:
        destination_address_id = customer_profile.primary_address_id
    if not destination_address_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "destination_address_id is required because no primary_address_id "
                "is set on customer profile"
            ),
        )
    return destination_address_id


async def _insert_request(
    db, customer_profile, item, *, quantity, currency_code, destination_address_id, characteristics
):
    """Validates and stores a request for a catalogue product (used directly and when a request
    that waited for its category is published)."""
    category = await db.category.find_first(
        where={"id": item.category_id, "deleted_at": None, "status": "ACTIVE"}
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await eligible_category(db, category.id)
    validate_attributes(getattr(category, "attributes_schema", None), characteristics)
    validate_attributes(item.characteristics_schema, characteristics)
    validate_identity(item, characteristics)
    destination_address = await db.address.find_first(
        where={"id": destination_address_id, "deleted_at": None}
    )
    if not destination_address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination address not found")
    currency_code = currency_code.upper()
    if not await db.currency.find_unique(where={"code": currency_code}):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")
    return await db.request.create(
        data={
            "customer_profile": {"connect": {"id": customer_profile.id}},
            "category": {"connect": {"id": category.id}},
            "item": {"connect": {"id": item.id}},
            "quantity": _to_decimal(quantity),
            "destination_address": {"connect": {"id": destination_address.id}},
            "preferred_currency": {"connect": {"code": currency_code}},
            "status": "PENDING",
            "requested_characteristics_json": Json(
                {**(characteristics or {}), "quantity_unit": item.unit}
            ),
        }
    )


@router.get("/", response_model=list[RequestSummaryResponse])
async def list_requests(
    request_status: str | None = Query(default=None, alias="status"),
    user=Depends(_require_authenticated_user),
):
    where: dict[str, Any] = {"deleted_at": None}

    if request_status:
        where["status"] = request_status.upper()

    if user.role == "CUSTOMER":
        customer_profile = await prisma.customerprofile.find_unique(where={"user_id": user.id})
        if not customer_profile:
            return []
        where["customer_profile_id"] = customer_profile.id

    requests = await prisma.request.find_many(
        where=where,
        include={"item": True, "category": True},
        order={"created_at": "desc"},
        take=100,
    )

    return [
        RequestSummaryResponse(
            id=row.id,
            customer_profile_id=row.customer_profile_id,
            category_id=row.category_id,
            category_name=row.category.default_name if row.category else None,
            item_id=row.item_id,
            item_name=row.item.name if row.item else None,
            requested_name_text=row.requested_name_text,
            quantity=str(row.quantity),
            quantity_unit=(
                row.item.unit
                if row.item and row.item.unit
                else str((row.requested_characteristics_json or {}).get("quantity_unit") or "pcs")
            ),
            destination_address_id=row.destination_address_id,
            preferred_currency_code=row.preferred_currency_code,
            status=row.status,
            created_at=row.created_at.isoformat(),
        )
        for row in requests
    ]


# Before a contract exists a customer may pause, resume, edit (until the first bid), cancel or
# delete their request. From CONTRACT_DRAFTED on, the transaction owns the lifecycle.
SEARCHING_STATUSES = ("PENDING", "PAIRING_IN_PROGRESS")
PRE_CONTRACT_STATUSES = (*SEARCHING_STATUSES, "PAUSED", "MATCHED")


async def _own_request(request_id: str, user):
    """The customer's own, not deleted request, or 404/403."""
    target = await prisma.request.find_unique(
        where={"id": request_id},
        include={"customer_profile": True},
    )
    if not target or target.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if target.customer_profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return target


async def _live_candidate_count(request_id: str) -> int:
    return await prisma.matchcandidate.count(
        where={"request_id": request_id, "deleted_at": None, "status": "PENDING"}
    )


@router.patch("/{request_id}/status", response_model=MessageResponse)
async def update_request_status(
    request_id: str,
    payload: UpdateRequestStatusBody,
    user=Depends(_require_authenticated_user),
):
    target_request = await prisma.request.find_unique(
        where={"id": request_id},
        include={"customer_profile": True},
    )
    if not target_request or target_request.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    new_status = payload.status.upper()

    if user.role == "CUSTOMER":
        if target_request.customer_profile.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        if new_status != "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Customers can only set request status to CANCELLED",
            )

    if user.role != "CUSTOMER" or new_status != "CANCELLED":
        raise HTTPException(403, "Only the owning customer can cancel an open request")
    if target_request.status not in PRE_CONTRACT_STATUSES:
        raise HTTPException(409, "Request is no longer open")

    await prisma.request.update(
        where={"id": request_id},
        data={"status": new_status},
    )
    # Open bids and quotes for a cancelled request can no longer be chosen.
    await prisma.matchcandidate.update_many(
        where={"request_id": request_id, "deleted_at": None, "status": "PENDING"},
        data={"status": "EXPIRED"},
    )

    return MessageResponse(status="success", message=f"Request status updated to {new_status}")


@router.patch("/{request_id}", response_model=MessageResponse)
async def update_request(
    request_id: str,
    payload: UpdateRequestBody,
    user=Depends(require_roles("CUSTOMER")),
):
    target = await _own_request(request_id, user)
    if target.status not in (*SEARCHING_STATUSES, "PAUSED") or await _live_candidate_count(
        request_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A request can only be edited before any factory has bid on it",
        )
    data: dict[str, Any] = {}
    if payload.quantity is not None:
        data["quantity"] = _to_decimal(payload.quantity)
    if payload.preferred_currency_code is not None:
        currency_code = payload.preferred_currency_code.upper()
        if not await prisma.currency.find_unique(where={"code": currency_code}):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")
        data["preferred_currency"] = {"connect": {"code": currency_code}}
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nothing to update")
    await prisma.request.update(where={"id": request_id}, data=data)
    return MessageResponse(status="success", message="Request updated")


@router.post("/{request_id}/pause", response_model=MessageResponse)
async def pause_request(request_id: str, user=Depends(require_roles("CUSTOMER"))):
    target = await _own_request(request_id, user)
    if target.status not in SEARCHING_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a request that is still collecting offers can be paused",
        )
    await prisma.request.update(where={"id": request_id}, data={"status": "PAUSED"})
    return MessageResponse(status="success", message="Request paused")


@router.post("/{request_id}/resume", response_model=MessageResponse)
async def resume_request(request_id: str, user=Depends(require_roles("CUSTOMER"))):
    target = await _own_request(request_id, user)
    if target.status != "PAUSED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The request is not paused")
    # Back to where it was: collecting proposals if bids exist, otherwise waiting for the first.
    resumed = "PAIRING_IN_PROGRESS" if await _live_candidate_count(request_id) else "PENDING"
    await prisma.request.update(where={"id": request_id}, data={"status": resumed})
    return MessageResponse(status="success", message=f"Request resumed as {resumed}")


@router.delete("/{request_id}", response_model=MessageResponse)
async def delete_request(request_id: str, user=Depends(require_roles("CUSTOMER"))):
    target = await _own_request(request_id, user)
    untouched = target.status in (*SEARCHING_STATUSES, "PAUSED") and not await _live_candidate_count(
        request_id
    )
    if target.status != "CANCELLED" and not untouched:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a cancelled request, or one nobody has bid on, can be deleted",
        )
    # A request that ever reached a contract keeps its record for the order's parties.
    if await prisma.transaction.find_unique(where={"request_id": request_id}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A request with an order cannot be deleted",
        )
    await prisma.request.update(where={"id": request_id}, data={"deleted_at": _now()})
    await prisma.matchcandidate.update_many(
        where={
            "request_id": request_id,
            "deleted_at": None,
            "status": {"in": ["PENDING", "EXPIRED"]},
        },
        data={"deleted_at": _now()},
    )
    return MessageResponse(status="success", message="Request deleted")




@router.post("/inventory-entries", response_model=MessageResponse)
async def create_inventory_entry(
    payload: InventoryEntryCreateBody,
    user=Depends(require_roles("FACTORY")),
):
    require_verified(user)
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        return await _publish_inventory(payload, user, tx)


async def _publish_inventory(payload, user, db):
    factory_profile = await db.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Factory profile not found")

    if not payload.item_id:
        raise HTTPException(422, "Choose a product from the catalogue, or create it first")

    stock_address_id = await _resolve_or_create_address(
        address_id=payload.stock_address_id,
        country_code=payload.stock_country_code,
        region_name=payload.stock_region_name,
        city_name=payload.stock_city_name,
        street=payload.stock_street,
        address_field_name="stock_address_id",
        db=db,
    )
    if not stock_address_id:
        stock_address_id = factory_profile.primary_address_id
    if not stock_address_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Provide stock_address_id, manual stock address fields, or set primary factory profile address"
            ),
        )
    provided_unit = payload.unit.strip() if payload.unit else None

    item_id = _validate_uuid(payload.item_id, "item_id", required=True)
    item = await db.item.find_first(where={"id": item_id, "deleted_at": None, "merged_into_id": None})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    require_verified(user)
    if payload.category_id and payload.category_id != item.category_id:
        raise HTTPException(422, "Item and category must agree")
    if provided_unit and item.unit != provided_unit:
        raise HTTPException(422, "Shared product units cannot be changed by an offering")
    await validate_publication(db, factory_profile, item, payload.quantity_available, payload.price_per_unit, payload.characteristics_json)

    stock_address = await db.address.find_first(
        where={"id": stock_address_id, "deleted_at": None}
    )
    if not stock_address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock address not found")

    currency_code = payload.currency_code.upper()
    currency = await db.currency.find_unique(where={"code": currency_code})
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")

    inventory_data: dict[str, Any] = {
        "factory_profile": {"connect": {"id": factory_profile.id}},
        "item": {"connect": {"id": item.id}},
        "stock_address": {"connect": {"id": stock_address.id}},
        "quantity_available": _to_decimal(payload.quantity_available),
        "price_per_unit": _to_decimal(payload.price_per_unit),
        "currency": {"connect": {"code": currency_code}},
        "status": "ACTIVE",
    }
    if payload.characteristics_json is not None:
        inventory_data["characteristics_json"] = Json(payload.characteristics_json)

    await db.inventoryentry.create(data=inventory_data)

    return MessageResponse(status="success", message="Inventory entry created")


@router.get("/inventory-entries/mine")
async def list_my_inventory_entries(user=Depends(require_roles("FACTORY"))):
    factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        return []

    entries = await prisma.inventoryentry.find_many(
        where={
            "factory_profile_id": factory_profile.id,
            "deleted_at": None,
        },
        include={"item": True},
        order={"created_at": "desc"},
        take=100,
    )

    return [
        {
            "id": entry.id,
            "item_id": entry.item_id,
            "item_name": entry.item.name,
            "unit": entry.item.unit,
            "quantity_available": str(entry.quantity_available),
            "price_per_unit": str(entry.price_per_unit),
            "currency_code": entry.currency_code,
            "status": entry.status,
            "created_at": entry.created_at.isoformat(),
        }
        for entry in entries
    ]


@router.patch("/inventory-entries/{inventory_entry_id}/status", response_model=MessageResponse)
async def update_inventory_entry_status(
    inventory_entry_id: str,
    payload: UpdateInventoryEntryStatusBody,
    user=Depends(require_roles("FACTORY")),
):
    factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Factory profile not found")

    new_status = payload.status.upper()
    if new_status not in {"ACTIVE", "PAUSED"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Inventory status must be ACTIVE or PAUSED",
        )

    entry = await prisma.inventoryentry.find_first(
        where={
            "id": inventory_entry_id,
            "factory_profile_id": factory_profile.id,
            "deleted_at": None,
        }
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory entry not found")

    if new_status == "ACTIVE":
        require_verified(user)
        item = await prisma.item.find_unique(where={"id": entry.item_id})
        await validate_publication(prisma, factory_profile, item, entry.quantity_available, entry.price_per_unit, entry.characteristics_json)

    await prisma.inventoryentry.update(
        where={"id": inventory_entry_id},
        data={"status": new_status},
    )

    return MessageResponse(status="success", message=f"Inventory status updated to {new_status}")


@router.patch("/inventory-entries/{inventory_entry_id}", response_model=MessageResponse)
async def update_inventory_entry(
    inventory_entry_id: str,
    payload: UpdateInventoryEntryBody,
    user=Depends(require_roles("FACTORY")),
):
    factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Factory profile not found")
    entry = await prisma.inventoryentry.find_first(
        where={"id": inventory_entry_id, "factory_profile_id": factory_profile.id, "deleted_at": None}
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory entry not found")
    data: dict[str, Any] = {}
    if payload.quantity_available is not None:
        data["quantity_available"] = _to_decimal(payload.quantity_available)
    if payload.price_per_unit is not None and _to_decimal(payload.price_per_unit) != entry.price_per_unit:
        # Open bids were priced from this line; changing it under them would misstate their totals.
        open_bids = await prisma.matchcandidate.count(
            where={"inventory_entry_id": entry.id, "deleted_at": None, "status": "PENDING"}
        )
        if open_bids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The price is locked while open bids use this stock; withdraw them first",
            )
        data["price_per_unit"] = _to_decimal(payload.price_per_unit)
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nothing to update")
    await prisma.inventoryentry.update(where={"id": entry.id}, data=data)
    return MessageResponse(status="success", message="Inventory entry updated")


async def _own_offer(offer_id: str, user):
    logist_profile = await prisma.logistprofile.find_unique(where={"user_id": user.id})
    if not logist_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Logistics profile not found")
    offer = await prisma.logisticoffer.find_first(
        where={"id": offer_id, "logist_profile_id": logist_profile.id, "deleted_at": None}
    )
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logistic offer not found")
    return offer


@router.patch("/logistic-offers/{offer_id}", response_model=MessageResponse)
async def update_logistic_offer(
    offer_id: str,
    payload: UpdateLogisticOfferBody,
    user=Depends(require_roles("LOGIST")),
):
    # Quotes already given keep their own price and days; this changes the service going forward.
    offer = await _own_offer(offer_id, user)
    days_min = (
        payload.estimated_days_min
        if payload.estimated_days_min is not None
        else offer.estimated_days_min
    )
    days_max = (
        payload.estimated_days_max
        if payload.estimated_days_max is not None
        else offer.estimated_days_max
    )
    if days_min is not None and days_max is not None and days_min > days_max:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="estimated_days_min cannot be greater than estimated_days_max",
        )
    data: dict[str, Any] = {}
    if payload.title is not None:
        data["title"] = payload.title
    if payload.description is not None:
        data["description"] = payload.description
    if payload.base_price is not None:
        data["base_price"] = _to_decimal(payload.base_price)
    if payload.estimated_days_min is not None:
        data["estimated_days_min"] = payload.estimated_days_min
    if payload.estimated_days_max is not None:
        data["estimated_days_max"] = payload.estimated_days_max
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nothing to update")
    await prisma.logisticoffer.update(where={"id": offer.id}, data=data)
    return MessageResponse(status="success", message="Logistic offer updated")


@router.patch("/logistic-offers/{offer_id}/status", response_model=MessageResponse)
async def update_logistic_offer_status(
    offer_id: str,
    payload: UpdateInventoryEntryStatusBody,
    user=Depends(require_roles("LOGIST")),
):
    offer = await _own_offer(offer_id, user)
    new_status = payload.status.upper()
    if new_status not in {"ACTIVE", "PAUSED"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Logistic offer status must be ACTIVE or PAUSED",
        )
    await prisma.logisticoffer.update(where={"id": offer.id}, data={"status": new_status})
    return MessageResponse(status="success", message=f"Logistic offer status updated to {new_status}")


@router.post("/logistic-offers", response_model=MessageResponse)
async def create_logistic_offer(
    payload: LogisticOfferCreateBody,
    user=Depends(require_roles("LOGIST")),
):
    logist_profile = await prisma.logistprofile.find_unique(where={"user_id": user.id})
    if not logist_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Logistics profile not found")

    currency_code = payload.currency_code.upper()
    currency = await prisma.currency.find_unique(where={"code": currency_code})
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")

    if (
        payload.estimated_days_min is not None
        and payload.estimated_days_max is not None
        and payload.estimated_days_min > payload.estimated_days_max
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="estimated_days_min cannot be greater than estimated_days_max",
        )

    offer_data: dict[str, Any] = {
        "logist_profile": {"connect": {"id": logist_profile.id}},
        "title": payload.title,
        "base_price": _to_decimal(payload.base_price),
        "reliability_score": await get_computed_reliability(logist_profile.id),
        "currency": {"connect": {"code": currency_code}},
        "status": "ACTIVE",
    }
    if payload.description is not None:
        offer_data["description"] = payload.description
    if payload.price_per_km is not None:
        offer_data["price_per_km"] = _to_decimal(payload.price_per_km)
    if payload.price_per_kg is not None:
        offer_data["price_per_kg"] = _to_decimal(payload.price_per_kg)
    if payload.estimated_days_min is not None:
        offer_data["estimated_days_min"] = payload.estimated_days_min
    if payload.estimated_days_max is not None:
        offer_data["estimated_days_max"] = payload.estimated_days_max

    await prisma.logisticoffer.create(data=offer_data)

    return MessageResponse(status="success", message="Logistic offer created")


@router.get("/logistic-offers/mine")
async def list_my_logistic_offers(user=Depends(require_roles("LOGIST"))):
    logist_profile = await prisma.logistprofile.find_unique(where={"user_id": user.id})
    if not logist_profile:
        return []

    offers = await prisma.logisticoffer.find_many(
        where={
            "logist_profile_id": logist_profile.id,
            "deleted_at": None,
        },
        order={"created_at": "desc"},
        take=100,
    )

    return [
        {
            "id": offer.id,
            "title": offer.title,
            "description": offer.description,
            "base_price": str(offer.base_price),
            "currency_code": offer.currency_code,
            "estimated_days_min": offer.estimated_days_min,
            "estimated_days_max": offer.estimated_days_max,
            "reliability_score": offer.reliability_score,
            "status": offer.status,
            "created_at": offer.created_at.isoformat(),
        }
        for offer in offers
    ]
