"""Baseline comparison router for manual-selection strategies.

Provides deterministic greedy and heuristic strategies that can be compared
against the evolutionary optimizer.
"""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .automations import LOGISTICS_PROVIDERS, MANUFACTURERS, PRODUCTS

router = APIRouter()

Priority = Literal["balanced", "cost", "speed"]


class BaselineCompareRequest(BaseModel):
    sku: str = Field(..., description="Product SKU to evaluate")
    quantity: int = Field(..., gt=0, description="Requested quantity")
    priority: Priority = Field("balanced", description="Weight profile for heuristic")


class BaselineResult(BaseModel):
    strategy: str
    manufacturer: str
    logistics_provider: str
    total_cost: float
    delivery_days: float
    reliability_score: float
    heuristic_score: float


class BaselineCompareResponse(BaseModel):
    status: str
    sku: str
    quantity: int
    greedy: BaselineResult
    heuristic: BaselineResult


def _evaluate_option(sku: str, quantity: int, logistics_provider: str) -> dict[str, float | str]:
    product = PRODUCTS[sku]
    manufacturer = product["manufacturer"]
    mfg = MANUFACTURERS[manufacturer]
    logistics = LOGISTICS_PROVIDERS[logistics_provider]

    goods_cost = float(product["price"] * quantity)
    logistics_cost = float(logistics["cost_per_kg"] * product["weight"] * quantity)
    total_cost = goods_cost + logistics_cost

    delivery_days = float(mfg["lead_time"] + (6.0 / logistics["speed"]))
    reliability = float((mfg["quality"] + logistics["reliability"]) / 2)

    return {
        "manufacturer": manufacturer,
        "logistics_provider": logistics_provider,
        "total_cost": total_cost,
        "delivery_days": delivery_days,
        "reliability_score": reliability,
    }


def greedy_optimize(sku: str, quantity: int) -> dict[str, float | str]:
    rows = [_evaluate_option(sku, quantity, provider) for provider in LOGISTICS_PROVIDERS]
    return min(rows, key=lambda row: float(row["total_cost"]))


def _weights_for(priority: Priority) -> tuple[float, float, float]:
    if priority == "cost":
        return (0.7, 0.2, 0.1)
    if priority == "speed":
        return (0.2, 0.7, 0.1)
    return (0.5, 0.3, 0.2)


def heuristic_optimize(sku: str, quantity: int, priority: Priority = "balanced") -> dict[str, float | str]:
    rows = [_evaluate_option(sku, quantity, provider) for provider in LOGISTICS_PROVIDERS]

    min_cost = min(float(row["total_cost"]) for row in rows)
    max_cost = max(float(row["total_cost"]) for row in rows)
    min_days = min(float(row["delivery_days"]) for row in rows)
    max_days = max(float(row["delivery_days"]) for row in rows)
    min_rel = min(float(row["reliability_score"]) for row in rows)
    max_rel = max(float(row["reliability_score"]) for row in rows)

    cost_w, speed_w, rel_w = _weights_for(priority)

    def normalize(value: float, lo: float, hi: float) -> float:
        if hi == lo:
            return 0.0
        return (value - lo) / (hi - lo)

    best_row: dict[str, float | str] | None = None
    best_score = float("inf")

    for row in rows:
        cost_n = normalize(float(row["total_cost"]), min_cost, max_cost)
        days_n = normalize(float(row["delivery_days"]), min_days, max_days)
        reliability_n = normalize(float(row["reliability_score"]), min_rel, max_rel)
        reliability_risk = 1.0 - reliability_n

        score = (cost_w * cost_n) + (speed_w * days_n) + (rel_w * reliability_risk)

        if score < best_score:
            best_score = score
            best_row = row

    assert best_row is not None
    result = dict(best_row)
    result["heuristic_score"] = best_score
    return result


@router.post("/baselines", response_model=BaselineCompareResponse)
async def compare_baselines(payload: BaselineCompareRequest):
    if payload.sku not in PRODUCTS:
        raise HTTPException(status_code=400, detail=f"SKU '{payload.sku}' not found")

    greedy = greedy_optimize(payload.sku, payload.quantity)
    greedy["heuristic_score"] = 0.0

    heuristic = heuristic_optimize(payload.sku, payload.quantity, payload.priority)

    return BaselineCompareResponse(
        status="success",
        sku=payload.sku,
        quantity=payload.quantity,
        greedy=BaselineResult(strategy="greedy", **greedy),
        heuristic=BaselineResult(strategy="heuristic", **heuristic),
    )
