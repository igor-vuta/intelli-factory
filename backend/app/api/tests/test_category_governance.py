"""Category business invariants, with opt-in disposable PostgreSQL tests."""
import sys
from pathlib import Path

import asyncio
import os
from decimal import Decimal
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from prisma import Prisma, Json

import importlib

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.append(str(API_ROOT))
categories = importlib.import_module("routers.categories")
requests = importlib.import_module("routers.requests")
pairing = importlib.import_module("routers.pairing")
governance = importlib.import_module("services.category_governance")
validate_bid = governance.validate_bid
validate_attributes = governance.validate_attributes
OptimizationEngine = importlib.import_module("services.optimization_engine").OptimizationEngine


@pytest.fixture
def anyio_backend():
    return "asyncio"


def domain():
    item = NS(
        id="item",
        category_id="category",
        unit="kg",
        status="ACTIVE",
        deleted_at=None,
        characteristics_schema=None,
    )
    inv = NS(
        id="inventory",
        item_id="item",
        factory_profile_id="factory",
        status="ACTIVE",
        deleted_at=None,
        quantity_available=Decimal(10),
        price_per_unit=Decimal(2),
        stock_address_id="address",
        characteristics_json={"grade": "A"},
    )
    req = NS(
        id="request",
        item_id="item",
        category_id="category",
        quantity=Decimal(10),
        deleted_at=None,
        status="PENDING",
        requested_characteristics_json={"quantity_unit": "kg", "grade": "A"},
    )
    profile = NS(
        id="factory",
        user_id="user",
        legal_name="Factory",
        contact_name="Contact",
        phone="123",
        primary_address_id="address",
        deleted_at=None,
    )
    user = NS(id="user", is_email_verified=True, deleted_at=None)
    db = NS(
        factoryprofile=NS(find_unique=AsyncMock(return_value=profile)),
        user=NS(find_unique=AsyncMock(return_value=user)),
        item=NS(find_unique=AsyncMock(return_value=item)),
        category=NS(
            find_first=AsyncMock(
                side_effect=lambda where: None
                if "parent_id" in where
                else NS(id="category", attributes_schema=None)
            )
        ),
        factorycategory=NS(find_first=AsyncMock(return_value=NS(id="cap"))),
        address=NS(find_first=AsyncMock(return_value=NS(id="address"))),
    )
    return db, req, inv, item, user


@pytest.mark.anyio
@pytest.mark.parametrize(
    "case",
    [
        "valid",
        "other_owner",
        "draft",
        "deleted",
        "category",
        "item",
        "unit",
        "quantity",
        "stock",
        "specification",
        "capability",
        "unverified",
        "inactive_item",
    ],
)
async def test_whole_request_eligibility(case):
    db, req, inv, item, user = domain()
    quantity = 10
    if case == "other_owner":
        inv.factory_profile_id = "other"
    if case == "draft":
        inv.status = "PENDING"
    if case == "deleted":
        inv.deleted_at = "deleted"
    if case == "category":
        req.category_id = "other"
    if case == "item":
        req.item_id = "other"
    if case == "unit":
        item.unit = "pcs"
    if case == "quantity":
        quantity = 5
    if case == "stock":
        inv.quantity_available = Decimal(9)
    if case == "specification":
        inv.characteristics_json = {"grade": "B"}
    if case == "capability":
        db.factorycategory.find_first.return_value = None
    if case == "unverified":
        user.is_email_verified = False
    if case == "inactive_item":
        item.status = "PAUSED"
    if case == "valid":
        await validate_bid(db, req, inv, quantity, "factory")
    else:
        with pytest.raises(HTTPException):
            await validate_bid(db, req, inv, quantity, "factory")


@pytest.mark.parametrize(
    "value", [{}, {"gsm": "180"}, {"gsm": True}, {"gsm": 0}, {"gsm": 301}, {"gsm": float("nan")}]
)
def test_required_attribute_types_and_ranges(value):
    with pytest.raises(HTTPException):
        validate_attributes(
            {
                "type": "object",
                "required": ["gsm"],
                "properties": {"gsm": {"type": "number", "minimum": 1, "maximum": 300}},
            },
            value,
        )


