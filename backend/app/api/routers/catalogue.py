"""Shared multilingual catalogue: search, immediate product creation and administrator upkeep.

Products are created on the spot and reused by everyone. Categories stay governed: customers and
factories propose them through /categories/proposals and an administrator approves; only
administrators create categories here directly.
"""

import asyncio
import hashlib
import json
import unicodedata
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from prisma import Json
from pydantic import BaseModel, Field, field_validator

from db import prisma
from routers.auth import _ensure_db_connection
from routers.requests import _require_authenticated_user, require_roles
from services.category_governance import (
    SUPPORTED_UNITS,
    catalogue_lock,
    eligible_category,
    normalized,
    require_verified,
)

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])
Locale = Literal["en", "ru", "kk"]
Kind = Literal["categories", "items"]

CREATION_LIMIT = 500


def labels(row, kind):
    """Every name a record answers to: its original label, translations and their aliases."""
    return [row.default_name if kind == "categories" else row.name] + [
        value for t in row.translations or [] for value in [t.name, *t.aliases]
    ]


def present(row, kind, locale):
    translation = next((t for t in row.translations or [] if t.locale == locale), None)
    original = row.default_name if kind == "categories" else row.name
    result = {
        "id": row.id,
        "name": translation.name if translation else original,
        # The language the shown label is in; None for historical labels of unknown language.
        "label_locale": locale if translation else row.source_locale,
        "fallback": translation is None and row.source_locale != locale,
        "record_state": row.record_state,
        "search_labels": labels(row, kind),
    }
    if kind == "categories":
        result.update(
            parent_id=row.parent_id, slug=row.slug, attributes_schema=row.attributes_schema
        )
    else:
        result.update(
            category_id=row.category_id,
            unit=row.unit,
            identity_attributes=row.identity_attributes or {},
            characteristics_schema=row.characteristics_schema,
            merged_into_id=row.merged_into_id,
        )
    return result


def table(db, kind):
    return db.category if kind == "categories" else db.item


@router.get("")
async def search(
    locale: Locale = "en",
    q: str = Query("", max_length=120),
    category_id: UUID | None = None,
    user=Depends(_require_authenticated_user),
):
    categories, items, redirects = await asyncio.gather(
        prisma.category.find_many(
            where={"status": "ACTIVE", "deleted_at": None},
            include={"translations": True},
            order={"default_name": "asc"},
        ),
        prisma.item.find_many(
            where={"status": "ACTIVE", "deleted_at": None, "merged_into_id": None},
            include={"translations": True},
            order={"name": "asc"},
        ),
        prisma.item.find_many(
            where={"merged_into_id": {"not": None}}, include={"translations": True}
        ),
    )
    parents = {r.parent_id for r in categories}
    # Products are usable only in leaf categories (a group that gained subcategories is not).
    leaf_ids = {r.id for r in categories if r.id not in parents}
    query = normalized(q)
    # Names of products merged into a record keep finding it.
    merged_names: dict[str, list[str]] = {}
    for redirect in redirects:
        merged_names.setdefault(redirect.merged_into_id, []).extend(labels(redirect, "items"))

    def matches(values):
        return not query or any(query in normalized(v) for v in values)

    return {
        "categories": [
            dict(present(r, "categories", locale), selectable=r.id not in parents)
            for r in categories
            if matches(labels(r, "categories"))
        ],
        "items": [
            dict(
                present(r, "items", locale),
                search_labels=labels(r, "items") + merged_names.get(r.id, []),
                merged_names=merged_names.get(r.id, []),
            )
            for r in items
            if r.category_id in leaf_ids
            and (not category_id or r.category_id == str(category_id))
            and matches(labels(r, "items") + merged_names.get(r.id, []))
        ],
        "units": sorted(SUPPORTED_UNITS),
    }


@router.get("/{kind}/{record_id}")
async def record(
    kind: Kind,
    record_id: UUID,
    locale: Locale = "en",
    user=Depends(_require_authenticated_user),
):
    row = await table(prisma, kind).find_unique(
        where={"id": str(record_id)}, include={"translations": True}
    )
    if not row:
        raise HTTPException(404, "Record not found")
    result = present(row, kind, locale)
    if kind == "items" and row.merged_into_id:
        target = await prisma.item.find_unique(
            where={"id": row.merged_into_id}, include={"translations": True}
        )
        result["canonical"] = present(target, kind, locale)
    return result


def clean_label(value):
    value = " ".join(unicodedata.normalize("NFKC", value).split())
    if len(value) < 2 or not any(c.isalnum() for c in value):
        raise ValueError("Enter a product or category name")
    return value


class CategoryBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    locale: Locale
    parent_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        return clean_label(value)


class ItemBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    locale: Locale
    category_id: UUID
    unit: str
    # Identity characteristics: material, grade/model, dimensions (with their units).
    attributes: dict[str, str] = Field(default_factory=dict, max_length=12)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        return clean_label(value)

    @field_validator("unit")
    @classmethod
    def unit_supported(cls, value):
        if value not in SUPPORTED_UNITS:
            raise ValueError("Choose a supported unit")
        return value

    @field_validator("attributes")
    @classmethod
    def bounded_attributes(cls, value):
        if any(
            not k.strip() or not v.strip() or len(k) > 60 or len(v) > 160 for k, v in value.items()
        ):
            raise ValueError("Enter short, nonempty characteristics")
        return {k.strip(): v.strip() for k, v in value.items()}


async def duplicates(db, kind, body):
    """Records in the same scope that already answer to this name (in any language); products
    must also have the same unit and identity characteristics to count as the same product."""
    if kind == "categories":
        scope = {"parent_id": str(body.parent_id) if body.parent_id else None}
    else:
        scope = {"category_id": str(body.category_id)}
    rows = await table(db, kind).find_many(where=scope, include={"translations": True})
    by_id = {row.id: row for row in rows}
    name = normalized(body.name)
    found = {}
    for row in rows:
        if name not in {normalized(v) for v in labels(row, kind)}:
            continue
        if kind == "items":
            if row.unit != body.unit or (row.identity_attributes or {}) != body.attributes:
                continue
            # A merged duplicate stands for its canonical product (whose aliases also match).
            row = by_id.get(row.merged_into_id, row) if row.merged_into_id else row
        found[row.id] = row
    return list(found.values())


async def create(kind, body, user):
    require_verified(user)
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        return await create_locked(tx, kind, body, user)


async def create_locked(tx, kind, body, user):
    """Create or reuse a record inside a transaction that already holds the catalogue lock."""
    if kind == "items":
        await eligible_category(tx, str(body.category_id))
    elif body.parent_id:
        parent = await tx.category.find_first(
            where={"id": str(body.parent_id), "status": "ACTIVE", "deleted_at": None}
        )
        if not parent:
            raise HTTPException(422, "Parent category unavailable")
        if (
            await tx.item.count(where={"category_id": parent.id})
            or await tx.request.count(where={"category_id": parent.id})
            or await tx.factorycategory.count(where={"category_id": parent.id})
        ):
            raise HTTPException(
                409, "Choose a parent group without products or production declarations"
            )
    existing = await duplicates(tx, kind, body)
    if len(existing) > 1:
        raise HTTPException(409, "Several records match; select the intended product")
    if existing:
        row = existing[0]
        if row.status != "ACTIVE" or row.deleted_at:
            raise HTTPException(
                409,
                "An administrator retired this product; ask an administrator to restore it",
            )
        return dict(present(row, kind, body.locale), created=False)
    # A per-account limit bounds accidental or abusive catalogue growth.
    created = await tx.eventlog.count(
        where={"actor_user_id": user.id, "event_type": "CATALOGUE_CREATE"}
    )
    if created >= CREATION_LIMIT and user.role != "ADMIN":
        raise HTTPException(429, "Catalogue creation limit reached; contact an administrator")
    record_id = str(uuid4())
    data = {
        "id": record_id,
        "source_locale": body.locale,
        "record_state": "NEW",
        "status": "ACTIVE",
        "translations": {"create": [{"locale": body.locale, "name": body.name}]},
    }
    if kind == "categories":
        data.update(
            slug=f"category-{record_id}",
            default_name=body.name,
            parent_id=str(body.parent_id) if body.parent_id else None,
        )
    else:
        # Variants share a name but differ in unit or characteristics, so the unique key hashes
        # all three instead of the name alone.
        key = json.dumps(
            [normalized(body.name), body.unit, body.attributes], sort_keys=True, ensure_ascii=False
        )
        data.update(
            category_id=str(body.category_id),
            name=body.name,
            normalized_name="catalogue-" + hashlib.sha256(key.encode()).hexdigest(),
            unit=body.unit,
            identity_attributes=Json(body.attributes),
        )
    row = await table(tx, kind).create(data=data, include={"translations": True})
    await audit(
        tx, user, "CATALOGUE_CREATE", kind, row.id, {"name": body.name, "locale": body.locale}
    )
    return dict(present(row, kind, body.locale), created=True)

async def audit(db, user, event, kind, record_id, data):
    await db.eventlog.create(
        data={
            "actor_user_id": user.id,
            "event_type": event,
            "entity_type": kind,
            "entity_id": record_id,
            "payload_json": Json(data),
        }
    )


@router.post("/categories", status_code=201)
async def create_category(body: CategoryBody, user=Depends(require_roles("ADMIN"))):
    return await create("categories", body, user)


