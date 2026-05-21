"""
Multi-Objective Optimization Engine for Intelli-Factory.

Implements the Supply Chain Trilemma:
  - Minimise Cost
  - Minimise Time (delivery days)
  - Maximise Reliability

Two modes:
  fast  – deterministic weighted-sum heuristic (< 500 ms, for live UI)
  deep  – DEAP NSGA-II style eaMuPlusLambda GA (background / benchmarks)

Author: Igor Vuta (P2773339)
"""

from __future__ import annotations

import logging
import random
from decimal import Decimal
from typing import Any

from deap import algorithms, base, creator, tools

from db import prisma

logger = logging.getLogger(__name__)

# ── Weight profiles ──────────────────────────────────────────────────────────

WEIGHT_PROFILES: dict[str, tuple[float, float, float]] = {
    "balanced":    (0.40, 0.30, 0.30),  # cost, time, reliability
    "cost":        (0.70, 0.20, 0.10),
    "speed":       (0.20, 0.70, 0.10),
    "reliability": (0.20, 0.20, 0.60),
}

# DEAP GA hyperparameters (matching report: pop=100, gen=80)
_GA_POP_SIZE   = 100
_GA_NGEN       = 80
_GA_CXPB       = 0.7
_GA_MUTPB      = 0.2
_GA_RANDOM_SEED = 42
_GA_TOP_N      = 20  # return up to this many ranked solutions


# ── Helper: min-max normalisation ────────────────────────────────────────────

def _normalise(value: float, lo: float, hi: float) -> float:
    if hi == lo:
        return 0.0
    return (value - lo) / (hi - lo)


# ── OptimizationEngine ───────────────────────────────────────────────────────

