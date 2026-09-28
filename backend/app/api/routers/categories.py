"""Catalogue proposals, factory setup and resumable private inventory drafts."""
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID, uuid4
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from prisma import Json
from pydantic import BaseModel, Field

from db import prisma
from routers.requests import require_roles, _require_authenticated_user
from routers.auth import _ensure_db_connection
from services.category_governance import (
    eligible_category,
    profile_complete,
    require_verified,
    validate_publication,
)

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])


async def catalogue_lock(db):
    # Serialize review/tree changes, including approvals of different proposals.
    await db.execute_raw("SELECT pg_advisory_xact_lock(734901)")


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


async def factory_for(user):
    profile = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if not profile or profile.deleted_at is not None:
        raise HTTPException(404, "Factory profile not found")
    return profile


@router.get("/")
async def catalogue(
    locale: Literal["en", "ru", "kk"] = "en", user=Depends(_require_authenticated_user)
):
    rows = await prisma.category.find_many(
        where={"status": "ACTIVE", "deleted_at": None},
        include={"translations": True},
        order={"default_name": "asc"},
    )
    parents = {r.parent_id for r in rows}
    return [
        {
            "id": r.id,
            "slug": r.slug,
            "parent_id": r.parent_id,
            "name": next((t.name for t in r.translations if t.locale == locale), r.default_name),
            "label_locale": locale
            if any(t.locale == locale for t in r.translations)
            else "default",
            "selectable": r.id not in parents,
            "attributes_schema": r.attributes_schema,
        }
        for r in rows
    ]


@router.get("/coverage")
async def coverage(user=Depends(require_roles("ADMIN"))):
    rows = await prisma.category.find_many(include={"translations": True})
    return {
        locale: {
            "total": len(rows),
            "translated": sum(any(t.locale == locale for t in r.translations) for r in rows),
            "missing_ids": [
                r.id for r in rows if not any(t.locale == locale for t in r.translations)
            ],
        }
        for locale in ("en", "ru", "kk")
    }


class ProposalBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=5, max_length=1000)
    parent_id: UUID | None = None


@router.post("/proposals", status_code=201)
async def propose(body: ProposalBody, user=Depends(require_roles("FACTORY", "CUSTOMER"))):
    require_verified(user)
    if len(body.name.strip()) < 2 or len(body.description.strip()) < 5:
        raise HTTPException(422, "Provide a name and short description")
    if body.parent_id and not await prisma.category.find_first(
        where={"id": str(body.parent_id), "status": "ACTIVE", "deleted_at": None}
    ):
        raise HTTPException(422, "Parent category unavailable")
    return await prisma.categoryproposal.create(
        data={
            "submitter_id": user.id,
            "name": body.name.strip(),
            "description": body.description.strip(),
            "parent_id": str(body.parent_id) if body.parent_id else None,
        }
    )


@router.get("/proposals")
async def proposals(user=Depends(require_roles("FACTORY", "CUSTOMER", "ADMIN"))):
    return await prisma.categoryproposal.find_many(
        where={} if user.role == "ADMIN" else {"submitter_id": user.id},
        order={"created_at": "desc"},
    )


