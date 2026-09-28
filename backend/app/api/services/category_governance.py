"""Shared publication and whole-request eligibility rules."""
from decimal import Decimal
import unicodedata
from fastapi import HTTPException

SUPPORTED_UNITS = {"pcs", "kg", "g", "t", "tons", "l", "m", "m2", "m3", "roll"}


def require_verified(user):
    if not user.is_email_verified or user.deleted_at is not None:
        raise HTTPException(403, "Verify your email before publishing or bidding")


def active(row):
    return row is not None and row.status == "ACTIVE" and row.deleted_at is None


def profile_complete(profile):
    return bool(
        profile
        and profile.deleted_at is None
        and all(
            getattr(profile, key, None)
            for key in ("legal_name", "contact_name", "phone", "primary_address_id")
        )
    )


def validate_attributes(schema, values):
    # Legacy item data contains examples, not JSON Schema. Only explicit object
    # definitions impose requirements; existing records retain their meaning.
    if not schema or schema.get("type") != "object":
        return
    values = values or {}
    for key in schema.get("required", []):
        if key not in values or values[key] in (None, ""):
            raise HTTPException(422, f"Required attribute: {key}")
    for key, definition in schema.get("properties", {}).items():
        if key not in values:
            continue
        value = values[key]
        kind = definition.get("type")
        valid = {
            "string": isinstance(value, str),
            "number": isinstance(value, (int, float)) and not isinstance(value, bool),
            "integer": isinstance(value, int) and not isinstance(value, bool),
            "boolean": isinstance(value, bool),
        }.get(kind, False)
        if not valid:
            raise HTTPException(422, f"Invalid attribute type: {key}")
        if "enum" in definition and value not in definition["enum"]:
            raise HTTPException(422, f"Invalid attribute option: {key}")
        if kind in {"number", "integer"}:
            number = Decimal(str(value))
            if (
                not number.is_finite()
                or ("minimum" in definition and value < definition["minimum"])
                or ("maximum" in definition and value > definition["maximum"])
            ):
                raise HTTPException(422, f"Attribute out of range: {key}")


async def eligible_category(db, category_id):
    category = await db.category.find_first(
        where={"id": category_id, "status": "ACTIVE", "deleted_at": None}
    )
    if not category:
        raise HTTPException(422, "Choose an active category from the catalogue")
    child = await db.category.find_first(
        where={"parent_id": category_id, "status": "ACTIVE", "deleted_at": None}
    )
    if child:
        raise HTTPException(422, "Choose a concrete category, not a parent group")
    return category


async def validate_publication(db, factory, item, quantity, price, attributes):
    if not profile_complete(factory):
        raise HTTPException(422, "Complete company, contact, phone and location first")
    if not await db.address.find_first(
        where={"id": factory.primary_address_id, "deleted_at": None}
    ):
        raise HTTPException(422, "Complete the company location first")
    if not active(item) or item.unit not in SUPPORTED_UNITS:
        raise HTTPException(422, "Choose an active product with a supported unit")
    category = await eligible_category(db, item.category_id)
    capability = await db.factorycategory.find_first(
        where={
            "factory_profile_id": factory.id,
            "category_id": item.category_id,
            "is_active": True,
            "confirmed_at": {"not": None},
        }
    )
    if not capability:
        raise HTTPException(422, "Confirm this production category before publishing or bidding")
    for value in (quantity, price):
        number = Decimal(str(value))
        if not number.is_finite() or number <= 0:
            raise HTTPException(422, "Quantity and unit price must be positive")
    validate_attributes(category.attributes_schema, attributes)
    validate_attributes(item.characteristics_schema, attributes)


async def validate_bid(db, req, inv, quantity, factory_id=None):
    if not active(inv) or (factory_id is not None and inv.factory_profile_id != factory_id):
        raise HTTPException(422, "Choose your own active inventory")
    factory = await db.factoryprofile.find_unique(where={"id": inv.factory_profile_id})
    if not factory:
        raise HTTPException(422, "Factory profile not found")
    user = await db.user.find_unique(where={"id": factory.user_id})
    if not user:
        raise HTTPException(422, "Factory account not found")
    require_verified(user)
    item = await db.item.find_unique(where={"id": inv.item_id})
    await validate_publication(
        db, factory, item, inv.quantity_available, inv.price_per_unit, inv.characteristics_json
    )
    if req.deleted_at is not None or req.status not in {"PENDING", "PAIRING_IN_PROGRESS"}:
        raise HTTPException(422, "Request is no longer open")
    if item.category_id != req.category_id or (req.item_id and req.item_id != item.id):
        raise HTTPException(422, "Product and category must match the request")
    if not req.item_id:

        def normalized_name(value):
            return " ".join(unicodedata.normalize("NFKC", value or "").casefold().split())

        if not normalized_name(req.requested_name_text) or normalized_name(
            req.requested_name_text
        ) != normalized_name(item.name):
            raise HTTPException(422, "Product name must match the requested product")
    requested = req.requested_characteristics_json or {}
    if requested.get("quantity_unit") != item.unit:
        raise HTTPException(422, "Quantity units must match")
    if (
        quantity is None
        or not Decimal(str(quantity)).is_finite()
        or Decimal(str(quantity)) != req.quantity
        or inv.quantity_available < req.quantity
    ):
        raise HTTPException(
            422, "A bid must fulfil the entire requested quantity from available stock"
        )
    for key, value in requested.items():
        if key != "quantity_unit" and (inv.characteristics_json or {}).get(key) != value:
            raise HTTPException(422, f"Requested specification does not match: {key}")
    address = await db.address.find_first(where={"id": inv.stock_address_id, "deleted_at": None})
    if not address:
        raise HTTPException(422, "Stock location is unavailable")
