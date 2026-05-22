# Automation router, wraps OptimizationEngine for supply chain matching.

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.optimization_engine import OptimizationEngine

logger = logging.getLogger(__name__)

router = APIRouter()

class OptimizeRequest(BaseModel):
    request_id: str = Field(..., description="DB Request UUID")
    mode: str = Field("fast", description="'fast' (heuristic) or 'deep' (GA)")
    profile: Optional[str] = Field(None, description="Profile override: balanced/cost/speed/reliability")

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
    status:         str
    request_id:     str
    mode:           str
    solution_count: int
    solutions:      List[RankedSolution]

@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(request: OptimizeRequest):
    # score and rank feasible MatchCandidates, persist results to DB
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
    # runs greedy, fast, and deep against the same pool, returns all results for benchmarking
    engine = OptimizationEngine()
    try:
        result = await engine.compare_baselines(request.request_id, profile=request.profile)
    except Exception as exc:
        logger.exception("compare_baselines error for request %s", request.request_id)
        raise HTTPException(status_code=500, detail=f"Comparison failed: {exc}") from exc

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.post("/seed-large-scale")
async def seed_large_scale():
    # dev only
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    try:
        from seed_workflow_scenarios import create_random_large_scale_request  # noqa: PLC0415
        from db import prisma as _prisma  # noqa: PLC0415

        request_id = await create_random_large_scale_request(
            num_candidates=150,
            random_seed=None,
        )

        # Count candidates for the created request
        candidate_count = await _prisma.matchcandidate.count(
            where={"request_id": request_id, "deleted_at": None}
        )
        return {
            "status": "success",
            "message": f"Random large-scale scenario seeded for request {request_id}",
            "candidates_created": candidate_count,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("seed_large_scale failed")
        raise HTTPException(status_code=500, detail=f"Seeding failed: {exc}") from exc
