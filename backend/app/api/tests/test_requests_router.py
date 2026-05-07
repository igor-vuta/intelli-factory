import importlib
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.append(str(API_ROOT))

requests_router = importlib.import_module("routers.requests")


class FakePrisma(SimpleNamespace):
    pass


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_app_with_user(user):
    app = FastAPI()
    app.include_router(requests_router.router, prefix="/api/requests")
    app.dependency_overrides[requests_router._ensure_db_connection] = lambda: None
    app.dependency_overrides[requests_router._require_authenticated_user] = lambda: user
    return app


def _build_base_prisma_mocks():
    fake = FakePrisma()
    fake.session = SimpleNamespace(update=AsyncMock())
    fake.country = SimpleNamespace(find_many=AsyncMock(return_value=[]))
    fake.category = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_first=AsyncMock())
    fake.currency = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_unique=AsyncMock())
    fake.address = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_first=AsyncMock())
    fake.customerprofile = SimpleNamespace(find_unique=AsyncMock(return_value=None))
    fake.item = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_first=AsyncMock())
    fake.request = SimpleNamespace(create=AsyncMock(), find_many=AsyncMock(), find_unique=AsyncMock(), update=AsyncMock())
    fake.factoryprofile = SimpleNamespace(find_unique=AsyncMock(return_value=None))
    fake.inventoryentry = SimpleNamespace(
        create=AsyncMock(),
        find_many=AsyncMock(),
        find_first=AsyncMock(),
        update=AsyncMock(),
    )
    fake.logistprofile = SimpleNamespace(find_unique=AsyncMock(return_value=None))
    fake.logisticoffer = SimpleNamespace(create=AsyncMock(), find_many=AsyncMock())
    return fake


@pytest.mark.anyio
async def test_bootstrap_returns_catalog_data(monkeypatch):
    user = SimpleNamespace(id="u1", role="CUSTOMER", is_email_verified=True)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.category.find_many = AsyncMock(
        return_value=[SimpleNamespace(id="cat-1", default_name="Textiles", slug="textiles")]
    )
    fake_prisma.currency.find_many = AsyncMock(
        return_value=[SimpleNamespace(code="USD", name="US Dollar")]
    )
    fake_prisma.address.find_many = AsyncMock(
        return_value=[
            SimpleNamespace(
                id="addr-1",
                street="Main 1",
                city=SimpleNamespace(default_name="Almaty"),
                region=SimpleNamespace(default_name="Almaty Region"),
                country=SimpleNamespace(default_name="Kazakhstan"),
            )
        ]
    )
    fake_prisma.customerprofile.find_unique = AsyncMock(
        return_value=SimpleNamespace(
            id="prof-1",
            primary_address_id="addr-1",
            registration_country_code=None,
            registration_address=None,
        )
    )
    fake_prisma.request.find_many = AsyncMock(return_value=[])

    monkeypatch.setattr(requests_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/api/requests/bootstrap")

    assert response.status_code == 200
    data = response.json()
    assert data["categories"][0]["id"] == "cat-1"
    assert data["currencies"][0]["code"] == "USD"
    assert data["addresses"][0]["id"] == "addr-1"
    assert data["user"]["id"] == "u1"


@pytest.mark.anyio
async def test_create_request_success_for_verified_customer(monkeypatch):
    category_id = "11111111-1111-1111-1111-111111111111"
    destination_address_id = "22222222-2222-2222-2222-222222222222"

    user = SimpleNamespace(id="u1", role="CUSTOMER", is_email_verified=True)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.customerprofile.find_unique = AsyncMock(
        return_value=SimpleNamespace(id="cp-1", primary_address_id=destination_address_id)
    )
    fake_prisma.category.find_first = AsyncMock(
        return_value=SimpleNamespace(id=category_id, status="ACTIVE", deleted_at=None)
    )
    fake_prisma.address.find_first = AsyncMock(return_value=SimpleNamespace(id=destination_address_id))
    fake_prisma.currency.find_unique = AsyncMock(return_value=SimpleNamespace(code="USD"))
    fake_prisma.request.create = AsyncMock(return_value=SimpleNamespace(id="req-1"))

    monkeypatch.setattr(requests_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/requests/",
            json={
                    "category_id": category_id,
                "requested_name_text": "Custom textile batch",
                "quantity": 100,
                    "destination_address_id": destination_address_id,
                "preferred_currency_code": "USD",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["request_id"] == "req-1"


@pytest.mark.anyio
async def test_create_request_requires_verified_email(monkeypatch):
    user = SimpleNamespace(id="u1", role="CUSTOMER", is_email_verified=False)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    monkeypatch.setattr(requests_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/requests/",
            json={
                "category_id": "cat-1",
                "requested_name_text": "Custom textile batch",
                "quantity": 10,
                "destination_address_id": "addr-1",
                "preferred_currency_code": "USD",
            },
        )

    assert response.status_code == 403
    assert "Email verification" in response.json()["detail"]


@pytest.mark.anyio
async def test_factory_can_create_inventory_entry(monkeypatch):
    item_id = "33333333-3333-3333-3333-333333333333"
    stock_address_id = "44444444-4444-4444-4444-444444444444"

    user = SimpleNamespace(id="factory-user", role="FACTORY", is_email_verified=True)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.factoryprofile.find_unique = AsyncMock(return_value=SimpleNamespace(id="fp-1"))
    fake_prisma.item.find_first = AsyncMock(return_value=SimpleNamespace(id=item_id))
    fake_prisma.address.find_first = AsyncMock(return_value=SimpleNamespace(id=stock_address_id))
    fake_prisma.currency.find_unique = AsyncMock(return_value=SimpleNamespace(code="USD"))
    fake_prisma.inventoryentry.create = AsyncMock(return_value=SimpleNamespace(id="inv-1"))

    monkeypatch.setattr(requests_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/requests/inventory-entries",
            json={
                    "item_id": item_id,
                    "stock_address_id": stock_address_id,
                "quantity_available": 500,
                "price_per_unit": 22.5,
                "currency_code": "USD",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["message"] == "Inventory entry created"


@pytest.mark.anyio
async def test_factory_can_toggle_inventory_entry_status(monkeypatch):
    user = SimpleNamespace(id="factory-user", role="FACTORY", is_email_verified=True)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.factoryprofile.find_unique = AsyncMock(return_value=SimpleNamespace(id="fp-1"))
    fake_prisma.inventoryentry.find_first = AsyncMock(
        return_value=SimpleNamespace(id="inv-1", factory_profile_id="fp-1", status="ACTIVE")
    )
    fake_prisma.inventoryentry.update = AsyncMock(return_value=SimpleNamespace(id="inv-1"))
    monkeypatch.setattr(requests_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.patch(
            "/api/requests/inventory-entries/inv-1/status",
            json={"status": "PAUSED"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    fake_prisma.inventoryentry.update.assert_awaited_once_with(
        where={"id": "inv-1"},
        data={"status": "PAUSED"},
    )
