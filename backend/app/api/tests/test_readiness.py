from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from main import readiness_check


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_readiness_queries_database(monkeypatch):
    query = AsyncMock(return_value=[{"?column?": 1}])
    monkeypatch.setattr("main.prisma", SimpleNamespace(query_raw=query))
    assert await readiness_check() == {"status": "ready"}
    query.assert_awaited_once_with("SELECT 1")


@pytest.mark.anyio
async def test_readiness_returns_503_when_database_is_unavailable(monkeypatch):
    monkeypatch.setattr("main.prisma", SimpleNamespace(query_raw=AsyncMock(side_effect=RuntimeError("offline"))))
    response = await readiness_check()
    assert response.status_code == 503
    assert response.body == b'{"status":"not_ready"}'
