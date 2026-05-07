import importlib
import sys
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

comparison_router = importlib.import_module("routers.comparison")


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_fake_prisma():
    fake = SimpleNamespace()
    fake.request = SimpleNamespace(find_first=AsyncMock(return_value=None))
    fake.matchcandidate = SimpleNamespace(find_many=AsyncMock(return_value=[]))
    return fake


def _make_fake_request():
    return SimpleNamespace(id="req-1", destination_address=None)


def _make_fake_candidate(cid, total_cost, delivery_days, reliability=0.75):
    return SimpleNamespace(
        id=cid,
        request_id="req-1",
        inventory_entry_id="inv-1",
        logistic_offer_id="offer-1",
        currency_code="USD",
        quoted_quantity=Decimal("100"),
        delivery_price=Decimal("10"),
        total_cost=Decimal(str(total_cost)),
        delivery_days=delivery_days,
        reliability_score=reliability,
        inventory_entry=SimpleNamespace(
            deleted_at=None,
            status="ACTIVE",
            quantity_available=Decimal("200"),
            price_per_unit=Decimal("1"),
        ),
        logistic_offer=SimpleNamespace(
            deleted_at=None,
            status="ACTIVE",
            covered_areas=[],
            estimated_days_max=None,
            reliability_score=reliability,
        ),
    )


@pytest.mark.anyio
async def test_compare_baselines_returns_expected_strategies(monkeypatch):
    app = FastAPI()
    app.include_router(comparison_router.router, prefix="/api/comparison")

    fake_prisma = _make_fake_prisma()
    fake_prisma.request.find_first = AsyncMock(return_value=_make_fake_request())
    fake_prisma.matchcandidate.find_many = AsyncMock(
        return_value=[
            _make_fake_candidate("cand-1", 100, 3, 0.9),
            _make_fake_candidate("cand-2", 200, 2, 0.8),
        ]
    )
    monkeypatch.setattr(comparison_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/comparison/baselines",
            json={"request_id": "req-1", "priority": "balanced"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["greedy"]["strategy"] == "greedy"
    assert payload["heuristic"]["strategy"] == "heuristic"


@pytest.mark.anyio
async def test_compare_baselines_rejects_unknown_request_id(monkeypatch):
    app = FastAPI()
    app.include_router(comparison_router.router, prefix="/api/comparison")

    fake_prisma = _make_fake_prisma()
    fake_prisma.request.find_first = AsyncMock(return_value=None)
    monkeypatch.setattr(comparison_router, "prisma", fake_prisma)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/comparison/baselines",
            json={"request_id": "unknown-id", "priority": "balanced"},
        )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


@pytest.mark.anyio
async def test_comparison_catalog_exposes_supported_values():
    app = FastAPI()
    app.include_router(comparison_router.router, prefix="/api/comparison")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/api/comparison/catalog")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert "balanced" in payload["priorities"]
    assert "cost" in payload["priorities"]
    assert "speed" in payload["priorities"]
    assert "reliability" in payload["priorities"]