@pytest.mark.anyio
async def test_optimizer_excludes_draft(monkeypatch):
    db, req, inv, _, _ = domain()
    inv.status = "PENDING"
    monkeypatch.setattr("services.optimization_engine.prisma", db)
    assert (
        await OptimizationEngine()._eligible_candidates(
            [NS(inventory_entry=inv, quoted_quantity=10)], req
        )
        == []
    )


def app_for(user=None):
    app = FastAPI()
    app.include_router(categories.router, prefix="/categories")
    app.include_router(requests.router, prefix="/requests")
    app.include_router(pairing.router, prefix="/pairing")
    app.dependency_overrides[categories._ensure_db_connection] = lambda: None
    if user:
        app.dependency_overrides[requests._require_authenticated_user] = lambda: user
        app.dependency_overrides[pairing._require_authenticated_user] = lambda: user
    return app


@pytest.mark.anyio
@pytest.mark.parametrize(
    "role,verified,expected",
    [
        (None, False, 401),
        ("FACTORY", False, 403),
        ("FACTORY", True, 403),
        ("CUSTOMER", True, 403),
        ("LOGIST", True, 403),
        ("ADMIN", False, 403),
    ],
)
async def test_review_actor_matrix(role, verified, expected):
    user = (
        NS(id=str(uuid4()), role=role, is_email_verified=verified, deleted_at=None)
        if role
        else None
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        result = await client.post(
            f"/categories/proposals/{uuid4()}/decision",
            json={"status": "APPROVED", "note": "Reviewed"},
        )
    assert result.status_code == expected


@pytest.fixture
async def real_db(monkeypatch):
    url = os.environ.get("CATEGORY_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set CATEGORY_TEST_DATABASE_URL to disposable PostgreSQL")
    assert "127.0.0.1:55439/factory_categories_" in url
    db = Prisma(datasource={"url": url})
    await db.connect()
    for module in (categories, requests, pairing):
        monkeypatch.setattr(module, "prisma", db)
    monkeypatch.setattr("routers.addresses.prisma", db)
    try:
        yield db
    finally:
        await db.disconnect()


async def make_user(db, role="FACTORY"):
    return await db.user.create(
        data={
            "email": f"{uuid4()}@test.local",
            "password_hash": "unused-test-hash",
            "role": role,
            "is_email_verified": True,
        }
    )


async def seed_factory(db):
    user = await make_user(db)
    country = await db.country.upsert(
        where={"iso2": "KZ"},
        data={"create": {"iso2": "KZ", "iso3": "KAZ", "default_name": "Kazakhstan"}, "update": {}},
    )
    region = await db.region.create(
        data={"country_id": country.id, "code": str(uuid4()), "default_name": "Test region"}
    )
    city = await db.city.create(data={"region_id": region.id, "default_name": "Test city"})
    address = await db.address.create(
        data={
            "country_id": country.id,
            "region_id": region.id,
            "city_id": city.id,
            "street": "Test street 1",
        }
    )
    factory = await db.factoryprofile.create(
        data={
            "user_id": user.id,
            "legal_name": "Test factory",
            "contact_name": "Test contact",
            "phone": "123456",
            "primary_address_id": address.id,
        }
    )
    category = await db.category.create(
        data={"slug": str(uuid4()), "default_name": f"Family {uuid4()}"}
    )
    item = await db.item.create(
        data={
            "category_id": category.id,
            "name": "Test product",
            "normalized_name": "test-product",
            "unit": "kg",
        }
    )
    await db.currency.upsert(
        where={"code": "USD"},
        data={
            "create": {"code": "USD", "name": "USD", "exchange_rate_to_base": Decimal(1)},
            "update": {},
        },
    )
    return user, factory, category, item, address


@pytest.mark.anyio
async def test_postgres_review_concurrency_collision_retry(real_db):
    db = real_db
    user = await make_user(db)
    admin = await make_user(db, "ADMIN")
    proposal = await categories.propose(
        categories.ProposalBody(name=f"New family {uuid4()}", description="Production family"), user
    )
    decision = categories.DecisionBody(status="APPROVED", note="Reviewed")
    results = await asyncio.gather(
        *(categories.decide(proposal.id, decision, admin) for _ in range(3))
    )
    assert len({r.category_id for r in results}) == 1
    assert await db.category.count(where={"default_name": proposal.name}) == 1
    duplicate = await categories.propose(
        categories.ProposalBody(name=proposal.name.upper(), description="Another proposal"), user
    )
    with pytest.raises(HTTPException) as exc:
        await categories.decide(duplicate.id, decision, admin)
    assert exc.value.status_code == 409
    linked = await categories.decide(
        duplicate.id,
        categories.DecisionBody(
            status="APPROVED", category_id=results[0].category_id, note="Existing"
        ),
        admin,
    )
    assert linked.category_id == results[0].category_id
    label = f"Семейство {uuid4()}"
    await db.categorytranslation.create(
        data={"category_id": linked.category_id, "locale": "ru", "name": label}
    )
    translated = await categories.propose(
        categories.ProposalBody(name=label, description="Описание семейства"), user
    )
    with pytest.raises(HTTPException):
        await categories.decide(translated.id, decision, admin)


@pytest.mark.anyio
async def test_postgres_approval_rollback(real_db):
    db = real_db
    user = await make_user(db)
    proposal = await categories.propose(
        categories.ProposalBody(name=f"Rollback {uuid4()}", description="Production family"), user
    )
    absent_admin = NS(id=str(uuid4()), role="ADMIN", is_email_verified=True, deleted_at=None)
    with pytest.raises(Exception):
        await categories.decide(
            proposal.id, categories.DecisionBody(status="APPROVED", note="Review"), absent_admin
        )
    assert await db.category.count(where={"default_name": proposal.name}) == 0
    assert (await db.categoryproposal.find_unique(where={"id": proposal.id})).status == "PENDING"


@pytest.mark.anyio
async def test_postgres_draft_publish_readiness_removal_and_ownership(real_db):
    db = real_db
    user, factory, category, item, address = await seed_factory(db)
    draft_id = uuid4()
    await categories.save_draft(
        draft_id, categories.DraftBody(data={"item_name": "Unfinished"}), user
    )
    assert not (await categories.setup(user))["ready"]
    with pytest.raises(HTTPException):
        await categories.publish_draft(draft_id, user)
    assert await db.inventorydraft.find_unique(where={"id": str(draft_id)})
    await categories.select_categories(categories.SelectionBody(category_ids=[category.id]), user)
    data = {
        "item_id": item.id,
        "category_id": category.id,
        "quantity_available": 10,
        "price_per_unit": 2,
        "currency_code": "USD",
        "unit": "kg",
        "stock_address_id": address.id,
        "characteristics_json": {"grade": "A"},
    }
    await categories.save_draft(draft_id, categories.DraftBody(data=data), user)
    results = await asyncio.gather(
        categories.publish_draft(draft_id, user),
        categories.publish_draft(draft_id, user),
        return_exceptions=True,
    )
    assert sum(isinstance(r, HTTPException) for r in results) == 1, results
    assert await db.inventoryentry.count(where={"factory_profile_id": factory.id}) == 1
    assert (await categories.setup(user))["ready"]
    entry = await db.inventoryentry.find_first(where={"factory_profile_id": factory.id})
    customer = await make_user(db, "CUSTOMER")
    cp = await db.customerprofile.create(data={"user_id": customer.id, "display_name": "Customer"})
    req = await db.request.create(
        data={
            "customer_profile_id": cp.id,
            "category_id": category.id,
            "item_id": item.id,
            "quantity": Decimal(10),
            "destination_address_id": address.id,
            "preferred_currency_code": "USD",
            "requested_characteristics_json": Json({"quantity_unit": "kg"}),
        }
    )
    await validate_bid(db, req, entry, 10, factory.id)
    bid = await pairing.create_factory_bid(
        pairing.FactoryBidBody(request_id=req.id, inventory_entry_id=entry.id, quoted_quantity=10),
        user,
    )
    await categories.select_categories(categories.SelectionBody(category_ids=[]), user)
    assert not (await categories.setup(user))["ready"]
    with pytest.raises(HTTPException):
        await validate_bid(db, req, entry, 10, factory.id)
    assert await db.matchcandidate.find_unique(where={"id": bid["candidate_id"]})
    assert await db.inventoryentry.find_unique(where={"id": entry.id})
    other, _, _, _, _ = await seed_factory(db)
    await categories.save_draft(draft_id, categories.DraftBody(data={}), user)
    with pytest.raises(HTTPException):
        await categories.save_draft(draft_id, categories.DraftBody(data={"stolen": True}), other)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "role,owner,verified",
    [
        ("FACTORY", False, True),
        ("LOGIST", False, True),
        ("ADMIN", False, True),
        ("CUSTOMER", False, True),
        ("CUSTOMER", True, False),
    ],
)
async def test_only_verified_owning_customer_can_select(monkeypatch, role, owner, verified):
    user = NS(id="caller", role=role, is_email_verified=verified, deleted_at=None)
    req = NS(
        status="PAIRING_IN_PROGRESS", customer_profile=NS(user_id="caller" if owner else "other")
    )
    db = NS(
        matchcandidate=NS(
            find_first=AsyncMock(
                return_value=NS(logistic_offer_id="logistics", status="PENDING", request=req)
            )
        )
    )
    monkeypatch.setattr(pairing, "prisma", db)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        result = await client.post("/pairing/select-candidate", json={"candidate_id": "candidate"})
    assert result.status_code == 403


