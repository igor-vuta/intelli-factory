"""Lifecycle guards for the record actions: edit, pause, resume, cancel and delete a request;
edit stock; withdraw bids and quotes; edit and pause a delivery service."""

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

requests_router = importlib.import_module("routers.requests")
pairing_router = importlib.import_module("routers.pairing")

CUSTOMER = SimpleNamespace(id="cust-user", role="CUSTOMER", is_email_verified=True)
FACTORY = SimpleNamespace(id="fact-user", role="FACTORY", is_email_verified=True)
LOGIST = SimpleNamespace(id="log-user", role="LOGIST", is_email_verified=True)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _app(module, prefix, user):
    app = FastAPI()
    app.include_router(module.router, prefix=prefix)
    app.dependency_overrides[module._ensure_db_connection] = lambda: None
    app.dependency_overrides[module._require_authenticated_user] = lambda: user
    return app


async def _call(app, method, url, json=None):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, url, json=json)


def _request_row(status="PENDING", owner="cust-user"):
    return SimpleNamespace(
        id="req-1",
        status=status,
        deleted_at=None,
        customer_profile=SimpleNamespace(user_id=owner),
    )


def _prisma(request_row=None, live_candidates=0):
    return SimpleNamespace(
        request=SimpleNamespace(
            find_unique=AsyncMock(return_value=request_row),
            update=AsyncMock(),
        ),
        matchcandidate=SimpleNamespace(
            count=AsyncMock(return_value=live_candidates),
            update_many=AsyncMock(),
            update=AsyncMock(),
            find_first=AsyncMock(),
            find_many=AsyncMock(return_value=[]),
        ),
        currency=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(code="KZT"))),
        factoryprofile=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="fp-1"))),
        logistprofile=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="lp-1"))),
        inventoryentry=SimpleNamespace(find_first=AsyncMock(), update=AsyncMock()),
        transaction=SimpleNamespace(find_unique=AsyncMock(return_value=None)),
        logisticoffer=SimpleNamespace(find_first=AsyncMock(), update=AsyncMock()),
        session=SimpleNamespace(update=AsyncMock()),
    )


# --- Customer: cancel ---------------------------------------------------------------------


@pytest.mark.anyio
async def test_cancel_before_contract_expires_open_offers(monkeypatch):
    fake = _prisma(_request_row("PAIRING_IN_PROGRESS"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER),
        "PATCH",
        "/api/requests/req-1/status",
        {"status": "CANCELLED"},
    )
    assert response.status_code == 200
    fake.request.update.assert_awaited_once_with(where={"id": "req-1"}, data={"status": "CANCELLED"})
    fake.matchcandidate.update_many.assert_awaited_once()
    assert fake.matchcandidate.update_many.await_args.kwargs["data"] == {"status": "EXPIRED"}


@pytest.mark.anyio
async def test_cancel_after_contract_is_refused(monkeypatch):
    fake = _prisma(_request_row("CONTRACT_DRAFTED"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER),
        "PATCH",
        "/api/requests/req-1/status",
        {"status": "CANCELLED"},
    )
    assert response.status_code == 409
    fake.request.update.assert_not_awaited()


# --- Customer: edit -----------------------------------------------------------------------


@pytest.mark.anyio
async def test_edit_before_any_bid_updates_quantity_and_currency(monkeypatch):
    fake = _prisma(_request_row("PENDING"), live_candidates=0)
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER),
        "PATCH",
        "/api/requests/req-1",
        {"quantity": 25, "preferred_currency_code": "kzt"},
    )
    assert response.status_code == 200
    data = fake.request.update.await_args.kwargs["data"]
    assert data["quantity"] == Decimal("25")
    assert data["preferred_currency"] == {"connect": {"code": "KZT"}}


@pytest.mark.anyio
async def test_edit_after_a_bid_is_refused(monkeypatch):
    fake = _prisma(_request_row("PAIRING_IN_PROGRESS"), live_candidates=2)
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER),
        "PATCH",
        "/api/requests/req-1",
        {"quantity": 25},
    )
    assert response.status_code == 409
    fake.request.update.assert_not_awaited()


@pytest.mark.anyio
async def test_edit_someone_elses_request_is_forbidden(monkeypatch):
    fake = _prisma(_request_row("PENDING", owner="someone-else"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER),
        "PATCH",
        "/api/requests/req-1",
        {"quantity": 25},
    )
    assert response.status_code == 403


# --- Customer: pause and resume -----------------------------------------------------------


@pytest.mark.anyio
async def test_pause_a_searching_request(monkeypatch):
    fake = _prisma(_request_row("PAIRING_IN_PROGRESS"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER), "POST", "/api/requests/req-1/pause"
    )
    assert response.status_code == 200
    fake.request.update.assert_awaited_once_with(where={"id": "req-1"}, data={"status": "PAUSED"})


