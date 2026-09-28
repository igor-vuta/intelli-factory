"""Shared catalogue: permissions (mocked) and acceptance checks on disposable PostgreSQL."""

import asyncio
import importlib
import os
import sys
from pathlib import Path
from types import SimpleNamespace as NS
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from prisma import Json, Prisma

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.append(str(API_ROOT))
catalogue = importlib.import_module("routers.catalogue")
requests = importlib.import_module("routers.requests")
governance = importlib.import_module("services.category_governance")


@pytest.fixture
def anyio_backend():
    return "asyncio"


def app_for(user):
    app = FastAPI()
    app.include_router(catalogue.router, prefix="/api/catalogue")
    app.dependency_overrides[catalogue._ensure_db_connection] = lambda: None
    app.dependency_overrides[requests._require_authenticated_user] = lambda: user
    return app


@pytest.mark.anyio
@pytest.mark.parametrize(
    "role, path, body",
    [
        # Categories stay governed: customers and factories propose them for review instead.
        ("CUSTOMER", "/api/catalogue/categories", {"name": "Metals", "locale": "en"}),
        ("FACTORY", "/api/catalogue/categories", {"name": "Metals", "locale": "en"}),
        ("LOGIST", "/api/catalogue/items", {}),
        ("FACTORY", f"/api/catalogue/items/{uuid4()}/maintenance", {"action": "retire"}),
        ("CUSTOMER", f"/api/catalogue/items/{uuid4()}/label", {"locale": "en", "name": "Steel"}),
    ],
)
async def test_only_permitted_roles_change_the_catalogue(role, path, body):
    user = NS(id="u1", role=role, is_email_verified=True, deleted_at=None)
    method = "PUT" if path.endswith("/label") else "POST"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(user)), base_url="http://test"
    ) as client:
        response = await client.request(method, path, json=body)
    assert response.status_code == 403


def test_names_normalise_across_width_case_and_spacing():
    assert catalogue.normalized("  Ｓteel   SHEET ") == catalogue.normalized("steel sheet")
    with pytest.raises(ValueError):
        catalogue.ItemBody(name="--", locale="en", category_id=uuid4(), unit="kg")
    with pytest.raises(ValueError):
        catalogue.ItemBody(name="Steel", locale="en", category_id=uuid4(), unit="bags")


@pytest.fixture
async def real_db(monkeypatch):
    url = os.environ.get("CATEGORY_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set CATEGORY_TEST_DATABASE_URL to disposable PostgreSQL")
    assert "127.0.0.1:55439/factory_categories_" in url
    db = Prisma(datasource={"url": url})
    await db.connect()
    monkeypatch.setattr(catalogue, "prisma", db)
    monkeypatch.setattr(requests, "prisma", db)
    try:
        yield db
    finally:
        await db.disconnect()


async def make_user(db, role):
    return await db.user.create(
        data={
            "email": f"{uuid4()}@test.local",
            "password_hash": "unused-test-hash",
            "role": role,
            "is_email_verified": True,
        }
    )


async def make_category(db):
    return await db.category.create(
        data={"slug": str(uuid4()), "default_name": f"Metals {uuid4()}"}
    )


def item_body(category, name, locale="ru", unit="kg", **attributes):
    return catalogue.ItemBody(
        name=name, locale=locale, category_id=category.id, unit=unit, attributes=attributes
    )