@pytest.mark.anyio
async def test_removed_capability_rechecked_at_selection(monkeypatch):
    db, req, inv, _, user = domain()
    user.role = "CUSTOMER"
    req.customer_profile = NS(user_id=user.id)
    db.matchcandidate = NS(
        find_first=AsyncMock(
            return_value=NS(
                logistic_offer_id="logistics",
                status="PENDING",
                request=req,
                inventory_entry_id=inv.id,
                quoted_quantity=Decimal(10),
            )
        )
    )
    db.inventoryentry = NS(find_unique=AsyncMock(return_value=inv))
    db.factorycategory.find_first.return_value = None
    monkeypatch.setattr(pairing, "prisma", db)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        response = await client.post(
            "/pairing/select-candidate", json={"candidate_id": "candidate"}
        )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_unrelated_factory_cannot_reopen_completed_request(monkeypatch):
    user = NS(id="other", role="FACTORY", is_email_verified=True, deleted_at=None)
    db = NS(request=NS(find_unique=AsyncMock(return_value=NS(status="COMPLETED", deleted_at=None))))
    monkeypatch.setattr(requests, "prisma", db)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        result = await client.patch(
            "/requests/request/status", json={"status": "PAIRING_IN_PROGRESS"}
        )
    assert result.status_code == 403