@pytest.mark.anyio
async def test_pause_after_matching_is_refused(monkeypatch):
    fake = _prisma(_request_row("COMPLETED"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER), "POST", "/api/requests/req-1/pause"
    )
    assert response.status_code == 409


@pytest.mark.anyio
@pytest.mark.parametrize(("offers", "expected"), [(3, "PAIRING_IN_PROGRESS"), (0, "PENDING")])
async def test_resume_returns_to_the_right_searching_status(monkeypatch, offers, expected):
    fake = _prisma(_request_row("PAUSED"), live_candidates=offers)
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER), "POST", "/api/requests/req-1/resume"
    )
    assert response.status_code == 200
    fake.request.update.assert_awaited_once_with(where={"id": "req-1"}, data={"status": expected})


# --- Customer: delete ---------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_a_cancelled_request_soft_deletes_it_and_its_offers(monkeypatch):
    fake = _prisma(_request_row("CANCELLED"), live_candidates=0)
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER), "DELETE", "/api/requests/req-1"
    )
    assert response.status_code == 200
    assert isinstance(fake.request.update.await_args.kwargs["data"]["deleted_at"], datetime)
    assert "deleted_at" in fake.matchcandidate.update_many.await_args.kwargs["data"]


@pytest.mark.anyio
@pytest.mark.parametrize(("status", "offers"), [("CONTRACT_DRAFTED", 0), ("PAIRING_IN_PROGRESS", 1)])
async def test_delete_is_refused_once_offers_or_a_contract_exist(monkeypatch, status, offers):
    fake = _prisma(_request_row(status), live_candidates=offers)
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER), "DELETE", "/api/requests/req-1"
    )
    assert response.status_code == 409
    fake.request.update.assert_not_awaited()


# --- Factory: edit stock ------------------------------------------------------------------


def _entry(price="25"):
    return SimpleNamespace(id="inv-1", price_per_unit=Decimal(price))


@pytest.mark.anyio
async def test_stock_price_is_locked_while_bids_are_open(monkeypatch):
    fake = _prisma(live_candidates=1)
    fake.inventoryentry.find_first = AsyncMock(return_value=_entry("25"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", FACTORY),
        "PATCH",
        "/api/requests/inventory-entries/inv-1",
        {"price_per_unit": 30},
    )
    assert response.status_code == 409
    fake.inventoryentry.update.assert_not_awaited()


@pytest.mark.anyio
async def test_stock_quantity_can_change_with_bids_open(monkeypatch):
    fake = _prisma(live_candidates=1)
    fake.inventoryentry.find_first = AsyncMock(return_value=_entry("25"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", FACTORY),
        "PATCH",
        "/api/requests/inventory-entries/inv-1",
        {"quantity_available": 800, "price_per_unit": 25},
    )
    assert response.status_code == 200
    assert fake.inventoryentry.update.await_args.kwargs["data"] == {
        "quantity_available": Decimal("800")
    }


# --- Carrier: edit and pause a delivery service -------------------------------------------


def _offer(days_min=1, days_max=4):
    return SimpleNamespace(id="off-1", estimated_days_min=days_min, estimated_days_max=days_max)


@pytest.mark.anyio
async def test_offer_edit_keeps_days_in_order(monkeypatch):
    fake = _prisma()
    fake.logisticoffer.find_first = AsyncMock(return_value=_offer(1, 4))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", LOGIST),
        "PATCH",
        "/api/requests/logistic-offers/off-1",
        {"estimated_days_min": 6},
    )
    assert response.status_code == 422
    fake.logisticoffer.update.assert_not_awaited()


@pytest.mark.anyio
async def test_offer_can_be_paused_by_its_owner_only(monkeypatch):
    fake = _prisma()
    fake.logisticoffer.find_first = AsyncMock(return_value=_offer())
    monkeypatch.setattr(requests_router, "prisma", fake)
    app = _app(requests_router, "/api/requests", LOGIST)
    response = await _call(app, "PATCH", "/api/requests/logistic-offers/off-1/status", {"status": "paused"})
    assert response.status_code == 200
    fake.logisticoffer.update.assert_awaited_once_with(where={"id": "off-1"}, data={"status": "PAUSED"})

    fake.logisticoffer.find_first = AsyncMock(return_value=None)
    response = await _call(app, "PATCH", "/api/requests/logistic-offers/other/status", {"status": "PAUSED"})
    assert response.status_code == 404


# --- Factory: withdraw a bid --------------------------------------------------------------


def _bid(status="PENDING", request_status="PAIRING_IN_PROGRESS", owner="fp-1"):
    return SimpleNamespace(
        id="cand-1",
        request_id="req-1",
        inventory_entry_id="inv-1",
        status=status,
        inventory_entry=SimpleNamespace(factory_profile_id=owner),
        request=SimpleNamespace(status=request_status),
    )


@pytest.mark.anyio
async def test_withdraw_bid_removes_it_and_proposals_built_on_it(monkeypatch):
    fake = _prisma(live_candidates=0)
    fake.matchcandidate.find_first = AsyncMock(return_value=_bid())
    monkeypatch.setattr(pairing_router, "prisma", fake)
    response = await _call(
        _app(pairing_router, "/api/pairing", FACTORY), "DELETE", "/api/pairing/factory-bids/cand-1"
    )
    assert response.status_code == 200
    where = fake.matchcandidate.update_many.await_args.kwargs["where"]
    assert where["request_id"] == "req-1" and where["inventory_entry_id"] == "inv-1"
    # Nothing left open, so the request waits for bids again.
    fake.request.update.assert_awaited_once_with(where={"id": "req-1"}, data={"status": "PENDING"})


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("bid", "code"),
    [
        (_bid(owner="another-factory"), 404),
        (_bid(status="ACCEPTED", request_status="CONTRACT_DRAFTED"), 409),
    ],
)
async def test_withdraw_bid_guards(monkeypatch, bid, code):
    fake = _prisma()
    fake.matchcandidate.find_first = AsyncMock(return_value=bid)
    monkeypatch.setattr(pairing_router, "prisma", fake)
    response = await _call(
        _app(pairing_router, "/api/pairing", FACTORY), "DELETE", "/api/pairing/factory-bids/cand-1"
    )
    assert response.status_code == code
    fake.matchcandidate.update_many.assert_not_awaited()


