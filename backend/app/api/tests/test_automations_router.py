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

automations_router = importlib.import_module("routers.automations")
requests_router = importlib.import_module("routers.requests")

ADMIN = SimpleNamespace(id="admin-1", role="ADMIN")
ENDPOINTS = [
    ("/api/automations/optimize", {"request_id": "req-1"}),
    ("/api/automations/optimize/compare", {"request_id": "req-1"}),
    ("/api/automations/seed-large-scale", None),
]


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_app(user):
    app = FastAPI()
    app.include_router(automations_router.router, prefix="/api/automations")
    app.dependency_overrides[automations_router._ensure_db_connection] = lambda: None
    if user is not None:
        app.dependency_overrides[requests_router._require_authenticated_user] = lambda: user
    return app


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("user", "expected_status"),
    [
        (None, 401),
        (SimpleNamespace(id="customer-1", role="CUSTOMER"), 403),
        (SimpleNamespace(id="factory-1", role="FACTORY"), 403),
        (SimpleNamespace(id="logist-1", role="LOGIST"), 403),
    ],
)
async def test_automations_require_admin(user, expected_status):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=_make_app(user)),
        base_url="http://testserver",
    ) as client:
        for path, body in ENDPOINTS:
            response = await client.post(path, json=body)
            assert response.status_code == expected_status, path


@pytest.mark.anyio
async def test_optimize_compare_omits_orm_records(monkeypatch):
    candidate = {"id": "cand-1", "total_cost": 100.0, "_orm": object()}
    result = {
        "request_id": "req-1",
        "pool": [{"id": "cand-1", "total_cost": 100.0}],
        "greedy": [dict(candidate)],
        "fast": [dict(candidate)],
        "deep": [dict(candidate)],
    }
    monkeypatch.setattr(
        automations_router.OptimizationEngine,
        "compare_baselines",
        AsyncMock(return_value=result),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=_make_app(ADMIN)),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/automations/optimize/compare", json={"request_id": "req-1"}
        )

    assert response.status_code == 200
    payload = response.json()
    for strategy in ("greedy", "fast", "deep"):
        assert payload[strategy] == [{"id": "cand-1", "total_cost": 100.0}]