class DecisionBody(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    category_id: UUID | None = None
    note: str = Field(min_length=1, max_length=1000)


@router.post("/proposals/{proposal_id}/decision")
async def decide(proposal_id: UUID, body: DecisionBody, user=Depends(require_roles("ADMIN"))):
    require_verified(user)
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        row = await tx.categoryproposal.find_unique(where={"id": str(proposal_id)})
        if not row:
            raise HTTPException(404, "Proposal not found")
        if row.status != "PENDING":
            if row.status == body.status and (
                body.category_id is None or str(body.category_id) == row.category_id
            ):
                return row
            raise HTTPException(409, "Proposal already decided")
        category_id = None
        if body.status == "APPROVED":
            if body.category_id:
                category_id = (await eligible_category(tx, str(body.category_id))).id
            else:
                # Never merge or publish a label collision automatically, including translations.
                categories = await tx.category.find_many(include={"translations": True})
                if any(
                    normalized(row.name)
                    in {normalized(c.default_name), *(normalized(t.name) for t in c.translations)}
                    for c in categories
                ):
                    raise HTTPException(
                        409, "Review the label collision and explicitly link an existing category"
                    )
                if row.parent_id:
                    parent = await tx.category.find_first(
                        where={"id": row.parent_id, "deleted_at": None, "status": "ACTIVE"}
                    )
                    if not parent:
                        raise HTTPException(422, "Parent category unavailable")
                    # Do not turn a concrete category with offerings/history into a group.
                    if (
                        await tx.item.count(where={"category_id": parent.id})
                        or await tx.request.count(where={"category_id": parent.id})
                        or await tx.factorycategory.count(where={"category_id": parent.id})
                    ):
                        raise HTTPException(
                            409, "Parent is already used as a concrete production category"
                        )
                    if parent.parent_id:
                        raise HTTPException(422, "Catalogue supports at most two levels")
                category_id = str(uuid4())
                await tx.category.create(
                    data={
                        "id": category_id,
                        "slug": f"category-{category_id}",
                        "default_name": row.name,
                        "parent_id": row.parent_id,
                        "status": "ACTIVE",
                    }
                )
        return await tx.categoryproposal.update(
            where={"id": row.id},
            data={
                "status": body.status,
                "category_id": category_id,
                "reviewer_id": user.id,
                "decision_note": body.note,
                "decided_at": datetime.now(timezone.utc),
            },
        )


@router.get("/factory-setup")
async def setup(user=Depends(require_roles("FACTORY"))):
    factory = await factory_for(user)
    selections = await prisma.factorycategory.find_many(
        where={"factory_profile_id": factory.id}, include={"category": True}
    )
    entries = await prisma.inventoryentry.find_many(
        where={"factory_profile_id": factory.id, "status": "ACTIVE", "deleted_at": None},
        include={"item": True},
    )
    eligible = []
    for entry in entries:
        try:
            await validate_publication(
                prisma,
                factory,
                entry.item,
                entry.quantity_available,
                entry.price_per_unit,
                entry.characteristics_json,
            )
            if await prisma.address.find_first(
                where={"id": entry.stock_address_id, "deleted_at": None}
            ):
                eligible.append(entry.id)
        except HTTPException:
            continue
    return {
        "profile": factory,
        "selections": selections,
        "profile_complete": profile_complete(factory),
        "email_verified": user.is_email_verified,
        "ready": bool(user.is_email_verified and eligible),
        "eligible_inventory_ids": eligible,
    }


class ProfileBody(BaseModel):
    legal_name: str = Field(max_length=200)
    contact_name: str = Field(max_length=200)
    phone: str = Field(max_length=40)


@router.patch("/factory-profile")
async def save_profile(body: ProfileBody, user=Depends(require_roles("FACTORY"))):
    factory = await factory_for(user)
    return await prisma.factoryprofile.update(
        where={"id": factory.id}, data={k: v.strip() for k, v in body.model_dump().items()}
    )


class SelectionBody(BaseModel):
    category_ids: list[UUID] = Field(max_length=100)


@router.put("/factory-selections")
async def select_categories(body: SelectionBody, user=Depends(require_roles("FACTORY"))):
    factory = await factory_for(user)
    ids = {str(i) for i in body.category_ids}
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        for category_id in ids:
            await eligible_category(tx, category_id)
        existing = await tx.factorycategory.find_many(where={"factory_profile_id": factory.id})
        for row in existing:
            if row.category_id not in ids:
                # Retain offerings and contracts; live eligibility rechecks disable new bidding.
                await tx.factorycategory.update(where={"id": row.id}, data={"is_active": False})
        for category_id in ids:
            await tx.factorycategory.upsert(
                where={
                    "factory_profile_id_category_id": {
                        "factory_profile_id": factory.id,
                        "category_id": category_id,
                    }
                },
                data={
                    "create": {
                        "factory_profile_id": factory.id,
                        "category_id": category_id,
                        "confirmed_at": datetime.now(timezone.utc),
                    },
                    "update": {"is_active": True, "confirmed_at": datetime.now(timezone.utc)},
                },
            )
    return {"status": "success"}


class DraftBody(BaseModel):
    data: dict[str, Any]


@router.get("/drafts")
async def drafts(user=Depends(require_roles("FACTORY"))):
    factory = await factory_for(user)
    return await prisma.inventorydraft.find_many(
        where={"factory_profile_id": factory.id}, order={"updated_at": "desc"}
    )


@router.put("/drafts/{draft_id}")
async def save_draft(draft_id: UUID, body: DraftBody, user=Depends(require_roles("FACTORY"))):
    factory = await factory_for(user)
    # Owner-scoped update; UUID creation is safe against another owner's existing ID.
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        existing = await tx.inventorydraft.find_unique(where={"id": str(draft_id)})
        if existing and existing.factory_profile_id != factory.id:
            raise HTTPException(404, "Draft not found")
        return await tx.inventorydraft.upsert(
            where={"id": str(draft_id)},
            data={
                "create": {
                    "id": str(draft_id),
                    "factory_profile_id": factory.id,
                    "data": Json(body.data),
                },
                "update": {"data": Json(body.data)},
            },
        )


class LocationBody(BaseModel):
    country_code: str = Field(min_length=2, max_length=2)
    region_name: str = Field(min_length=2, max_length=120)
    city_name: str = Field(min_length=2, max_length=120)
    street: str = Field(min_length=3, max_length=300)
    postal_code: str | None = None


@router.put("/factory-location")
async def save_location(body: LocationBody, user=Depends(require_roles("FACTORY"))):
    from routers.addresses import resolve_or_create_address

    factory = await factory_for(user)
    address = await resolve_or_create_address(**body.model_dump())
    await prisma.factoryprofile.update(
        where={"id": factory.id}, data={"primary_address_id": address["id"]}
    )
    return address


@router.post("/drafts/{draft_id}/publish")
async def publish_draft(draft_id: UUID, user=Depends(require_roles("FACTORY"))):
    from routers.requests import InventoryEntryCreateBody, _publish_inventory
    from pydantic import ValidationError

    require_verified(user)
    factory = await factory_for(user)
    async with prisma.tx() as tx:
        await catalogue_lock(tx)
        draft = await tx.inventorydraft.find_first(
            where={"id": str(draft_id), "factory_profile_id": factory.id}
        )
        if not draft:
            raise HTTPException(404, "Draft not found or already published")
        data = dict(draft.data)
        if data.get("proposal_id"):
            proposal = await tx.categoryproposal.find_first(
                where={"id": data["proposal_id"], "submitter_id": user.id}
            )
            if not proposal or proposal.status != "APPROVED":
                raise HTTPException(422, "Category proposal is still waiting for approval")
            data["category_id"] = proposal.category_id
        try:
            payload = InventoryEntryCreateBody(**data)
        except ValidationError:
            raise HTTPException(
                422, "Complete product, quantity, unit price, currency and stock location"
            ) from None
        result = await _publish_inventory(payload, user, tx)
        await tx.inventorydraft.delete(where={"id": draft.id})
        return result
