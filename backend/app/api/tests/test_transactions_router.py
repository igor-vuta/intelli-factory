import importlib
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.append(str(API_ROOT))

transactions_router = importlib.import_module("routers.transactions")


class FakePrisma(SimpleNamespace):
    pass


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_app_with_user(user):
    app = FastAPI()
    app.include_router(transactions_router.router, prefix="/api/transactions")
    app.dependency_overrides[transactions_router._ensure_db_connection] = lambda: None
    app.dependency_overrides[transactions_router._require_authenticated_user] = lambda: user
    return app


def _build_base_prisma_mocks():
    fake = FakePrisma()
    fake.signature = SimpleNamespace(
        find_first=AsyncMock(),
        find_many=AsyncMock(),
        update=AsyncMock(),
        create=AsyncMock(),
    )
    fake.transaction = SimpleNamespace(
        find_first=AsyncMock(),
        find_many=AsyncMock(),
        update=AsyncMock(),
    )
    fake.request = SimpleNamespace(update=AsyncMock())
    fake.payment = SimpleNamespace(create=AsyncMock())
    fake.contractpacket = SimpleNamespace(create=AsyncMock())
    fake.eventlog = SimpleNamespace(create=AsyncMock())
    return fake


def _make_tx(status: str):
    customer_user_id = "user-customer"
    factory_user_id = "user-factory"
    logist_user_id = "user-logist"

    candidate = SimpleNamespace(
        id="cand-1",
        currency_code="USD",
        quoted_quantity=Decimal("100"),
        delivery_price=Decimal("25"),
        total_cost=Decimal("225"),
        delivery_days=4,
        inventory_entry=SimpleNamespace(
            price_per_unit=Decimal("2"),
            item=SimpleNamespace(name="Titanium Pipe"),
            factory_profile=SimpleNamespace(user_id=factory_user_id),
        ),
        logistic_offer=SimpleNamespace(logist_profile=SimpleNamespace(user_id=logist_user_id)),
    )
    now = datetime.now(timezone.utc)
    tx = SimpleNamespace(
        id="tx-1",
        request_id="req-1",
        status=status,
        request=SimpleNamespace(customer_profile=SimpleNamespace(user_id=customer_user_id)),
        selected_candidate=candidate,
        contract_packet=SimpleNamespace(version=1),
        signatures=[],
        payments=[],
        created_at=now,
        updated_at=now,
    )
    return tx


@pytest.mark.anyio
async def test_sign_contract_advances_to_contract_signing(monkeypatch):
    user = SimpleNamespace(id="user-customer", role="CUSTOMER")
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.signature.find_first = AsyncMock(
        return_value=SimpleNamespace(id="sig-1", status="PENDING")
    )
    fake_prisma.signature.find_many = AsyncMock(
        return_value=[
            SimpleNamespace(status="SIGNED"),
            SimpleNamespace(status="PENDING"),
            SimpleNamespace(status="PENDING"),
        ]
    )
    monkeypatch.setattr(transactions_router, "prisma", fake_prisma)
    monkeypatch.setattr(transactions_router, "_load_tx_with_context", AsyncMock(return_value=_make_tx("CONTRACT_DRAFTED")))
    monkeypatch.setattr(transactions_router, "_ensure_contract_setup", AsyncMock(return_value=None))

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post("/api/transactions/tx-1/sign")

    assert response.status_code == 200
    assert response.json()["transaction_status"] == "CONTRACT_SIGNING"
    fake_prisma.transaction.update.assert_awaited_with(
        where={"id": "tx-1"}, data={"status": "CONTRACT_SIGNING"}
    )
    fake_prisma.request.update.assert_awaited_with(
        where={"id": "req-1"}, data={"status": "CONTRACT_SIGNING"}
    )


