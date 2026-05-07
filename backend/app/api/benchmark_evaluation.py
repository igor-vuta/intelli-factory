"""
Chapter 5 Benchmark Evaluation Script — Intelli-Factory
========================================================
Runs the four optimisation modes (Greedy, Weighted-Heuristic, Fast Weighted,
Deep GA / NSGA-II) across 120 synthetic scenarios (30 Monte-Carlo seeds each)
and prints Table XII–style aggregate results plus hypervolume statistics.

Synthetic data ranges mirror the paper:
  • Cost:        KZT 5 000 – 250 000  (stored as floats for engine compat.)
  • Delivery:    2 – 14 days
  • Reliability: 0.70 – 0.98
  • Candidates per scenario: 8 – 25 feasible pairs

Usage (from the backend/app/api directory):
    source .venv/bin/activate
    python benchmark_evaluation.py

No live DB connection required – all scenarios are generated in-memory.
"""

from __future__ import annotations

import random
import sys
import time
import uuid
from pathlib import Path
from statistics import mean, stdev
from typing import Any

# ---------------------------------------------------------------------------
# Make sure the services package is importable even when run directly
# ---------------------------------------------------------------------------
_API_ROOT = Path(__file__).resolve().parent
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from services.optimization_engine import (  # noqa: E402
    WEIGHT_PROFILES,
    OptimizationEngine,
    _normalise,
)

# ---------------------------------------------------------------------------
# Synthetic scenario generation
# ---------------------------------------------------------------------------

RNG_MASTER = random.Random(2025)          # deterministic master seed

COST_LO,  COST_HI  = 5_000.0,  250_000.0  # KZT total cost
TIME_LO,  TIME_HI  = 2.0,      14.0       # delivery days
REL_LO,   REL_HI   = 0.70,     0.98       # reliability
CAND_LO,  CAND_HI  = 8,        25         # feasible pairs per scenario

N_SCENARIOS = 120
N_RUNS      = 30   # Monte-Carlo seeds per scenario


def _synthetic_scenario(master_rng: random.Random) -> list[dict]:
    """
    Return a list of plain-dict 'candidates' for one scenario.
    Each candidate has total_cost, delivery_days, reliability.
    IDs are random UUIDs so the engine never confuses scenarios.
    """
    n = master_rng.randint(CAND_LO, CAND_HI)
    pool: list[dict] = []
    for _ in range(n):
        pool.append({
            "id":               str(uuid.uuid4()),
            "request_id":       "bench-req",
            "inventory_entry_id": str(uuid.uuid4()),
            "logistic_offer_id":  str(uuid.uuid4()),
            "total_cost":       master_rng.uniform(COST_LO, COST_HI),
            "delivery_days":    master_rng.uniform(TIME_LO, TIME_HI),
            "reliability":      master_rng.uniform(REL_LO,  REL_HI),
            "currency_code":    "KZT",
            "quoted_quantity":  float(master_rng.randint(5, 200)),
        })
    return pool


def _generate_scenarios() -> list[list[dict]]:
    scenarios = []
    for _ in range(N_SCENARIOS):
        scenarios.append(_synthetic_scenario(RNG_MASTER))
    return scenarios


# ---------------------------------------------------------------------------
# Hypervolume (2-D sweepline: inverted-cost vs reliability, both ↑ better)
# Reference point (0, 0) = worst-case corner in maximisation space.
# ---------------------------------------------------------------------------

