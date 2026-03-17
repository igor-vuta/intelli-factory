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
    app.dependency_overrides[requests_router._require_authenticated_user] = lambda: user
    return app


def _build_base_prisma_mocks():
    fake = FakePrisma()
    fake.session = SimpleNamespace(update=AsyncMock())
    fake.category = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_first=AsyncMock())
    fake.currency = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_unique=AsyncMock())
    fake.address = SimpleNamespace(find_many=AsyncMock(return_value=[]), find_first=AsyncMock())
    fake.customerprofile = SimpleNamespace(find_unique=AsyncMock())
    fake.item = SimpleNamespace(find_first=AsyncMock())
    fake.request = SimpleNamespace(create=AsyncMock(), find_many=AsyncMock(), find_unique=AsyncMock(), update=AsyncMock())
    fake.factoryprofile = SimpleNamespace(find_unique=AsyncMock())
    fake.inventoryentry = SimpleNamespace(create=AsyncMock(), find_many=AsyncMock())
    fake.logistprofile = SimpleNamespace(find_unique=AsyncMock())
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
    user = SimpleNamespace(id="u1", role="CUSTOMER", is_email_verified=True)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.customerprofile.find_unique = AsyncMock(
        return_value=SimpleNamespace(id="cp-1", primary_address_id="addr-1")
    )
    fake_prisma.category.find_first = AsyncMock(
        return_value=SimpleNamespace(id="cat-1", status="ACTIVE", deleted_at=None)
    )
    fake_prisma.address.find_first = AsyncMock(return_value=SimpleNamespace(id="addr-1"))
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
                "category_id": "cat-1",
                "requested_name_text": "Custom textile batch",
                "quantity": 100,
                "destination_address_id": "addr-1",
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
    user = SimpleNamespace(id="factory-user", role="FACTORY", is_email_verified=True)
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.factoryprofile.find_unique = AsyncMock(return_value=SimpleNamespace(id="fp-1"))
    fake_prisma.item.find_first = AsyncMock(return_value=SimpleNamespace(id="item-1"))
    fake_prisma.address.find_first = AsyncMock(return_value=SimpleNamespace(id="addr-1"))
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
                "item_id": "item-1",
                "stock_address_id": "addr-1",
                "quantity_available": 500,
                "price_per_unit": 22.5,
                "currency_code": "USD",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["message"] == "Inventory entry created"
