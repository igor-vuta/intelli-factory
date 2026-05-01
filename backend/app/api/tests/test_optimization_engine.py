"""
Unit and integration tests for services/optimization_engine.py

Unit tests mock the Prisma ORM objects and exercise the pure-Python scoring
logic without requiring a live database.

Integration tests (marked @pytest.mark.integration) use the live DB seeded
with fixed deterministic scenarios and verify end-to-end behaviour.
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.append(str(API_ROOT))

from services.optimization_engine import (  # noqa: E402
    WEIGHT_PROFILES,
    OptimizationEngine,
    _normalise,
)

@pytest.fixture
def anyio_backend():
    return "asyncio"

# ── helpers ──────────────────────────────────────────────────────────────────

def _make_address(country_id="c1", region_id="r1", city_id="ci1"):
    return SimpleNamespace(country_id=country_id, region_id=region_id, city_id=city_id)


def _make_coverage(country_id="c1", region_id=None, city_id=None, status="ACTIVE", deleted_at=None):
    return SimpleNamespace(
        country_id=country_id,
        region_id=region_id,
        city_id=city_id,
        status=status,
        deleted_at=deleted_at,
    )


def _make_inventory(qty_available=1000, price_per_unit=200, status="ACTIVE", deleted_at=None):
    currency = SimpleNamespace(code="EUR")
    return SimpleNamespace(
        quantity_available=Decimal(str(qty_available)),
        price_per_unit=Decimal(str(price_per_unit)),
        status=status,
        deleted_at=deleted_at,
        currency=currency,
        stock_address=_make_address(),
        factory_profile=SimpleNamespace(legal_name="Test Factory"),
    )


def _make_offer(reliability=0.9, days_min=2, days_max=5, status="ACTIVE", deleted_at=None, areas=None):
    return SimpleNamespace(
        reliability_score=reliability,
        estimated_days_min=days_min,
        estimated_days_max=days_max,
        status=status,
        deleted_at=deleted_at,
        covered_areas=areas if areas is not None else [_make_coverage()],
        currency=SimpleNamespace(code="EUR"),
    )


def _make_candidate(
    cid="cand-1",
    request_id="req-1",
    inv_entry_id="inv-1",
    logistic_offer_id="log-1",
    quoted_qty=500,
    delivery_price=30000,
    total_cost=130000,
    delivery_days=3,
    reliability=0.9,
    currency="EUR",
    inventory=None,
    offer=None,
    deleted_at=None,
    status="PENDING",
):
    return SimpleNamespace(
        id=cid,
        request_id=request_id,
        inventory_entry_id=inv_entry_id,
        logistic_offer_id=logistic_offer_id,
        quoted_quantity=Decimal(str(quoted_qty)),
        delivery_price=Decimal(str(delivery_price)),
        total_cost=Decimal(str(total_cost)),
        delivery_days=delivery_days,
        reliability_score=reliability,
        currency_code=currency,
        factory_note=None,
        deleted_at=deleted_at,
        status=status,
        inventory_entry=inventory or _make_inventory(),
        logistic_offer=offer or _make_offer(),
    )


def _make_request(opt_profile="balanced", dest_address=None):
    return SimpleNamespace(
        id="req-1",
        optimization_profile=opt_profile,
        destination_address=dest_address or _make_address(),
    )


# ── Unit: _normalise ─────────────────────────────────────────────────────────

def test_normalise_normal_range():
    assert _normalise(5.0, 0.0, 10.0) == pytest.approx(0.5)


def test_normalise_min_equals_max():
    assert _normalise(7.0, 7.0, 7.0) == 0.0


def test_normalise_at_boundaries():
    assert _normalise(0.0, 0.0, 10.0) == pytest.approx(0.0)
    assert _normalise(10.0, 0.0, 10.0) == pytest.approx(1.0)


# ── Unit: WEIGHT_PROFILES ────────────────────────────────────────────────────

def test_weight_profiles_sum_to_one():
    for name, weights in WEIGHT_PROFILES.items():
        total = sum(weights)
        assert abs(total - 1.0) < 1e-9, f"Profile '{name}' weights do not sum to 1.0 (got {total})"


# ── Unit: _resolve_weights ───────────────────────────────────────────────────

def test_resolve_weights_balanced():
    engine = OptimizationEngine()
    assert engine._resolve_weights("balanced") == WEIGHT_PROFILES["balanced"]


def test_resolve_weights_unknown_falls_back_to_balanced():
    engine = OptimizationEngine()
    assert engine._resolve_weights("foobar") == WEIGHT_PROFILES["balanced"]


def test_resolve_weights_none_falls_back_to_balanced():
    engine = OptimizationEngine()
    assert engine._resolve_weights(None) == WEIGHT_PROFILES["balanced"]


# ── Unit: _is_feasible ───────────────────────────────────────────────────────

def test_is_feasible_pass():
    engine = OptimizationEngine()
    cand = _make_candidate(quoted_qty=500)
    req  = _make_request()
    assert engine._is_feasible(cand, req) is True


def test_is_feasible_quantity_exceeds_available():
    engine = OptimizationEngine()
    inv  = _make_inventory(qty_available=100)
    cand = _make_candidate(quoted_qty=500, inventory=inv)
    req  = _make_request()
    assert engine._is_feasible(cand, req) is False


def test_is_feasible_deleted_inventory():
    engine = OptimizationEngine()
    from datetime import datetime
    inv  = _make_inventory(deleted_at=datetime.utcnow())
    cand = _make_candidate(inventory=inv)
    req  = _make_request()
    assert engine._is_feasible(cand, req) is False


def test_is_feasible_deleted_offer():
    engine = OptimizationEngine()
    from datetime import datetime
    offer = _make_offer(deleted_at=datetime.utcnow())
    cand  = _make_candidate(offer=offer)
    req   = _make_request()
    assert engine._is_feasible(cand, req) is False


def test_is_feasible_coverage_country_mismatch():
    engine = OptimizationEngine()
    area   = _make_coverage(country_id="DE")
    offer  = _make_offer(areas=[area])
    cand   = _make_candidate(offer=offer)
    req    = _make_request(dest_address=_make_address(country_id="KZ"))
    assert engine._is_feasible(cand, req) is False


def test_is_feasible_no_coverage_areas_allows_all():
    engine = OptimizationEngine()
    offer  = _make_offer(areas=[])
    cand   = _make_candidate(offer=offer)
    req    = _make_request()
    assert engine._is_feasible(cand, req) is True


# ── Unit: _score_pool ────────────────────────────────────────────────────────

def _pool_from_candidates(*candidates):
    engine = OptimizationEngine()
    req    = _make_request()
    return [engine._candidate_to_dict(c, req) for c in candidates]


def test_score_pool_single_candidate():
    c1    = _make_candidate(cid="c1", total_cost=100000, delivery_days=3, reliability=0.9)
    pool  = _pool_from_candidates(c1)
    engine = OptimizationEngine()
    result = engine._score_pool(pool, WEIGHT_PROFILES["balanced"])
    assert len(result) == 1
    assert result[0]["rank"] == 1
    assert 0.0 <= result[0]["fitness_score"] <= 1.0


def test_score_pool_orders_by_fitness_desc():
    # c_cheap: low cost, low reliability → should rank well for "cost" profile
    c_cheap = _make_candidate(cid="cheap", total_cost=50000,  delivery_days=5, reliability=0.7)
    c_rel   = _make_candidate(cid="rel",   total_cost=120000, delivery_days=3, reliability=0.98)
    pool    = _pool_from_candidates(c_cheap, c_rel)
    engine  = OptimizationEngine()

    cost_result = engine._score_pool(pool, WEIGHT_PROFILES["cost"])
    assert cost_result[0]["id"] == "cheap", "Cheapest should win on cost profile"

    rel_result = engine._score_pool(pool, WEIGHT_PROFILES["reliability"])
    assert rel_result[0]["id"] == "rel", "Most reliable should win on reliability profile"


def test_score_pool_rank_is_sequential():
    candidates = [
        _make_candidate(cid=f"c{i}", total_cost=100000 + i * 1000, delivery_days=3, reliability=0.9)
        for i in range(5)
    ]
    pool   = _pool_from_candidates(*candidates)
    engine = OptimizationEngine()
    result = engine._score_pool(pool, WEIGHT_PROFILES["balanced"])
    ranks  = [r["rank"] for r in result]
    assert ranks == list(range(1, 6))


def test_score_breakdown_keys_present():
    c    = _make_candidate()
    pool = _pool_from_candidates(c)
    engine = OptimizationEngine()
    result = engine._score_pool(pool, WEIGHT_PROFILES["balanced"])
    bd = result[0]["score_breakdown"]
    assert "cost_norm" in bd
    assert "time_norm" in bd
    assert "reliability_norm" in bd
    assert "final_score" in bd
    assert "weights" in bd


# ── Unit: run_deep_optimization ──────────────────────────────────────────────

def test_deep_optimization_empty_pool():
    engine = OptimizationEngine()
    result = engine.run_deep_optimization([], WEIGHT_PROFILES["balanced"])
    assert result == []


def test_deep_optimization_single_candidate():
    c    = _make_candidate()
    pool = _pool_from_candidates(c)
    engine = OptimizationEngine()
    result = engine.run_deep_optimization(pool, WEIGHT_PROFILES["balanced"])
    assert len(result) == 1
    assert result[0]["rank"] == 1


def test_deep_optimization_returns_at_most_top_n():
    from services.optimization_engine import _GA_TOP_N
    candidates = [
        _make_candidate(
            cid=f"c{i}",
            total_cost=80000 + i * 500,
            delivery_days=2 + (i % 5),
            reliability=0.85 + (i % 10) * 0.01,
        )
        for i in range(30)
    ]
    pool   = _pool_from_candidates(*candidates)
    engine = OptimizationEngine()
    result = engine.run_deep_optimization(pool, WEIGHT_PROFILES["balanced"])
    assert len(result) <= _GA_TOP_N


def test_deep_optimization_reproducible_with_seed():
    """Same input + fixed seed must produce identical ranked output."""
    candidates = [
        _make_candidate(
            cid=f"c{i}",
            total_cost=90000 + i * 1000,
            delivery_days=1 + i,
            reliability=0.80 + i * 0.02,
        )
        for i in range(10)
    ]
    engine = OptimizationEngine()
    weights = WEIGHT_PROFILES["balanced"]
    pool    = _pool_from_candidates(*candidates)

    run1 = [r["id"] for r in engine.run_deep_optimization(pool, weights)]
    run2 = [r["id"] for r in engine.run_deep_optimization(pool, weights)]
    assert run1 == run2, "Deep optimization must be deterministic with fixed seed"


# ── Unit: compare_baselines (mocked DB) ─────────────────────────────────────

@pytest.mark.anyio
async def test_compare_baselines_missing_request():
    engine = OptimizationEngine()
    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=None)
        result = await engine.compare_baselines("nonexistent-id")
    assert "error" in result


@pytest.mark.anyio
async def test_compare_baselines_no_candidates():
    engine = OptimizationEngine()
    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=_make_request())
        mock_prisma.matchcandidate.find_many = AsyncMock(return_value=[])
        result = await engine.compare_baselines("req-1")
    assert "error" in result


@pytest.mark.anyio
async def test_compare_baselines_returns_all_strategies():
    engine = OptimizationEngine()

    c1 = _make_candidate(cid="c1", total_cost=100000, delivery_days=3, reliability=0.9)
    c2 = _make_candidate(cid="c2", total_cost=80000,  delivery_days=5, reliability=0.8)
    c3 = _make_candidate(cid="c3", total_cost=120000, delivery_days=2, reliability=0.95)

    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=_make_request())
        mock_prisma.matchcandidate.find_many = AsyncMock(return_value=[c1, c2, c3])
        result = await engine.compare_baselines("req-1")

    assert result.get("error") is None
    assert "greedy" in result
    assert "heuristic" in result
    assert "fast" in result
    assert "deep" in result
    assert isinstance(result["greedy"], list)
    assert len(result["greedy"]) > 0
    # Greedy baseline must pick cheapest candidate
    assert result["greedy"][0]["id"] == "c2"


# ── Unit: generate_candidates_for_request (mocked DB) ───────────────────────

@pytest.mark.anyio
async def test_generate_candidates_unknown_request():
    engine = OptimizationEngine()
    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=None)
        result = await engine.generate_candidates_for_request("bad-id", mode="fast")
    assert result == []


@pytest.mark.anyio
async def test_generate_candidates_fast_mode_persists_and_returns():
    engine = OptimizationEngine()

    c1 = _make_candidate(cid="c1", total_cost=100000, delivery_days=3, reliability=0.9)
    c2 = _make_candidate(cid="c2", total_cost=80000,  delivery_days=5, reliability=0.8)

    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=_make_request())
        mock_prisma.matchcandidate.find_many = AsyncMock(return_value=[c1, c2])
        mock_prisma.matchcandidate.update = AsyncMock()

        result = await engine.generate_candidates_for_request("req-1", mode="fast")

    assert len(result) == 2
    # First result should be ranked 1
    assert result[0]["rank"] == 1
    # Persist was called for each candidate
    assert mock_prisma.matchcandidate.update.call_count == 2


@pytest.mark.anyio
async def test_generate_candidates_deep_mode():
    engine = OptimizationEngine()

    candidates = [
        _make_candidate(
            cid=f"c{i}",
            total_cost=80000 + i * 2000,
            delivery_days=2 + i,
            reliability=0.85 + i * 0.02,
        )
        for i in range(8)
    ]

    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=_make_request())
        mock_prisma.matchcandidate.find_many = AsyncMock(return_value=candidates)
        mock_prisma.matchcandidate.update = AsyncMock()

        result = await engine.generate_candidates_for_request("req-1", mode="deep")

    assert len(result) > 0
    assert result[0]["rank"] == 1
    for item in result:
        assert "score_breakdown" in item
        assert "fitness_score" in item


# ── Large-scale unit tests (150 mock candidates) ─────────────────────────────

import random as _random_mod  # noqa: E402

_RNG = _random_mod.Random(99999)

# Build 150 synthetic candidates: 15 factories × 10 logists
# - 5 budget factories:  cheap but slow/unreliable
# - 5 mid factories:     balanced
# - 5 premium factories: expensive but fast/reliable
_FACTORY_PARAMS = (
    # (price_per_unit, qty_available)
    [(140 + i * 5,  6000) for i in range(5)]   # budget
    + [(178 + i * 4, 10000) for i in range(5)] # mid
    + [(208 + i * 6, 12000) for i in range(5)] # premium
)
_LOGIST_PARAMS = (
    # (days_min, days_max, reliability, delivery_price)
    [(1, 2,  0.97, 52000) for _ in range(2)]   # express
    + [(4, 7, 0.88, 28000) for _ in range(4)]  # standard
    + [(9, 14, 0.71, 14000) for _ in range(4)] # economy
)


def _build_large_pool(n_factories: int = 15, n_logistics: int = 10) -> list:
    """Build a mock candidate pool simulating N factories × M logistics."""
    engine = OptimizationEngine()
    req    = _make_request()
    pool   = []
    cid    = 0
    for fi, (unit_price, qty_avail) in enumerate(_FACTORY_PARAMS[:n_factories]):
        for li, (d_min, d_max, rel, d_price) in enumerate(_LOGIST_PARAMS[:n_logistics]):
            cid += 1
            jitter_price  = _RNG.randint(-3, 3)
            jitter_days   = _RNG.randint(d_min, d_max)
            jitter_dp     = _RNG.randint(-2000, 2000)
            total_cost    = 300 * (unit_price + jitter_price) + max(5000, d_price + jitter_dp)
            c = _make_candidate(
                cid=f"ls-{cid:04d}",
                total_cost=total_cost,
                delivery_days=jitter_days,
                reliability=max(0.60, min(0.99, rel + _RNG.uniform(-0.02, 0.02))),
            )
            pool.append(engine._candidate_to_dict(c, req))
    return pool


def test_large_scale_pool_size():
    pool = _build_large_pool()
    assert len(pool) == 150


def test_large_scale_fast_returns_all_ranked():
    pool   = _build_large_pool()
    engine = OptimizationEngine()
    result = engine._score_pool(pool, WEIGHT_PROFILES["balanced"])
    assert len(result) == 150
    assert result[0]["rank"] == 1
    assert result[-1]["rank"] == 150


def test_large_scale_deep_returns_at_most_top_n():
    from services.optimization_engine import _GA_TOP_N
    pool   = _build_large_pool()
    engine = OptimizationEngine()
    result = engine.run_deep_optimization(pool, WEIGHT_PROFILES["balanced"])
    assert 1 <= len(result) <= _GA_TOP_N
    assert result[0]["rank"] == 1


def test_large_scale_cost_profile_picks_cheapest():
    """Under pure cost profile the top candidate should have one of the lowest total costs."""
    pool      = _build_large_pool()
    engine    = OptimizationEngine()
    result    = engine._score_pool(pool, WEIGHT_PROFILES["cost"])
    top_cost  = result[0]["total_cost"]
    all_costs = sorted(c["total_cost"] for c in pool)
    # Top result cost should be in the bottom 10% of the distribution
    p10       = all_costs[len(all_costs) // 10]
    assert top_cost <= p10, "Cost profile top result is not in the cheapest 10%"


def test_large_scale_reliability_profile_picks_most_reliable():
    """Under reliability profile the top candidate should be highly reliable."""
    pool     = _build_large_pool()
    engine   = OptimizationEngine()
    result   = engine._score_pool(pool, WEIGHT_PROFILES["reliability"])
    top_rel  = result[0]["reliability"]
    all_rels = sorted((c["reliability"] for c in pool), reverse=True)
    p10      = all_rels[len(all_rels) // 10]
    assert top_rel >= p10, "Reliability profile top result is not in the most-reliable 10%"


def test_large_scale_speed_profile_picks_fastest():
    """Under speed profile the top candidate should have a low delivery_days."""
    pool       = _build_large_pool()
    engine     = OptimizationEngine()
    result     = engine._score_pool(pool, WEIGHT_PROFILES["speed"])
    top_days   = result[0]["delivery_days"]
    all_days   = sorted(c["delivery_days"] for c in pool)
    p25        = all_days[len(all_days) // 4]
    assert top_days <= p25, "Speed profile top result is not in the fastest 25%"


def test_large_scale_profiles_select_different_winners():
    """Different weight profiles should select at least sometimes different top candidates."""
    pool    = _build_large_pool()
    engine  = OptimizationEngine()
    winners = {
        name: engine._score_pool(pool, w)[0]["id"]
        for name, w in WEIGHT_PROFILES.items()
    }
    # Not all profiles should pick the same candidate
    assert len(set(winners.values())) > 1, (
        "All weight profiles picked the same top candidate — scoring likely broken"
    )


def test_large_scale_deep_reproducible():
    """Deep mode with fixed seed is deterministic regardless of pool size."""
    pool   = _build_large_pool()
    engine = OptimizationEngine()
    run1   = [r["id"] for r in engine.run_deep_optimization(pool, WEIGHT_PROFILES["balanced"])]
    run2   = [r["id"] for r in engine.run_deep_optimization(pool, WEIGHT_PROFILES["balanced"])]
    assert run1 == run2


@pytest.mark.anyio
async def test_large_scale_generate_candidates_mocked():
    """generate_candidates_for_request handles 150 mock DB candidates correctly."""
    import random as _r

    _r.seed(77)
    raw_candidates = [
        _make_candidate(
            cid=f"ls-{i:04d}",
            total_cost=40000 + _r.randint(0, 80000),
            delivery_days=_r.randint(1, 14),
            reliability=round(_r.uniform(0.65, 0.98), 3),
        )
        for i in range(150)
    ]

    engine = OptimizationEngine()

    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=_make_request())
        mock_prisma.matchcandidate.find_many = AsyncMock(return_value=raw_candidates)
        mock_prisma.matchcandidate.update = AsyncMock()

        result = await engine.generate_candidates_for_request("req-large", mode="fast")

    assert len(result) == 150
    assert result[0]["rank"] == 1
    assert result[-1]["rank"] == 150
    # All 150 candidates should have been persisted
    assert mock_prisma.matchcandidate.update.call_count == 150
    # Every result should have score_breakdown
    for r in result:
        assert "score_breakdown" in r
        assert 0.0 <= r["fitness_score"] <= 1.0


@pytest.mark.anyio
async def test_large_scale_deep_mode_mocked():
    """Deep mode on 150 candidates returns at most _GA_TOP_N results."""
    from services.optimization_engine import _GA_TOP_N
    import random as _r

    _r.seed(88)
    raw_candidates = [
        _make_candidate(
            cid=f"deep-{i:04d}",
            total_cost=40000 + _r.randint(0, 80000),
            delivery_days=_r.randint(1, 14),
            reliability=round(_r.uniform(0.65, 0.98), 3),
        )
        for i in range(150)
    ]

    engine = OptimizationEngine()

    with patch("services.optimization_engine.prisma") as mock_prisma:
        mock_prisma.request.find_first = AsyncMock(return_value=_make_request())
        mock_prisma.matchcandidate.find_many = AsyncMock(return_value=raw_candidates)
        mock_prisma.matchcandidate.update = AsyncMock()

        result = await engine.generate_candidates_for_request("req-deep", mode="deep")

    assert 1 <= len(result) <= _GA_TOP_N
    assert result[0]["rank"] == 1