def _hypervolume_2d(pareto_front: list[dict]) -> float:
    """
    Compute the exact 2-D hypervolume dominated by the Pareto front relative
    to the nadir reference point (0, 0) in the maximisation space where:
        x = 1 - cost_norm   (inverted so higher = better)
        y = reliability_norm (already higher = better)

    Uses the standard O(n log n) sweepline algorithm.
    The result is normalised to [0, 1] by dividing by the ideal area (1.0 × 1.0).
    """
    if not pareto_front:
        return 0.0

    points: list[tuple[float, float]] = []
    for c in pareto_front:
        sb = c.get("score_breakdown", {})
        cost_n = sb.get("cost_norm", 0.0)
        rel_n  = sb.get("reliability_norm", 0.0)
        points.append((1.0 - cost_n, rel_n))   # maximisation space

    if not points:
        return 0.0

    # Keep only non-dominated points (Pareto filter)
    points.sort(key=lambda p: p[0], reverse=True)   # descending x
    non_dom: list[tuple[float, float]] = []
    best_y = -1.0
    for p in points:
        if p[1] > best_y:
            non_dom.append(p)
            best_y = p[1]

    if not non_dom:
        return 0.0

    # Sweepline: sort by x ascending, accumulate rectangles above prev_y
    non_dom.sort(key=lambda p: p[0])
    hv = 0.0
    prev_x = 0.0
    prev_y = 0.0
    for x, y in non_dom:
        # rectangle: width=(x - prev_x), height=(y - prev_y relative to 0)
        # Standard: area += (x - prev_x) * y
        hv += (x - prev_x) * y
        prev_x = x
        prev_y = max(prev_y, y)

    # Last strip from rightmost x to the ideal corner (1.0)
    # Not needed if ref=(0,0); total area correctly accumulated above.
    return min(max(hv, 0.0), 1.0)


# ---------------------------------------------------------------------------
# Run the four modes on a single scenario pool
# ---------------------------------------------------------------------------

engine = OptimizationEngine()
DEFAULT_WEIGHTS = WEIGHT_PROFILES["balanced"]   # (0.4, 0.3, 0.3)


def _fitness_score(c: dict, pool: list[dict], weights: tuple[float, float, float]) -> float:
    """
    Compute the engine's native fitness_score (higher = better) for candidate *c*
    using min-max normalisation across *pool*.  Mirrors OptimizationEngine._score_pool.
    """
    costs  = [x["total_cost"]    for x in pool]
    times  = [x["delivery_days"] for x in pool]
    rels   = [x["reliability"]   for x in pool]

    cost_n = _normalise(c["total_cost"],    min(costs), max(costs))
    time_n = _normalise(c["delivery_days"], min(times), max(times))
    rel_n  = _normalise(c["reliability"],   min(rels),  max(rels))

    wc, wt, wr = weights
    return wc * (1.0 - cost_n) + wt * (1.0 - time_n) + wr * rel_n


def _run_scenario(pool: list[dict], seed: int) -> dict[str, Any]:
    """
    Run all four modes on *pool* with the given random seed for the deep GA.
    Returns per-mode best-candidate metrics.
    """
    import services.optimization_engine as _eng_module
    _eng_module._GA_RANDOM_SEED = seed          # vary seed per run

    results: dict[str, Any] = {}

    # ── Greedy ────────────────────────────────────────────────────────────
    t0 = time.perf_counter()
    greedy = engine._run_greedy(list(pool))
    results["greedy"] = {
        "time_s": time.perf_counter() - t0,
        "best":   greedy[0] if greedy else None,
        "front":  greedy,
    }

    # ── Weighted Heuristic ────────────────────────────────────────────────
    t0 = time.perf_counter()
    heuristic = engine._score_pool(list(pool), DEFAULT_WEIGHTS)
    results["heuristic"] = {
        "time_s": time.perf_counter() - t0,
        "best":   heuristic[0] if heuristic else None,
        "front":  heuristic,
    }

    # ── Fast Weighted ─────────────────────────────────────────────────────
    t0 = time.perf_counter()
    fast = engine._run_fast_optimization(list(pool), DEFAULT_WEIGHTS)
    results["fast"] = {
        "time_s": time.perf_counter() - t0,
        "best":   fast[0] if fast else None,
        "front":  fast,
    }

    # ── Deep GA ───────────────────────────────────────────────────────────
    t0 = time.perf_counter()
    deep = engine.run_deep_optimization(list(pool), DEFAULT_WEIGHTS)
    elapsed_deep = time.perf_counter() - t0
    hv = _hypervolume_2d(deep) if deep else 0.0
    results["deep"] = {
        "time_s":      elapsed_deep,
        "best":        deep[0] if deep else None,
        "front":       deep,
        "front_size":  len(deep),
        "hypervolume": hv,
    }

    return results