@pytest.mark.anyio
@pytest.mark.parametrize("name,expected", [(" cotton shirt ", True), ("Silk scarf", False)])
async def test_text_only_requests_do_not_match_arbitrary_products(name, expected):
    db, req, inv, item, _ = domain()
    req.item_id = None
    req.requested_name_text = name
    item.name = "Cotton Shirt"
    if expected:
        await validate_bid(db, req, inv, 10, "factory")
    else:
        with pytest.raises(HTTPException):
            await validate_bid(db, req, inv, 10, "factory")


@pytest.mark.anyio
@pytest.mark.parametrize("group", [False, True])
async def test_inactive_category_and_parent_group_are_not_eligible(group):
    db, req, inv, _, _ = domain()
    db.category.find_first = AsyncMock(
        return_value=NS(id="category", attributes_schema=None) if group else None
    )
    with pytest.raises(HTTPException):
        await validate_bid(db, req, inv, 10, "factory")


@pytest.mark.anyio
async def test_legacy_request_cannot_publish_a_category(monkeypatch):
    user = NS(id="customer", role="CUSTOMER", is_email_verified=True, deleted_at=None)
    db = NS(customerprofile=NS(find_unique=AsyncMock(return_value=NS(id="profile"))))
    monkeypatch.setattr(requests, "prisma", db)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        response = await client.post(
            "/requests/",
            json={
                "category_name_text": "Unreviewed category",
                "requested_name_text": "Product",
                "quantity": 10,
            },
        )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_legacy_inventory_cannot_publish_a_category(real_db):
    db = real_db
    user, _, _, _, address = await seed_factory(db)
    name = f"Unreviewed {uuid4()}"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        response = await client.post(
            "/requests/inventory-entries",
            json={
                "category_name_text": name,
                "item_name": "Product",
                "unit": "kg",
                "quantity_available": 10,
                "price_per_unit": 2,
                "currency_code": "USD",
                "stock_address_id": address.id,
            },
        )
    assert response.status_code == 422
    assert await db.category.count(where={"default_name": name}) == 0
