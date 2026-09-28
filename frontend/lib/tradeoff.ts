// Client-side views of the optimisation engine's scoring, for showing trade-offs.
// `weightedScores` mirrors OptimizationEngine._score_pool (fast mode) exactly; the front and the
// knee point are derivations for display and are labelled as such wherever they are shown.

export type Candidate = { cost: number; days: number; reliability: number };
export type Weights = { cost: number; time: number; reliability: number };
export type Profile = 'balanced' | 'cost' | 'speed' | 'reliability';

// Same values as WEIGHT_PROFILES in backend/app/api/services/optimization_engine.py.
export const WEIGHT_PROFILES: Record<Profile, Weights> = {
  balanced: { cost: 0.4, time: 0.3, reliability: 0.3 },
  cost: { cost: 0.7, time: 0.2, reliability: 0.1 },
  speed: { cost: 0.2, time: 0.7, reliability: 0.1 },
  reliability: { cost: 0.2, time: 0.2, reliability: 0.6 },
};

type Bounds = { lo: number; hi: number };

function bounds(values: number[]): Bounds {
  return { lo: Math.min(...values), hi: Math.max(...values) };
}

// The engine's _normalise: a flat objective contributes 0.
function normalise(value: number, { lo, hi }: Bounds) {
  return hi === lo ? 0 : (value - lo) / (hi - lo);
}

/** Per-candidate objective values scaled to 0..1 across the pool, where 0 is best. */
export function normalisedObjectives(pool: Candidate[]): [number, number, number][] {
  const cost = bounds(pool.map((c) => c.cost));
  const days = bounds(pool.map((c) => c.days));
  const rel = bounds(pool.map((c) => c.reliability));
  return pool.map((c) => [
    normalise(c.cost, cost),
    normalise(c.days, days),
    1 - normalise(c.reliability, rel),
  ]);
}

/** The engine's fast-mode fitness for every candidate (higher is better). */
export function weightedScores(pool: Candidate[], weights: Weights): number[] {
  if (pool.length === 0) return [];
  const cost = bounds(pool.map((c) => c.cost));
  const days = bounds(pool.map((c) => c.days));
  const rel = bounds(pool.map((c) => c.reliability));
  return pool.map(
    (c) =>
      weights.cost * (1 - normalise(c.cost, cost)) +
      weights.time * (1 - normalise(c.days, days)) +
      weights.reliability * normalise(c.reliability, rel)
  );
}

/** Index of the best weighted score; ties keep the earlier candidate. */
export function weightedPick(pool: Candidate[], weights: Weights): number {
  const scores = weightedScores(pool, weights);
  return scores.reduce((best, score, i) => (score > scores[best] ? i : best), 0);
}

/** The engine's greedy baseline: the cheapest candidate. */
export function greedyPick(pool: Candidate[]): number {
  return pool.reduce((best, c, i) => (c.cost < pool[best].cost ? i : best), 0);
}

function dominates(a: Candidate, b: Candidate) {
  const noWorse = a.cost <= b.cost && a.days <= b.days && a.reliability >= b.reliability;
  const better = a.cost < b.cost || a.days < b.days || a.reliability > b.reliability;
  return noWorse && better;
}

/** Indexes of candidates no other candidate beats on all three objectives. */
export function nonDominated(pool: Candidate[]): number[] {
  return pool
    .map((c, i) => i)
    .filter((i) => !pool.some((other, j) => j !== i && dominates(other, pool[i])));
}

type Vec = [number, number, number];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec) => Math.sqrt(dot(a, a));

/**
 * Knee of the non-dominated set: the candidate that bulges furthest toward the ideal point
 * (best cost, days and reliability at once) from the plane through the front's three extreme
 * candidates. Falls back to the candidate closest to the ideal when the extremes don't span a
 * plane (fronts of one or two distinct points, or collinear extremes).
 */
export function kneePoint(pool: Candidate[], front = nonDominated(pool)): number | null {
  if (front.length === 0) return null;
  const objectives = normalisedObjectives(pool);
  const point = (i: number) => objectives[i] as Vec;
  const closestToIdeal = () =>
    front.reduce((best, i) => (length(point(i)) < length(point(best)) ? i : best), front[0]);

  const extremes = [0, 1, 2].map((axis) =>
    front.reduce((best, i) => (point(i)[axis] < point(best)[axis] ? i : best), front[0])
  );
  const [a, b, c] = extremes.map(point);
  let normal = cross(sub(b, a), sub(c, a));
  if (length(normal) < 1e-9) return closestToIdeal();
  // Orient the normal toward the ideal point (the origin in normalised space).
  if (dot(normal, sub([0, 0, 0], a)) < 0) normal = [-normal[0], -normal[1], -normal[2]];
  const unit = length(normal);
  let knee = closestToIdeal();
  let furthest = 0;
  for (const i of front) {
    const distance = dot(sub(point(i), a), normal) / unit;
    if (distance > furthest + 1e-12) {
      furthest = distance;
      knee = i;
    }
  }
  return knee;
}