class OptimizationEngine:
    """
    Unified Prisma-driven, DEAP-based multi-objective optimization service.
    """

    # ── Public API ────────────────────────────────────────────────────────

    async def generate_candidates_for_request(
        self,
        request_id: str,
        mode: str = "fast",
    ) -> list[dict]:
        """
        Main entry point.  Loads feasible MatchCandidates for *request_id*,
        scores them, persists score_breakdown / fitness_score / rank back to
        the DB, and returns the ranked list as dicts.

        mode: "fast" | "deep"
        """
        req = await prisma.request.find_first(
            where={"id": request_id, "deleted_at": None},
            include={
                "destination_address": {
                    "include": {"country": True, "region": True, "city": True}
                },
                "preferred_currency": True,
            },
        )
        if not req:
            logger.warning("OptimizationEngine: request %s not found", request_id)
            return []

        weights = self._resolve_weights(req.optimization_profile)

        # Load complete candidates (factory + logist) that are PENDING
        candidates = await prisma.matchcandidate.find_many(
            where={
                "request_id": request_id,
                "logistic_offer_id": {"not": None},
                "status": "PENDING",
                "deleted_at": None,
            },
            include={
                "inventory_entry": {
                    "include": {
                        "factory_profile": True,
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

        if not candidates:
            logger.info("OptimizationEngine: no complete candidates for request %s", request_id)
            return []

        # Apply hard feasibility constraints
        feasible = [c for c in candidates if self._is_feasible(c, req)]
        if not feasible:
            logger.info("OptimizationEngine: no feasible candidates for request %s", request_id)
            return []

        # Convert to plain dicts with raw metrics
        candidate_dicts = [self._candidate_to_dict(c, req) for c in feasible]

        if mode == "deep":
            ranked = self.run_deep_optimization(candidate_dicts, weights)
        else:
            ranked = self._run_fast_optimization(candidate_dicts, weights)

        # Persist results back to DB
        await self._persist_results(ranked, mode)

        return ranked

    async def compute_score_breakdown(
        self,
        candidate: dict,
        weights: tuple[float, float, float],
    ) -> dict:
        """
        Compute normalised score breakdown for a single candidate
        relative to a pool of one (used when called standalone).
        Returns score_breakdown dict.
        """
        cost_w, time_w, rel_w = weights
        # With a single candidate, all norms are 0; fitness = reliability weight
        breakdown = {
            "cost_norm": 0.0,
            "time_norm": 0.0,
            "reliability_norm": 0.0,
            "final_score": rel_w,
            "weights": {"cost": cost_w, "time": time_w, "reliability": rel_w},
        }
        return breakdown

    def run_deep_optimization(
        self,
        feasible_candidates: list[dict],
        weights: tuple[float, float, float],
    ) -> list[dict]:
        """
        DEAP eaMuPlusLambda multi-objective GA (NSGA-II inspired).
        Returns up to _GA_TOP_N diverse, high-quality solutions ranked by
        weighted sum of normalised objectives.  Fixed random seed 42 for
        reproducibility.

        To guarantee multiple results, the method collects unique candidate
        indices both from the Hall-of-Fame (best ever seen) and from the final
        population, then pads with top-ranked pool entries if needed, ensuring
        at least min(n, 5) distinct solutions are always returned.
        """
        n = len(feasible_candidates)
        if n == 0:
            return []
        if n == 1:
            return self._score_pool(feasible_candidates, weights)

        random.seed(_GA_RANDOM_SEED)

        # Pre-compute raw metrics for the pool
        costs         = [float(c["total_cost"])    for c in feasible_candidates]
        times         = [float(c["delivery_days"]) for c in feasible_candidates]
        reliabilities = [float(c["reliability"])   for c in feasible_candidates]

        min_cost, max_cost = min(costs),         max(costs)
        min_time, max_time = min(times),         max(times)
        min_rel,  max_rel  = min(reliabilities), max(reliabilities)

        cost_w, time_w, rel_w = weights

        # Clean up any previous DEAP creator classes
        for attr in ("FitnessSingle", "Individual"):
            if hasattr(creator, attr):
                delattr(creator, attr)

        # Single-objective: maximise the same weighted sum used by Fast Weighted
        # so the GA always optimises for the actual profile (not fixed equal weights)
        creator.create("FitnessSingle", base.Fitness, weights=(1.0,))
        creator.create("Individual", list, fitness=creator.FitnessSingle)

        toolbox = base.Toolbox()
        toolbox.register("candidate_idx", random.randint, 0, n - 1)
        toolbox.register(
            "individual",
            tools.initRepeat,
            creator.Individual,
            toolbox.candidate_idx,
            n=1,
        )
        toolbox.register("population", tools.initRepeat, list, toolbox.individual)

        def evaluate(individual: list) -> tuple[float]:
            idx = individual[0] % n
            c = feasible_candidates[idx]
            cost_n = _normalise(float(c["total_cost"]),    min_cost, max_cost)
            time_n = _normalise(float(c["delivery_days"]), min_time, max_time)
            rel_n  = _normalise(float(c["reliability"]),   min_rel,  max_rel)
            score = cost_w * (1.0 - cost_n) + time_w * (1.0 - time_n) + rel_w * rel_n
            return (score,)

        def mutate(individual: list, indpb: float = 0.3) -> tuple:
            if random.random() < indpb:
                individual[0] = random.randint(0, n - 1)
            return (individual,)

        toolbox.register("evaluate", evaluate)
        toolbox.register("mate",   tools.cxUniform, indpb=0.5)
        toolbox.register("mutate", mutate)
        toolbox.register("select", tools.selTournament, tournsize=3)

        pop_size = min(_GA_POP_SIZE, n * 10)
        population = toolbox.population(n=pop_size)

        # Hall-of-Fame tracks the best _GA_TOP_N unique individuals ever seen
        hof = tools.HallOfFame(maxsize=_GA_TOP_N, similar=lambda a, b: a[0] == b[0])

        # Evaluate initial population
        fitnesses = list(map(toolbox.evaluate, population))
        for ind, fit in zip(population, fitnesses):
            ind.fitness.values = fit
        hof.update(population)

        # eaMuPlusLambda — update HOF after every generation manually since
        # the built-in halloffame param only updates once at the end
        for _gen in range(_GA_NGEN):
            offspring = algorithms.varOr(population, toolbox, lambda_=pop_size, cxpb=_GA_CXPB, mutpb=_GA_MUTPB)
            invalid = [ind for ind in offspring if not ind.fitness.valid]
            for ind, fit in zip(invalid, map(toolbox.evaluate, invalid)):
                ind.fitness.values = fit
            population = toolbox.select(population + offspring, k=pop_size)
            hof.update(population)

        # ── Collect unique indices from HOF + final population ────────────────
        seen: set[int] = set()
        selected_indices: list[int] = []

        # HOF first — best solutions encountered during all generations
        for ind in hof:
            idx = ind[0] % n
            if idx not in seen:
                seen.add(idx)
                selected_indices.append(idx)

        # Then sweep the final population for any additional diversity
        for ind in population:
            if len(selected_indices) >= _GA_TOP_N:
                break
            idx = ind[0] % n
            if idx not in seen:
                seen.add(idx)
                selected_indices.append(idx)

        # ── Diversity floor: if fewer than 5 unique solutions, pad with the
        # top-weighted-score candidates from the full pool ─────────────────────
        min_solutions = min(n, 5)
        if len(selected_indices) < min_solutions:
            # Score entire pool and take highest-ranked not already included
            full_scored = self._score_pool(feasible_candidates, weights)
            for entry in full_scored:
                if len(selected_indices) >= _GA_TOP_N:
                    break
                # Find original index of this entry
                orig_idx = next(
                    (i for i, c in enumerate(feasible_candidates) if c["id"] == entry["id"]),
                    None,
                )
                if orig_idx is not None and orig_idx not in seen:
                    seen.add(orig_idx)
                    selected_indices.append(orig_idx)

        # Score every candidate relative to the FULL pool (same normalization base
        # as Fast Weighted) then keep only the GA-selected indices, in rank order.
        selected_ids = {feasible_candidates[i]["id"] for i in selected_indices}
        all_scored = self._score_pool(feasible_candidates, weights)
        ga_results = [c for c in all_scored if c["id"] in selected_ids]
        return ga_results[:_GA_TOP_N]

    async def compare_baselines(self, request_id: str, profile: str | None = None) -> dict:
        """
        Run both fast and deep modes plus greedy and weighted-heuristic baselines.
        Returns a dict with all four result sets for Chapter 5 comparison.

        If *profile* is provided it overrides Request.optimization_profile for
        weight resolution (handy for the admin profile-selector UI).
        """
        req = await prisma.request.find_first(
            where={"id": request_id, "deleted_at": None},
            include={
                "destination_address": {
                    "include": {"country": True, "region": True, "city": True}
                },
            },
        )
        if not req:
            return {"error": "Request not found"}

        active_profile = profile or req.optimization_profile
        weights = self._resolve_weights(active_profile)

        candidates_raw = await prisma.matchcandidate.find_many(
            where={
                "request_id": request_id,
                "logistic_offer_id": {"not": None},
                "status": "PENDING",
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

        feasible = [c for c in candidates_raw if self._is_feasible(c, req)]
        if not feasible:
            return {"error": "No feasible candidates"}

        pool = [self._candidate_to_dict(c, req) for c in feasible]

        greedy_result    = self._run_greedy(pool)
        fast_result      = self._run_fast_optimization(pool, weights)
        deep_result      = self.run_deep_optimization(pool, weights)

        return {
            "request_id": request_id,
            "optimization_profile": active_profile,
            "weights": {"cost": weights[0], "time": weights[1], "reliability": weights[2]},
            "candidate_pool_size": len(pool),
            "pool": [
                {"id": c["id"], "total_cost": c["total_cost"], "delivery_days": c["delivery_days"], "reliability": c["reliability"]}
                for c in pool
            ],
            "greedy": greedy_result[:5],
            "fast":   fast_result[:5],
            "deep":   deep_result[:5],
        }

    # ── Private helpers ───────────────────────────────────────────────────

    @staticmethod
    def _resolve_weights(
        profile: str | None,
    ) -> tuple[float, float, float]:
        p = (profile or "balanced").lower()
        return WEIGHT_PROFILES.get(p, WEIGHT_PROFILES["balanced"])

    @staticmethod
    def _is_feasible(candidate: Any, req: Any) -> bool:
        """
        Hard constraints:
          1. quoted_quantity ≤ inventory quantity_available
          2. Logistic offer covers the request destination country (at minimum)
          3. Only ACTIVE / non-deleted inventory entries
        """
        inv = candidate.inventory_entry
        offer = candidate.logistic_offer

        if inv is None or offer is None:
            return False
        if inv.deleted_at is not None or inv.status not in ("ACTIVE", "PENDING"):
            return False
        if offer.deleted_at is not None or offer.status not in ("ACTIVE", "PENDING"):
            return False

        # Quantity check
        quoted_qty = candidate.quoted_quantity or inv.quantity_available
        if quoted_qty > inv.quantity_available:
            return False

        # Coverage check – need destination address
        dest_addr = getattr(req, "destination_address", None)
        if dest_addr is None:
            return True  # cannot verify; allow through

        covered_areas = getattr(offer, "covered_areas", []) or []
        if not covered_areas:
            return True  # no coverage restrictions recorded; allow

        dest_country_id = getattr(dest_addr, "country_id", None)
        dest_region_id  = getattr(dest_addr, "region_id",  None)
        dest_city_id    = getattr(dest_addr, "city_id",    None)

        for area in covered_areas:
            if area.deleted_at is not None or area.status != "ACTIVE":
                continue
            if area.country_id != dest_country_id:
                continue
            # country matches; if no finer constraint, it's covered
            if area.region_id is None:
                return True
            if area.region_id != dest_region_id:
                continue
            if area.city_id is None:
                return True
            if area.city_id == dest_city_id:
                return True

        return False

    @staticmethod
    def _candidate_to_dict(candidate: Any, req: Any) -> dict:
        """
        Convert a Prisma MatchCandidate ORM object to a plain dict
        containing the raw metrics needed for scoring.
        """
        inv   = candidate.inventory_entry
        offer = candidate.logistic_offer

        quoted_qty  = candidate.quoted_quantity or (inv.quantity_available if inv else Decimal("1"))
        goods_cost  = (inv.price_per_unit * quoted_qty) if inv else Decimal("0")
        delivery_price = candidate.delivery_price or Decimal("0")
        total_cost  = candidate.total_cost or (goods_cost + delivery_price)
        delivery_days = candidate.delivery_days or (
            (offer.estimated_days_max or 7) if offer else 7
        )
        reliability = candidate.reliability_score or (
            offer.reliability_score if offer else 0.5
        )

        return {
            "id":               candidate.id,
            "request_id":       candidate.request_id,
            "inventory_entry_id": candidate.inventory_entry_id,
            "logistic_offer_id":  candidate.logistic_offer_id,
            "total_cost":       float(total_cost),
            "delivery_days":    float(delivery_days),
            "reliability":      float(reliability),
            "currency_code":    candidate.currency_code,
            "quoted_quantity":  float(quoted_qty),
            # keep for passthrough
            "_orm": candidate,
        }

    @staticmethod
    def _score_pool(
        pool: list[dict],
        weights: tuple[float, float, float],
    ) -> list[dict]:
        """
        Min-max normalise all three objectives across the pool,
        compute weighted-sum final_score, sort descending (higher = better),
        attach score_breakdown, rank.
        """
        if not pool:
            return []

        cost_w, time_w, rel_w = weights

        costs  = [c["total_cost"]    for c in pool]
        times  = [c["delivery_days"] for c in pool]
        rels   = [c["reliability"]   for c in pool]

        min_cost, max_cost = min(costs), max(costs)
        min_time, max_time = min(times), max(times)
        min_rel,  max_rel  = min(rels),  max(rels)

        scored: list[dict] = []
        for c in pool:
            cost_n = _normalise(c["total_cost"],    min_cost, max_cost)
            time_n = _normalise(c["delivery_days"], min_time, max_time)
            rel_n  = _normalise(c["reliability"],   min_rel,  max_rel)

            # lower cost/time is better → invert norms; higher reliability is better
            final_score = (
                cost_w * (1.0 - cost_n)
                + time_w * (1.0 - time_n)
                + rel_w  * rel_n
            )

            entry = dict(c)
            entry["score_breakdown"] = {
                "cost_norm":        round(cost_n, 6),
                "time_norm":        round(time_n, 6),
                "reliability_norm": round(rel_n, 6),
                "final_score":      round(final_score, 6),
                "weights":          {"cost": cost_w, "time": time_w, "reliability": rel_w},
            }
            entry["fitness_score"] = round(final_score, 6)
            scored.append(entry)

        scored.sort(key=lambda x: x["fitness_score"], reverse=True)

        for rank, c in enumerate(scored, start=1):
            c["rank"] = rank

        return scored

    def _run_fast_optimization(
        self,
        pool: list[dict],
        weights: tuple[float, float, float],
    ) -> list[dict]:
        """Fast mode: straightforward min-max weighted-sum over the full pool."""
        return self._score_pool(pool, weights)

    @staticmethod
    def _run_greedy(pool: list[dict]) -> list[dict]:
        """Baseline: sort by raw total_cost ascending."""
        sorted_pool = sorted(pool, key=lambda c: c["total_cost"])
        for rank, c in enumerate(sorted_pool, start=1):
            c = dict(c)
            c["rank"] = rank
            c["score_breakdown"] = {
                "strategy": "greedy",
                "total_cost": c["total_cost"],
            }
            sorted_pool[rank - 1] = c
        return sorted_pool

    async def _persist_results(self, ranked: list[dict], mode: str) -> None:
        """
        Write fitness_score, score_breakdown, optimization_mode, rank
        back to each MatchCandidate in the DB.
        Uses individual updates (no batch upsert in Prisma-Py).
        """
        from prisma import Json

        for item in ranked:
            candidate_id = item.get("id")
            if not candidate_id:
                continue
            try:
                await prisma.matchcandidate.update(
                    where={"id": candidate_id},
                    data={
                        "fitness_score":      item.get("fitness_score"),
                        "score_breakdown":    Json(item.get("score_breakdown") or {}),
                        "optimization_mode":  mode,
                        "rank":               item.get("rank"),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "OptimizationEngine: failed to persist candidate %s: %s",
                    candidate_id, exc,
                )
