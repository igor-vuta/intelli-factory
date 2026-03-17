from decimal import Decimal, InvalidOperation
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from db import prisma
from routers.auth import SESSION_COOKIE_NAME, _ensure_db_connection, _get_user_by_session_token, _now

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
    destination_address_id: str
    preferred_currency_code: str
    status: str
    created_at: str


class CreateRequestBody(BaseModel):
    category_id: str | None = None
    item_id: str | None = None
    requested_name_text: str | None = Field(default=None, min_length=2, max_length=200)
    requested_characteristics_json: dict[str, Any] | None = None
    quantity: float = Field(..., gt=0)
    destination_address_id: str | None = None
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


class InventoryEntryCreateBody(BaseModel):
    # Either an existing item_id OR a custom item_name + category_id (backend
    # will find-or-create the catalogue item automatically).
    item_id: str | None = None
    item_name: str | None = Field(default=None, min_length=2, max_length=200)
    category_id: str | None = None
    stock_address_id: str
    quantity_available: float = Field(..., gt=0)
    price_per_unit: float = Field(..., gt=0)
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
    reliability_score: float = Field(..., ge=0, le=1)
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
async def bootstrap(user=Depends(_require_authenticated_user)):
    categories = await prisma.category.find_many(
        where={"deleted_at": None, "status": "ACTIVE"},
        order={"default_name": "asc"},
        take=100,
    )
    items = await prisma.item.find_many(
        where={"deleted_at": None, "status": "ACTIVE"},
        order={"name": "asc"},
        take=200,
    )
    currencies = await prisma.currency.find_many(order={"code": "asc"}, take=20)

    addresses = await prisma.address.find_many(
        where={"deleted_at": None},
        include={"country": True, "region": True, "city": True},
        take=50,
    )

    return {
        "categories": [
            {"id": category.id, "name": category.default_name, "slug": category.slug}
            for category in categories
        ],
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "category_id": item.category_id,
            }
            for item in items
        ],
        "currencies": [{"code": currency.code, "name": currency.name} for currency in currencies],
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

    if not payload.item_id and not payload.requested_name_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either item_id or requested_name_text",
        )

    item_id = _validate_uuid(payload.item_id, "item_id")

    item = None
    if item_id:
        item = await prisma.item.find_first(
            where={"id": item_id, "deleted_at": None, "status": "ACTIVE"}
        )
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    category_id = _validate_uuid(payload.category_id, "category_id")
    if not category_id and item:
        category_id = item.category_id

    if not category_id:
        default_category = await prisma.category.find_first(
            where={"deleted_at": None, "status": "ACTIVE"},
            order={"default_name": "asc"},
        )
        if not default_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active categories available",
            )
        category_id = default_category.id

    category = await prisma.category.find_first(
        where={"id": category_id, "deleted_at": None, "status": "ACTIVE"}
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    destination_address_id = _validate_uuid(payload.destination_address_id, "destination_address_id")
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

    destination_address = await prisma.address.find_first(
        where={"id": destination_address_id, "deleted_at": None}
    )
    if not destination_address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination address not found")

    preferred_currency_code = payload.preferred_currency_code.upper()
    currency = await prisma.currency.find_unique(where={"code": preferred_currency_code})
    if not currency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Currency not found")

    request_data: dict[str, Any] = {
        "customer_profile": {"connect": {"id": customer_profile.id}},
        "category": {"connect": {"id": category.id}},
        "quantity": _to_decimal(payload.quantity),
        "destination_address": {"connect": {"id": destination_address.id}},
        "preferred_currency": {"connect": {"code": preferred_currency_code}},
        "status": "PENDING",
    }
    if item is not None:
        request_data["item"] = {"connect": {"id": item.id}}
    if payload.requested_name_text is not None:
        request_data["requested_name_text"] = payload.requested_name_text
    if payload.requested_characteristics_json is not None:
        request_data["requested_characteristics_json"] = payload.requested_characteristics_json

    created_request = await prisma.request.create(data=request_data)

    return CreateRequestResponse(
        status="success",
        request_id=created_request.id,
        message="Request created successfully",
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
            destination_address_id=row.destination_address_id,
            preferred_currency_code=row.preferred_currency_code,
            status=row.status,
            created_at=row.created_at.isoformat(),
        )
        for row in requests
    ]


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

    if user.role in {"FACTORY", "LOGIST"} and new_status != "PAIRING_IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Factory/Logistics roles can only set status to PAIRING_IN_PROGRESS",
        )

    await prisma.request.update(
        where={"id": request_id},
        data={"status": new_status},
    )

    return MessageResponse(status="success", message=f"Request status updated to {new_status}")


@router.post("/inventory-entries", response_model=MessageResponse)
async def create_inventory_entry(
    payload: InventoryEntryCreateBody,
    user=Depends(require_roles("FACTORY")),
):
    factory_profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not factory_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Factory profile not found")

    if not payload.item_id and not (payload.item_name and payload.item_name.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either item_id or item_name",
        )

    stock_address_id = _validate_uuid(payload.stock_address_id, "stock_address_id", required=True)

    item = None
    if payload.item_id:
        item_id = _validate_uuid(payload.item_id, "item_id", required=True)
        item = await prisma.item.find_first(where={"id": item_id, "deleted_at": None})
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    else:
        # Custom item name — find or create in the catalogue
        custom_name = payload.item_name.strip()  # type: ignore[union-attr]
        custom_category_id = _validate_uuid(payload.category_id, "category_id")
        if not custom_category_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="category_id is required when adding a custom item by name",
            )
        category_row = await prisma.category.find_first(
            where={"id": custom_category_id, "deleted_at": None, "status": "ACTIVE"}
        )
        if not category_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        normalized = custom_name.lower().replace(" ", "-")
        item = await prisma.item.find_first(
            where={"category_id": custom_category_id, "normalized_name": normalized, "deleted_at": None}
        )
        if not item:
            item = await prisma.item.create(
                data={
                    "category": {"connect": {"id": custom_category_id}},
                    "name": custom_name,
                    "normalized_name": normalized,
                    "unit": "pcs",
                    "status": "ACTIVE",
                }
            )

    stock_address = await prisma.address.find_first(
        where={"id": stock_address_id, "deleted_at": None}
    )
    if not stock_address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock address not found")

    currency_code = payload.currency_code.upper()
    currency = await prisma.currency.find_unique(where={"code": currency_code})
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
        inventory_data["characteristics_json"] = payload.characteristics_json

    await prisma.inventoryentry.create(data=inventory_data)

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
            "quantity_available": str(entry.quantity_available),
            "price_per_unit": str(entry.price_per_unit),
            "currency_code": entry.currency_code,
            "status": entry.status,
            "created_at": entry.created_at.isoformat(),
        }
        for entry in entries
    ]


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
        "reliability_score": payload.reliability_score,
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
