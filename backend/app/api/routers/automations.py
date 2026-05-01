"""
Automation router for supply chain optimization.

Uses the shared OptimizationEngine (services/optimization_engine.py) to
produce ranked, Prisma-driven results.  The previous mock-data DEAP demo
has been replaced by a real database-backed endpoint.

Author: Igor Vuta (P2773339)
Date: May 2026
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.optimization_engine import OptimizationEngine

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================


class OptimizeRequest(BaseModel):
    """Request model for optimization endpoint."""

    request_id: str = Field(..., description="DB Request UUID to optimise")
    mode: str = Field(
        "fast",
        description="Optimization mode: 'fast' (heuristic) or 'deep' (GA/NSGA-II)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "request_id": "00000000-0000-0000-0000-000000000001",
                "mode": "fast",
            }
        }


class ScoreBreakdown(BaseModel):
    cost_norm:        Optional[float] = None
    time_norm:        Optional[float] = None
    reliability_norm: Optional[float] = None
    final_score:      Optional[float] = None
    weights:          Optional[dict]  = None


class RankedSolution(BaseModel):
    """Single ranked solution from the optimizer."""

    rank:               int
    candidate_id:       str
    request_id:         str
    inventory_entry_id: str
    logistic_offer_id:  Optional[str] = None
    total_cost:         float
    delivery_days:      float
    reliability:        float
    fitness_score:      float
    currency_code:      str
    score_breakdown:    Optional[ScoreBreakdown] = None


class OptimizeResponse(BaseModel):
    """Response model for optimization endpoint."""

    status:         str
    request_id:     str
    mode:           str
    solution_count: int
    solutions:      List[RankedSolution]


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(request: OptimizeRequest):
    """
    Optimize supply chain matching for an existing customer Request.

    Uses OptimizationEngine in 'fast' (weighted-sum heuristic) or
    'deep' (DEAP eaMuPlusLambda GA) mode to score and rank all
    feasible MatchCandidates for the given request.

    Results are persisted to MatchCandidate.fitness_score / score_breakdown / rank.
    """
    engine = OptimizationEngine()
    mode = request.mode if request.mode in ("fast", "deep") else "fast"

    try:
        ranked = await engine.generate_candidates_for_request(request.request_id, mode=mode)
    except Exception as exc:
        logger.exception("OptimizationEngine error for request %s", request.request_id)
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}") from exc

    solutions = []
    for item in ranked:
        bd_raw = item.get("score_breakdown") or {}
        solutions.append(
            RankedSolution(
                rank=item.get("rank", 0),
                candidate_id=item["id"],
                request_id=item["request_id"],
                inventory_entry_id=item["inventory_entry_id"],
                logistic_offer_id=item.get("logistic_offer_id"),
                total_cost=item["total_cost"],
                delivery_days=item["delivery_days"],
                reliability=item["reliability"],
                fitness_score=item.get("fitness_score", 0.0),
                currency_code=item["currency_code"],
                score_breakdown=ScoreBreakdown(**bd_raw) if bd_raw else None,
            )
        )

    return OptimizeResponse(
        status="success",
        request_id=request.request_id,
        mode=mode,
        solution_count=len(solutions),
        solutions=solutions,
    )


@router.post("/optimize/compare", response_model=dict)
async def optimize_compare(request: OptimizeRequest):
    """
    Run greedy, heuristic, fast and deep modes against the same candidate pool
    and return all four result sets for Chapter 5 benchmarking.
    """
    engine = OptimizationEngine()
    try:
        result = await engine.compare_baselines(request.request_id)
    except Exception as exc:
        logger.exception("compare_baselines error for request %s", request.request_id)
        raise HTTPException(status_code=500, detail=f"Comparison failed: {exc}") from exc

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.post("/seed-large-scale")
async def seed_large_scale():
    """
    Trigger large-scale seed scenario (150 MatchCandidates) using existing
    reference data.  Intended for development / demo use only.
    """
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    try:
        from seed_workflow_scenarios import create_large_scale_request_scenario  # noqa: PLC0415
        from db import prisma as _prisma  # noqa: PLC0415

        country = await _prisma.country.find_unique(where={"iso2": "KZ"})
        if not country:
            raise HTTPException(status_code=422, detail="Country KZ not found. Run seed first.")

        region = await _prisma.region.find_first(where={"country_id": country.id})
        if not region:
            raise HTTPException(status_code=422, detail="No region found for KZ.")

        city = await _prisma.city.find_first(where={"region_id": region.id})
        if not city:
            raise HTTPException(status_code=422, detail="No city found for KZ region.")

        address = await _prisma.address.find_first(
            where={"country_id": country.id, "street": "Abay Ave 10"}
        )
        if not address:
            raise HTTPException(status_code=422, detail="Address not found. Run seed first.")

        category = await _prisma.category.find_first(where={"slug": "energy-coal"})
        if not category:
            raise HTTPException(status_code=422, detail="Category energy-coal not found. Run seed first.")

        item = await _prisma.item.find_first(where={"category_id": category.id})
        if not item:
            raise HTTPException(status_code=422, detail="No items found. Run seed first.")

        request_id = await create_large_scale_request_scenario(
            prisma=_prisma,
            address_id=address.id,
            country_id=country.id,
            region_id=region.id,
            city_id=city.id,
            category_id=category.id,
            item_id=item.id,
            request_name="Large_Test_Request",
            num_factories=15,
            num_logistics=12,
            target_candidates=150,
            optimization_profile="balanced",
        )

        # Count candidates for the created request
        candidate_count = await _prisma.matchcandidate.count(
            where={"request_id": request_id, "deleted_at": None}
        )
        return {
            "status": "success",
            "message": f"Large-scale scenario seeded for request {request_id}",
            "candidates_created": candidate_count,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("seed_large_scale failed")
        raise HTTPException(status_code=500, detail=f"Seeding failed: {exc}") from exc