# --- Carrier: withdraw a quote and quoting while paused -----------------------------------


@pytest.mark.anyio
async def test_withdraw_own_open_quote(monkeypatch):
    fake = _prisma(live_candidates=0)
    fake.matchcandidate.find_first = AsyncMock(
        return_value=SimpleNamespace(
            id="quote-1",
            request_id="req-1",
            status="PENDING",
            logistic_offer=SimpleNamespace(logist_profile_id="lp-1"),
            request=SimpleNamespace(status="PAIRING_IN_PROGRESS"),
        )
    )
    monkeypatch.setattr(pairing_router, "prisma", fake)
    response = await _call(
        _app(pairing_router, "/api/pairing", LOGIST), "DELETE", "/api/pairing/logist-quotes/quote-1"
    )
    assert response.status_code == 200
    assert "deleted_at" in fake.matchcandidate.update.await_args.kwargs["data"]


@pytest.mark.anyio
async def test_quoting_with_a_paused_service_is_refused(monkeypatch):
    fake = _prisma()
    fake.matchcandidate.find_first = AsyncMock(
        return_value=SimpleNamespace(
            request_id="req-1",
            inventory_entry_id="inv-1",
            request=SimpleNamespace(status="PAIRING_IN_PROGRESS"),
            inventory_entry=SimpleNamespace(),
        )
    )
    # No service that is not paused, but a paused one exists.
    fake.logisticoffer.find_first = AsyncMock(
        side_effect=[None, SimpleNamespace(id="off-1", status="PAUSED", updated_at=datetime.now(timezone.utc))]
    )
    monkeypatch.setattr(pairing_router, "prisma", fake)
    response = await _call(
        _app(pairing_router, "/api/pairing", LOGIST),
        "POST",
        "/api/pairing/logist-quotes",
        {
            "factory_bid_id": "cand-1",
            "title": "Regional",
            "base_price": 10,
            "currency_code": "KZT",
            "delivery_price": 50,
            "delivery_days": 2,
        },
    )
    assert response.status_code == 409


@pytest.mark.anyio
async def test_factory_cannot_reopen_a_paused_request(monkeypatch):
    fake = _prisma(_request_row("PAUSED"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", FACTORY),
        "PATCH",
        "/api/requests/req-1/status",
        {"status": "PAIRING_IN_PROGRESS"},
    )
    assert response.status_code == 409
    fake.request.update.assert_not_awaited()


@pytest.mark.anyio
async def test_a_request_with_an_order_cannot_be_deleted(monkeypatch):
    fake = _prisma(_request_row("CANCELLED"))
    fake.transaction.find_unique = AsyncMock(return_value=SimpleNamespace(id="tx-1"))
    monkeypatch.setattr(requests_router, "prisma", fake)
    response = await _call(
        _app(requests_router, "/api/requests", CUSTOMER), "DELETE", "/api/requests/req-1"
    )
    assert response.status_code == 409
    fake.request.update.assert_not_awaited()
