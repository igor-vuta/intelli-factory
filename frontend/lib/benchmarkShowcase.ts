// Typed access to frontend/public/data/benchmark-showcase.json, produced by
// backend/app/api/export_benchmark_showcase.py from the benchmark's own scenarios and engine.
import showcase from '../public/data/benchmark-showcase.json';
import { type Candidate, greedyPick, kneePoint, nonDominated } from './tradeoff';

type ModeSummary = {
  fitness: number;
  fitnessStd: number;
  cost: number;
  days: number;
  reliability: number;
  fitnessChangePct: number;
  costChangePct: number;
  daysChangePct: number;
  reliabilityChangePct: number;
};

export type Scenario = {
  id: number;
  pool: Candidate[];
  picks: { greedy: number; fast: number; deep: number };
  deepMatchesFastRuns: number;
  front: number[];
  knee: number | null;
};

export const benchmark = {
  scenarioCount: showcase.scenarioCount,
  runsPerScenario: showcase.runsPerScenario,
  weights: showcase.weights,
  summary: showcase.summary as Record<'greedy' | 'fast' | 'deep', ModeSummary>,
  hypervolume: showcase.deepHypervolume,
};

export const scenarios: Scenario[] = showcase.scenarios.map((s) => {
  const pool = s.pool.map(([cost, days, reliability]) => ({ cost, days, reliability }));
  const front = nonDominated(pool);
  return {
    id: s.id,
    pool,
    picks: s.picks as Scenario['picks'],
    deepMatchesFastRuns: s.deepMatchesFastRuns,
    front,
    knee: kneePoint(pool, front),
  };
});

/** Runs in which the genetic search chose the same candidate as the weighted ranking. */
export const deepMatchesFastRuns = scenarios.reduce((sum, s) => sum + s.deepMatchesFastRuns, 0);
export const totalRuns = benchmark.scenarioCount * benchmark.runsPerScenario;

/** Scenarios where the weighted pick is not simply the cheapest offer. */
export const tradeoffScenarios = scenarios.filter((s) => s.picks.fast !== greedyPick(s.pool));

/**
 * The scenario the hero shows: of those where weighting changes the choice, the one with the
 * largest non-dominated set (then the largest pool), so the trade-off is easiest to see.
 */
export const heroScenario: Scenario = [...tradeoffScenarios].sort(
  (a, b) => b.front.length - a.front.length || b.pool.length - a.pool.length || a.id - b.id
)[0];
