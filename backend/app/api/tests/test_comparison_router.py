import importlib
import sys
from pathlib import Path

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


@pytest.mark.anyio
async def test_compare_baselines_returns_expected_strategies():
    app = FastAPI()
    app.include_router(comparison_router.router, prefix="/api/comparison")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/comparison/baselines",
            json={"sku": "textile-001", "quantity": 100, "priority": "balanced"},
        )

    assert response.status_code == 200
    payload = response.json()

    assert payload["status"] == "success"
    assert payload["greedy"]["strategy"] == "greedy"
    assert payload["heuristic"]["strategy"] == "heuristic"
    assert payload["greedy"]["logistics_provider"] == "local-courier"
    assert payload["heuristic"]["logistics_provider"] == "regional-logistics"


@pytest.mark.anyio
async def test_compare_baselines_rejects_unknown_sku():
    app = FastAPI()
    app.include_router(comparison_router.router, prefix="/api/comparison")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/comparison/baselines",
            json={"sku": "unknown-sku", "quantity": 100, "priority": "balanced"},
        )

    assert response.status_code == 400
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
    assert "textile-001" in payload["skus"]
    assert payload["priorities"] == ["balanced", "cost", "speed"]
    assert "almaty" in payload["destinations"]