@pytest.mark.anyio
async def test_capture_payment_transitions_to_payment_confirmed(monkeypatch):
    user = SimpleNamespace(id="user-customer", role="CUSTOMER")
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    fake_prisma.payment.create = AsyncMock(return_value=SimpleNamespace(id="pay-1"))
    monkeypatch.setattr(transactions_router, "prisma", fake_prisma)
    monkeypatch.setattr(transactions_router, "_load_tx_with_context", AsyncMock(return_value=_make_tx("FULLY_SIGNED")))

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post("/api/transactions/tx-1/payments/capture", json={})

    assert response.status_code == 200
    assert response.json()["transaction_status"] == "PAYMENT_CONFIRMED"
    fake_prisma.transaction.update.assert_awaited_with(
        where={"id": "tx-1"}, data={"status": "PAYMENT_CONFIRMED"}
    )
    fake_prisma.request.update.assert_awaited_with(
        where={"id": "req-1"}, data={"status": "PAYMENT_CONFIRMED"}
    )


@pytest.mark.anyio
async def test_factory_can_start_fulfillment_after_payment(monkeypatch):
    user = SimpleNamespace(id="user-factory", role="FACTORY")
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    monkeypatch.setattr(transactions_router, "prisma", fake_prisma)
    monkeypatch.setattr(
        transactions_router,
        "_load_tx_with_context",
        AsyncMock(return_value=_make_tx("PAYMENT_CONFIRMED")),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/transactions/tx-1/fulfillment/advance",
            json={"action": "START"},
        )

    assert response.status_code == 200
    assert response.json()["transaction_status"] == "FULFILLMENT_STARTED"
    fake_prisma.transaction.update.assert_awaited_with(
        where={"id": "tx-1"}, data={"status": "FULFILLMENT_STARTED"}
    )


@pytest.mark.anyio
async def test_logist_can_mark_delivered_after_factory_handoff(monkeypatch):
    user = SimpleNamespace(id="user-logist", role="LOGIST")
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    monkeypatch.setattr(transactions_router, "prisma", fake_prisma)
    monkeypatch.setattr(
        transactions_router,
        "_load_tx_with_context",
        AsyncMock(return_value=_make_tx("FULFILLMENT_STARTED")),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/transactions/tx-1/fulfillment/advance",
            json={"action": "MARK_IN_PROGRESS"},
        )

    assert response.status_code == 200
    assert response.json()["transaction_status"] == "IN_PROGRESS"
    fake_prisma.transaction.update.assert_awaited_with(
        where={"id": "tx-1"}, data={"status": "IN_PROGRESS"}
    )


@pytest.mark.anyio
async def test_logist_cannot_start_factory_handoff_step(monkeypatch):
    user = SimpleNamespace(id="user-logist", role="LOGIST")
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    monkeypatch.setattr(transactions_router, "prisma", fake_prisma)
    monkeypatch.setattr(
        transactions_router,
        "_load_tx_with_context",
        AsyncMock(return_value=_make_tx("PAYMENT_CONFIRMED")),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/transactions/tx-1/fulfillment/advance",
            json={"action": "START"},
        )

    assert response.status_code == 403
    assert "Only factory" in response.json()["detail"]


@pytest.mark.anyio
async def test_customer_can_accept_completion_when_in_progress(monkeypatch):
    user = SimpleNamespace(id="user-customer", role="CUSTOMER")
    app = _make_app_with_user(user)

    fake_prisma = _build_base_prisma_mocks()
    monkeypatch.setattr(transactions_router, "prisma", fake_prisma)
    monkeypatch.setattr(
        transactions_router,
        "_load_tx_with_context",
        AsyncMock(return_value=_make_tx("IN_PROGRESS")),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post("/api/transactions/tx-1/accept-completion")

    assert response.status_code == 200
    assert response.json()["transaction_status"] == "COMPLETED"
    fake_prisma.transaction.update.assert_awaited_with(
        where={"id": "tx-1"}, data={"status": "COMPLETED"}
    )
    fake_prisma.request.update.assert_awaited_with(
        where={"id": "req-1"}, data={"status": "COMPLETED"}
    )