@router.post("/items", status_code=201)
async def create_item(body: ItemBody, user=Depends(require_roles("CUSTOMER", "FACTORY", "ADMIN"))):
    return await create("items", body, user)


class LabelBody(BaseModel):
    locale: Locale
    name: str = Field(min_length=2, max_length=120)
    aliases: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("aliases")
    @classmethod
    def clean_aliases(cls, values):
        if any(not v.strip() or len(v) > 120 for v in values):
            raise ValueError("Aliases must contain 1–120 characters")
        return list(dict.fromkeys(v.strip() for v in values))


@router.put("/{kind}/{record_id}/label")
async def label(kind: Kind, record_id: UUID, body: LabelBody, user=Depends(require_roles("ADMIN"))):
    require_verified(user)
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        row = await table(tx, kind).find_unique(where={"id": str(record_id)})
        if (
            not row
            or row.deleted_at
            or row.status != "ACTIVE"
            or (kind == "items" and row.merged_into_id)
        ):
            raise HTTPException(404, "Active record not found")
        translations = tx.categorytranslation if kind == "categories" else tx.itemtranslation
        field = "category_id" if kind == "categories" else "item_id"
        key = {f"{field}_locale": {field: row.id, "locale": body.locale}}
        data = body.model_dump()
        # A corrected label keeps the previous one searchable.
        previous = await translations.find_unique(where=key)
        if previous:
            data["aliases"] = list(dict.fromkeys([*previous.aliases, previous.name, *body.aliases]))
        await translations.upsert(
            where=key, data={"create": {field: row.id, **data}, "update": data}
        )
        await audit(tx, user, "CATALOGUE_LABEL", kind, row.id, data)
    return {"status": "success"}


class MaintenanceBody(BaseModel):
    action: Literal["establish", "retire", "merge"]
    target_id: UUID | None = None


@router.post("/{kind}/{record_id}/maintenance")
async def maintain(
    kind: Kind, record_id: UUID, body: MaintenanceBody, user=Depends(require_roles("ADMIN"))
):
    require_verified(user)
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        row = await table(tx, kind).find_unique(where={"id": str(record_id)})
        if not row:
            raise HTTPException(404, "Record not found")
        if kind == "items" and row.merged_into_id:
            raise HTTPException(409, "Maintain the canonical target of this merged item")
        # Establishing also restores a retired record.
        data = {"record_state": "ESTABLISHED", "status": "ACTIVE"}
        if body.action == "retire":
            if kind == "categories" and await tx.category.count(
                where={"parent_id": row.id, "status": "ACTIVE", "deleted_at": None}
            ):
                raise HTTPException(409, "Retire child categories first")
            data = {"status": "ARCHIVED", "record_state": "RETIRED"}
        if body.action == "merge":
            data = await merge_item(tx, kind, row, body.target_id)
        await table(tx, kind).update(where={"id": row.id}, data=data)
        await audit(tx, user, "CATALOGUE_MAINTENANCE", kind, row.id, body.model_dump(mode="json"))
    return {"status": "success"}


async def merge_item(tx, kind, row, target_id):
    """Redirect a duplicate product to its canonical record. Stock, requests, bids and contracts
    keep their original foreign keys and labels; matching follows the redirect."""
    if kind != "items" or not target_id or str(target_id) == row.id:
        raise HTTPException(422, "Choose a different item in the same category")
    target = await tx.item.find_unique(where={"id": str(target_id)}, include={"translations": True})
    if (
        not target
        or target.merged_into_id
        or target.deleted_at
        or target.status != "ACTIVE"
        or row.category_id != target.category_id
        or row.unit != target.unit
        or (row.identity_attributes or {}) != (target.identity_attributes or {})
        or row.characteristics_schema != target.characteristics_schema
    ):
        raise HTTPException(422, "Merge requires the same category, unit and characteristics")
    # Flatten earlier redirects so no chain or cycle forms.
    await tx.item.update_many(where={"merged_into_id": row.id}, data={"merged_into_id": target.id})
    source = await tx.item.find_unique(where={"id": row.id}, include={"translations": True})
    for translation in source.translations or []:
        existing = next((t for t in target.translations or [] if t.locale == translation.locale), None)
        values = {
            "name": existing.name if existing else translation.name,
            "aliases": list(
                dict.fromkeys(
                    [*(existing.aliases if existing else []), translation.name, *translation.aliases]
                )
            ),
        }
        await tx.itemtranslation.upsert(
            where={"item_id_locale": {"item_id": target.id, "locale": translation.locale}},
            data={
                "create": {"item_id": target.id, "locale": translation.locale, **values},
                "update": values,
            },
        )
    return {"record_state": "MERGED", "merged_into_id": target.id}
