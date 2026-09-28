"""Export the benchmark's real scenarios and results for the landing page.

Read-only: reuses benchmark_evaluation's scenario generator, per-scenario runner and weights, so
the exported pools, picks and averages are exactly what `python benchmark_evaluation.py` measures.

    uv run --no-project python export_benchmark_showcase.py

Writes frontend/public/data/benchmark-showcase.json.
"""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean, stdev

import benchmark_evaluation as bench

OUTPUT = (
    Path(__file__).resolve().parents[3] / "frontend" / "public" / "data" / "benchmark-showcase.json"
)
MODES = ("greedy", "fast", "deep")


def _index(pool: list[dict], candidate: dict | None) -> int | None:
    if candidate is None:
        return None
    return next(i for i, c in enumerate(pool) if c["id"] == candidate["id"])


def _git_commit() -> str | None:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def export() -> dict:
    scenarios = bench._generate_scenarios()
    acc = {m: {"fitness": [], "cost": [], "time": [], "rel": []} for m in MODES}
    hypervolumes: list[float] = []
    exported = []

    for sc_idx, pool in enumerate(scenarios):
        picks: dict[str, int | None] = {}
        agreement = 0
        for run_seed in range(bench.N_RUNS):
            # Same seed schedule as benchmark_evaluation.run_benchmark().
            res = bench._run_scenario(pool, run_seed * 1000 + sc_idx)
            for mode in MODES:
                best = res[mode].get("best")
                if best:
                    fitness = best.get("fitness_score")
                    if fitness is None:
                        fitness = bench._fitness_score(best, pool, bench.DEFAULT_WEIGHTS)
                    acc[mode]["fitness"].append(fitness)
                    acc[mode]["cost"].append(best["total_cost"])
                    acc[mode]["time"].append(best["delivery_days"])
                    acc[mode]["rel"].append(best["reliability"])
            hypervolumes.append(res["deep"]["hypervolume"])
            if run_seed == 0:
                picks = {mode: _index(pool, res[mode].get("best")) for mode in MODES}
            agreement += _index(pool, res["deep"].get("best")) == _index(
                pool, res["fast"].get("best")
            )

        exported.append(
            {
                "id": sc_idx + 1,
                # [total cost (KZT), delivery days, reliability] per candidate.
                "pool": [
                    [
                        round(c["total_cost"], 2),
                        round(c["delivery_days"], 4),
                        round(c["reliability"], 5),
                    ]
                    for c in pool
                ],
                "picks": picks,
                "deepMatchesFastRuns": agreement,
            }
        )

    greedy = {k: mean(v) for k, v in acc["greedy"].items()}

    def summary(mode: str) -> dict:
        values = acc[mode]
        return {
            "fitness": mean(values["fitness"]),
            "fitnessStd": stdev(values["fitness"]),
            "cost": mean(values["cost"]),
            "days": mean(values["time"]),
            "reliability": mean(values["rel"]),
            "fitnessChangePct": (mean(values["fitness"]) - greedy["fitness"])
            / greedy["fitness"]
            * 100,
            "costChangePct": (mean(values["cost"]) - greedy["cost"]) / greedy["cost"] * 100,
            "daysChangePct": (mean(values["time"]) - greedy["time"]) / greedy["time"] * 100,
            "reliabilityChangePct": (mean(values["rel"]) - greedy["rel"]) / greedy["rel"] * 100,
        }

    return {
        "source": "backend/app/api/benchmark_evaluation.py",
        "generator": "backend/app/api/export_benchmark_showcase.py",
        "commit": _git_commit(),
        "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        "scenarioCount": len(scenarios),
        "runsPerScenario": bench.N_RUNS,
        "weights": dict(zip(("cost", "time", "reliability"), bench.DEFAULT_WEIGHTS, strict=True)),
        "summary": {mode: summary(mode) for mode in MODES},
        "deepHypervolume": {"mean": mean(hypervolumes), "std": stdev(hypervolumes)},
        "scenarios": exported,
    }


if __name__ == "__main__":
    data = export()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    s = data["summary"]
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KiB)")
    print(
        f"fitness greedy {s['greedy']['fitness']:.3f} fast {s['fast']['fitness']:.3f} "
        f"deep {s['deep']['fitness']:.3f} | hypervolume {data['deepHypervolume']['mean']:.3f}"
    )