@pytest.mark.anyio
async def test_simultaneous_creation_returns_one_record(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    category = await make_category(real_db)
    body = item_body(category, "Стальной лист", thickness="2 mm")

    rows = await asyncio.gather(*(catalogue.create_item(body, customer) for _ in range(5)))

    assert len({r["id"] for r in rows}) == 1
    assert sum(r["created"] for r in rows) == 1
    assert rows[0]["record_state"] == "NEW"
    assert await real_db.item.count(where={"category_id": category.id}) == 1


@pytest.mark.anyio
async def test_a_russian_item_is_found_and_reused_through_english_and_kazakh(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    factory = await make_user(real_db, "FACTORY")
    admin = await make_user(real_db, "ADMIN")
    category = await make_category(real_db)
    created = await catalogue.create_item(item_body(category, "Стальной лист"), customer)

    # Before a translation exists the original label is shown and marked as a fallback.
    before = await catalogue.search(locale="en", q="", category_id=category.id, user=factory)
    assert before["items"][0]["name"] == "Стальной лист"
    assert before["items"][0]["fallback"] is True
    assert before["items"][0]["label_locale"] == "ru"

    for locale, name in (("en", "Steel sheet"), ("kk", "Болат парақ")):
        await catalogue.label(
            "items", created["id"], catalogue.LabelBody(locale=locale, name=name), admin
        )
    for locale, q in (("en", "steel"), ("kk", "болат")):
        found = await catalogue.search(locale=locale, q=q, category_id=category.id, user=factory)
        assert [i["id"] for i in found["items"]] == [created["id"]]
        assert found["items"][0]["fallback"] is False

    # Creating it again under its English name reuses the canonical record.
    again = await catalogue.create_item(item_body(category, "steel SHEET", locale="en"), factory)
    assert again == {**again, "id": created["id"], "created": False}


@pytest.mark.anyio
async def test_variants_stay_distinct(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    category = await make_category(real_db)
    base = await catalogue.create_item(item_body(category, "Sheet", "en", thickness="2 mm"), customer)
    thicker = await catalogue.create_item(
        item_body(category, "Sheet", "en", thickness="3 mm"), customer
    )
    by_count = await catalogue.create_item(
        item_body(category, "Sheet", "en", "pcs", thickness="2 mm"), customer
    )
    assert len({base["id"], thicker["id"], by_count["id"]}) == 3
    assert all(r["created"] for r in (base, thicker, by_count))


@pytest.mark.anyio
async def test_admin_categories_are_immediate_and_deduplicated(real_db):
    admin = await make_user(real_db, "ADMIN")
    body = catalogue.CategoryBody(name=f"Металлы {uuid4()}", locale="ru")
    rows = await asyncio.gather(*(catalogue.create_category(body, admin) for _ in range(3)))
    assert len({r["id"] for r in rows}) == 1
    assert sum(r["created"] for r in rows) == 1


@pytest.mark.anyio
async def test_label_correction_keeps_the_old_name_searchable(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    admin = await make_user(real_db, "ADMIN")
    category = await make_category(real_db)
    created = await catalogue.create_item(item_body(category, "Steel shet", "en"), customer)
    await catalogue.label(
        "items", created["id"], catalogue.LabelBody(locale="en", name="Steel sheet"), admin
    )
    found = await catalogue.search(locale="en", q="shet", category_id=category.id, user=customer)
    assert [i["name"] for i in found["items"]] == ["Steel sheet"]


@pytest.mark.anyio
async def test_merged_products_keep_references_and_still_match(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    admin = await make_user(real_db, "ADMIN")
    category = await make_category(real_db)
    keep = await catalogue.create_item(item_body(category, "Steel sheet", "en"), customer)
    duplicate = await catalogue.create_item(item_body(category, "Лист стальной"), customer)
    assert keep["id"] != duplicate["id"]

    with pytest.raises(HTTPException):
        # A different unit is a different product and can't be merged.
        other = await catalogue.create_item(item_body(category, "Sheet", "en", "t"), customer)
        await catalogue.maintain(
            "items", other["id"], catalogue.MaintenanceBody(action="merge", target_id=keep["id"]), admin
        )
    await catalogue.maintain(
        "items", duplicate["id"], catalogue.MaintenanceBody(action="merge", target_id=keep["id"]), admin
    )

    source = await real_db.item.find_unique(where={"id": duplicate["id"]})
    assert (source.record_state, source.merged_into_id) == ("MERGED", keep["id"])
    found = await catalogue.search(locale="en", q="лист", category_id=category.id, user=customer)
    assert [i["id"] for i in found["items"]] == [keep["id"]]
    # A request on the merged record matches stock of the canonical one.
    canonical = await governance.canonical_item(real_db, source)
    assert canonical.id == keep["id"]


@pytest.mark.anyio
async def test_identity_characteristics_cannot_be_overridden(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    category = await make_category(real_db)
    created = await catalogue.create_item(
        item_body(category, "Cotton fabric", "en", material="cotton"), customer
    )
    item = await real_db.item.find_unique(where={"id": created["id"]})
    governance.validate_identity(item, {"material": "cotton", "colour": "white"})
    with pytest.raises(HTTPException):
        governance.validate_identity(item, {"material": "linen"})
    await real_db.item.update(where={"id": item.id}, data={"identity_attributes": Json({})})


@pytest.mark.anyio
async def test_the_merged_name_reuses_the_canonical_product(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    admin = await make_user(real_db, "ADMIN")
    category = await make_category(real_db)
    keep = await catalogue.create_item(item_body(category, "Steel sheet", "en"), customer)
    duplicate = await catalogue.create_item(item_body(category, "Лист стальной"), customer)
    await catalogue.maintain(
        "items", duplicate["id"], catalogue.MaintenanceBody(action="merge", target_id=keep["id"]), admin
    )
    again = await catalogue.create_item(item_body(category, "лист  СТАЛЬНОЙ"), customer)
    assert (again["id"], again["created"]) == (keep["id"], False)


@pytest.mark.anyio
async def test_retired_products_block_recreation_until_established(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    admin = await make_user(real_db, "ADMIN")
    category = await make_category(real_db)
    bolt = await catalogue.create_item(item_body(category, "Bolt M8", "en", "pcs"), customer)
    retire = catalogue.MaintenanceBody(action="retire")
    await catalogue.maintain("items", bolt["id"], retire, admin)
    with pytest.raises(HTTPException) as refused:
        await catalogue.create_item(item_body(category, "Bolt M8", "en", "pcs"), customer)
    assert "administrator" in refused.value.detail

    establish = catalogue.MaintenanceBody(action="establish")
    await catalogue.maintain("items", bolt["id"], establish, admin)
    restored = await real_db.item.find_unique(where={"id": bolt["id"]})
    assert (restored.status, restored.record_state) == ("ACTIVE", "ESTABLISHED")
    again = await catalogue.create_item(item_body(category, "Bolt M8", "en", "pcs"), customer)
    assert (again["id"], again["created"]) == (bolt["id"], False)


@pytest.mark.anyio
async def test_products_of_a_category_that_became_a_group_are_not_offered(real_db):
    customer = await make_user(real_db, "CUSTOMER")
    category = await make_category(real_db)
    product = await catalogue.create_item(item_body(category, "Wire", "en", "m"), customer)
    await real_db.category.create(
        data={"slug": str(uuid4()), "default_name": "Copper wire", "parent_id": category.id}
    )
    found = await catalogue.search(locale="en", q="", category_id=category.id, user=customer)
    assert product["id"] not in [i["id"] for i in found["items"]]
    assert next(c for c in found["categories"] if c["id"] == category.id)["selectable"] is False