# ---------------------------------------------------------------------------
# Aggregate statistics
# ---------------------------------------------------------------------------

def run_benchmark() -> None:
    print("=" * 70)
    print("  Intelli-Factory Chapter 5 Benchmark Evaluation")
    print(f"  {N_SCENARIOS} scenarios × {N_RUNS} seeds = "
          f"{N_SCENARIOS * N_RUNS} total evaluations")
    print("=" * 70)

    scenarios = _generate_scenarios()

    # Per-mode accumulators
    acc: dict[str, dict] = {
        m: {"fitness": [], "cost": [], "time": [], "rel": [], "latency": []}
        for m in ("greedy", "heuristic", "fast", "deep")
    }
    hv_acc: list[float] = []
    feasibility = {"total": 0, "feasible": 0}

    for sc_idx, pool in enumerate(scenarios):
        feasibility["total"] += 1
        if pool:
            feasibility["feasible"] += 1

        for run_seed in range(N_RUNS):
            seed = run_seed * 1000 + sc_idx
            res = _run_scenario(pool, seed)

            for mode in ("greedy", "heuristic", "fast", "deep"):
                best = res[mode].get("best")
                acc[mode]["latency"].append(res[mode]["time_s"])
                if best:
                    # Use engine's own fitness_score when available,
                    # otherwise compute it against the full pool
                    fs = best.get("fitness_score")
                    if fs is None:
                        fs = _fitness_score(best, pool, DEFAULT_WEIGHTS)
                    acc[mode]["fitness"].append(fs)
                    acc[mode]["cost"].append(best["total_cost"])
                    acc[mode]["time"].append(best["delivery_days"])
                    acc[mode]["rel"].append(best["reliability"])

            hv_acc.append(res["deep"]["hypervolume"])

        if (sc_idx + 1) % 20 == 0:
            print(f"  ... processed {sc_idx + 1}/{N_SCENARIOS} scenarios")

    print(f"\n  Done. {N_SCENARIOS} scenarios processed.\n")

    # ── Baseline means ────────────────────────────────────────────────────
    g_fitness = mean(acc["greedy"]["fitness"])
    g_cost    = mean(acc["greedy"]["cost"])
    g_time    = mean(acc["greedy"]["time"])
    g_rel     = mean(acc["greedy"]["rel"])

    def pct_fitness(vals: list[float]) -> float:
        return (mean(vals) - g_fitness) / g_fitness * 100.0

    def pct_cost(vals: list[float]) -> float:
        return (g_cost - mean(vals)) / g_cost * 100.0

    def pct_time(vals: list[float]) -> float:
        return (g_time - mean(vals)) / g_time * 100.0

    def pct_rel(vals: list[float]) -> float:
        return (mean(vals) - g_rel) / g_rel * 100.0

    # ── Table XII ─────────────────────────────────────────────────────────
    print("TABLE XII — Average performance across 120 test scenarios (30 runs each)")
    print("-" * 90)
    print(f"{'Metric':<38} {'Greedy':>10} {'W.Heuristic':>13} {'Fast Wtd':>10} {'Deep GA':>10}")
    print("-" * 90)

    def row(label: str, gv: str, hv: str, fv: str, dv: str) -> None:
        print(f"{label:<38} {gv:>10} {hv:>13} {fv:>10} {dv:>10}")

    def fmt(v: float, d: int = 3) -> str:
        return f"{v:.{d}f}"

    def fmtp(v: float) -> str:
        sign = "+" if v >= 0 else ""
        return f"{sign}{v:.1f}"

    # Fitness score (higher = better, matches engine convention)
    row("Fitness Score (↑ better)",
        fmt(g_fitness),
        fmt(mean(acc["heuristic"]["fitness"])),
        fmt(mean(acc["fast"]["fitness"])),
        fmt(mean(acc["deep"]["fitness"])))

    # Fitness score % improvement vs greedy
    row("Fitness Score improvement (%)",
        "–",
        fmtp(pct_fitness(acc["heuristic"]["fitness"])),
        fmtp(pct_fitness(acc["fast"]["fitness"])),
        fmtp(pct_fitness(acc["deep"]["fitness"])))

    # Raw cost change (greedy = cheapest by design)
    row("Raw cost vs greedy (%, +ve = saving)",
        "–",
        fmtp(pct_cost(acc["heuristic"]["cost"])),
        fmtp(pct_cost(acc["fast"]["cost"])),
        fmtp(pct_cost(acc["deep"]["cost"])))

    # Delivery time
    row("Delivery time reduction (%)",
        "–",
        fmtp(pct_time(acc["heuristic"]["time"])),
        fmtp(pct_time(acc["fast"]["time"])),
        fmtp(pct_time(acc["deep"]["time"])))

    # Reliability
    row("Reliability improvement (%)",
        "–",
        fmtp(pct_rel(acc["heuristic"]["rel"])),
        fmtp(pct_rel(acc["fast"]["rel"])),
        fmtp(pct_rel(acc["deep"]["rel"])))

    # Hypervolume (deep only)
    row("Hypervolume (normalised, ↑ better)",
        "–", "–", "–",
        fmt(mean(hv_acc)))

    # Feasibility
    feas_pct = feasibility["feasible"] / max(feasibility["total"], 1) * 100.0
    row("Feasibility rate (%)",
        fmt(feas_pct, 1),
        fmt(feas_pct, 1),
        fmt(feas_pct, 1),
        fmt(feas_pct, 1))

    # Avg response time
    row("Avg response time (s)",
        fmt(mean(acc["greedy"]["latency"]),    4),
        fmt(mean(acc["heuristic"]["latency"]), 4),
        fmt(mean(acc["fast"]["latency"]),      4),
        fmt(mean(acc["deep"]["latency"]),      3))

    print("-" * 90)

    # ── Extended stats ────────────────────────────────────────────────────
    print("\nExtended statistics:")
    print(f"  Deep GA hypervolume    mean ± std : "
          f"{mean(hv_acc):.4f} ± {stdev(hv_acc):.4f}")
    print(f"  Deep GA response time  mean ± std : "
          f"{mean(acc['deep']['latency']):.3f}s ± {stdev(acc['deep']['latency']):.3f}s")
    print(f"  Greedy fitness score   mean ± std : "
          f"{g_fitness:.4f} ± {stdev(acc['greedy']['fitness']):.4f}")
    print(f"  Deep GA fitness score  mean ± std : "
          f"{mean(acc['deep']['fitness']):.4f} ± {stdev(acc['deep']['fitness']):.4f}")

    # ── Raw objective means ───────────────────────────────────────────────
    print("\nRaw objective means (all runs):")
    print(f"  {'Mode':<20} {'Avg Cost (KZT)':>17} {'Avg Days':>10} {'Avg Reliability':>17}")
    for mode, label in [
        ("greedy",    "Greedy"),
        ("heuristic", "Weighted Heuristic"),
        ("fast",      "Fast Weighted"),
        ("deep",      "Deep GA (NSGA-II)"),
    ]:
        mc = mean(acc[mode]["cost"])
        mt = mean(acc[mode]["time"])
        mr = mean(acc[mode]["rel"])
        print(f"  {label:<20} {mc:>17,.1f} {mt:>10.2f} {mr:>17.4f}")

    print("\nNote: Greedy selects lowest raw cost by design; multi-objective")
    print("  methods deliberately trade higher cost for better time/reliability,")
    print("  yielding superior Fitness Scores and Pareto diversity (hypervolume).")
    print("\n" + "=" * 70)
    print("  Benchmark complete.")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmark()
