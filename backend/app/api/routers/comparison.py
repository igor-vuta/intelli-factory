# Baseline comparison router, greedy vs weighted-heuristic(fast) on real MatchCandidate data.

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import prisma
from services.optimization_engine import WEIGHT_PROFILES, OptimizationEngine

logger = logging.getLogger(__name__)

router = APIRouter()

Priority = Literal["balanced", "cost", "speed", "reliability"]

class BaselineCompareRequest(BaseModel):
    request_id: str = Field(..., description="DB Request UUID")
    priority: Priority = Field("balanced", description="Weight profile")


class BaselineResult(BaseModel):
    strategy:          str
    candidate_id:      str
    total_cost:        float
    delivery_days:     float
    reliability_score: float
    heuristic_score:   float


class BaselineCompareResponse(BaseModel):
    status:     str
    request_id: str
    priority:   Priority
    greedy:     BaselineResult
    heuristic:  BaselineResult


class ComparisonCatalogResponse(BaseModel):
    status:     str
    priorities: list[Priority]

@router.post("/baselines", response_model=BaselineCompareResponse)
async def compare_baselines(payload: BaselineCompareRequest):
    # greedy (min cost) vs weighted-heuristic for a given request
    req = await prisma.request.find_first(
        where={"id": payload.request_id, "deleted_at": None},
        include={
            "destination_address": {
                "include": {"country": True, "region": True, "city": True}
            },
        },
    )
    if not req:
        raise HTTPException(status_code=404, detail=f"Request '{payload.request_id}' not found")

    candidates_raw = await prisma.matchcandidate.find_many(
        where={
            "request_id": payload.request_id,
            "logistic_offer_id": {"not": None},
            "status": {"in": ["PENDING", "ACCEPTED"]},
            "deleted_at": None,
        },
        include={
            "inventory_entry": {
                "include": {
                    "stock_address": {
                        "include": {"country": True, "region": True, "city": True}
                    },
                    "currency": True,
                }
            },
            "logistic_offer": {
                "include": {
                    "covered_areas": {
                        "include": {"country": True, "region": True, "city": True}
                    },
                    "currency": True,
                }
            },
            "currency": True,
        },
    )

    if not candidates_raw:
        raise HTTPException(
            status_code=404,
            detail=f"No complete candidates found for request '{payload.request_id}'",
        )

    engine = OptimizationEngine()
    feasible = [c for c in candidates_raw if engine._is_feasible(c, req)]  # noqa: SLF001

    if not feasible:
        raise HTTPException(
            status_code=404,
            detail="No feasible candidates after applying hard constraints",
        )

    pool = [engine._candidate_to_dict(c, req) for c in feasible]  # noqa: SLF001

    # greedy, lowest cost
    greedy_raw = min(pool, key=lambda c: c["total_cost"])

    # heuristic, weighted-sum
    weights = WEIGHT_PROFILES.get(payload.priority, WEIGHT_PROFILES["balanced"])
    heuristic_pool = engine._score_pool(pool, weights)  # noqa: SLF001
    heuristic_raw = heuristic_pool[0] if heuristic_pool else greedy_raw

    def _to_result(strategy: str, item: dict) -> BaselineResult:
        bd = item.get("score_breakdown") or {}
        return BaselineResult(
            strategy=strategy,
            candidate_id=item["id"],
            total_cost=item["total_cost"],
            delivery_days=item["delivery_days"],
            reliability_score=item["reliability"],
            heuristic_score=round(bd.get("final_score", 0.0), 6),
        )

    return BaselineCompareResponse(
        status="success",
        request_id=payload.request_id,
        priority=payload.priority,
        greedy=_to_result("greedy", greedy_raw),
        heuristic=_to_result("heuristic", heuristic_raw),
    )


@router.get("/catalog", response_model=ComparisonCatalogResponse)
async def comparison_catalog():
    return ComparisonCatalogResponse(
        status="success",
        priorities=["balanced", "cost", "speed", "reliability"],
    )
