import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CAMERA, FLOOR, TOP, delaunay, project } from '../lib/paretoScene';
import {
  type Candidate,
  WEIGHT_PROFILES,
  greedyPick,
  kneePoint,
  nonDominated,
  weightedPick,
  weightedScores,
} from '../lib/tradeoff';

type Showcase = {
  weights: { cost: number; time: number; reliability: number };
  scenarios: {
    pool: [number, number, number][];
    picks: { greedy: number; fast: number; deep: number };
  }[];
};

const showcase: Showcase = JSON.parse(
  readFileSync(path.join(__dirname, '../public/data/benchmark-showcase.json'), 'utf8')
);
const toPool = (rows: [number, number, number][]): Candidate[] =>
  rows.map(([cost, days, reliability]) => ({ cost, days, reliability }));

describe('trade-off helpers against the exported benchmark', () => {
  test('weights match the balanced profile the benchmark used', () => {
    expect(showcase.weights).toEqual(WEIGHT_PROFILES.balanced);
  });

  test.each(showcase.scenarios.map((s, i) => [i + 1, s] as const))(
    'scenario %i: greedy and weighted picks reproduce the engine',
    (_id, scenario) => {
      const pool = toPool(scenario.pool);
      expect(greedyPick(pool)).toBe(scenario.picks.greedy);
      // Pools are rounded on export, so compare scores rather than indexes for near-ties.
      const scores = weightedScores(pool, WEIGHT_PROFILES.balanced);
      const pick = weightedPick(pool, WEIGHT_PROFILES.balanced);
      expect(scores[pick] - scores[scenario.picks.fast]).toBeLessThan(1e-6);
    }
  );

  test('the engine pick and the knee are always on the non-dominated front', () => {
    for (const scenario of showcase.scenarios) {
      const pool = toPool(scenario.pool);
      const front = nonDominated(pool);
      expect(front).toContain(scenario.picks.fast);
      expect(front).toContain(kneePoint(pool, front));
    }
  });
});

describe('dominance and knee on hand-made pools', () => {
  test('a candidate worse on every objective is dominated', () => {
    const pool = [
      { cost: 10, days: 2, reliability: 0.9 },
      { cost: 20, days: 3, reliability: 0.8 },
      { cost: 5, days: 6, reliability: 0.85 },
    ];
    expect(nonDominated(pool)).toEqual([0, 2]);
  });

  test('equal candidates do not dominate each other', () => {
    const same = { cost: 1, days: 1, reliability: 1 };
    expect(nonDominated([same, { ...same }])).toEqual([0, 1]);
  });

  test('flat objectives normalise to zero, as in the engine', () => {
    const pool = [
      { cost: 5, days: 3, reliability: 0.9 },
      { cost: 5, days: 3, reliability: 0.9 },
    ];
    // cost and time count as best (1 - 0), reliability as worst (0): 0.4 + 0.3.
    for (const score of weightedScores(pool, WEIGHT_PROFILES.balanced)) {
      expect(score).toBeCloseTo(0.7, 12);
    }
  });

  test('the knee is the balanced compromise between extremes', () => {
    const pool = [
      { cost: 0, days: 10, reliability: 0.5 },
      { cost: 10, days: 0, reliability: 0.5 },
      { cost: 10, days: 10, reliability: 1 },
      { cost: 3, days: 3, reliability: 0.8 },
    ];
    expect(kneePoint(pool)).toBe(3);
  });

  test('empty and single pools are handled', () => {
    expect(kneePoint([])).toBeNull();
    expect(kneePoint([{ cost: 1, days: 1, reliability: 1 }])).toBe(0);
  });
});

describe('pareto scene geometry', () => {
  test('delaunay of a square gives two triangles covering all corners', () => {
    const tris = delaunay([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expect(tris).toHaveLength(2);
    expect(new Set(tris.flat())).toEqual(new Set([0, 1, 2, 3]));
  });

  test('the origin projects to the centre of the viewport', () => {
    const { x, y } = project([0, 0, 0], DEFAULT_CAMERA, 800, 600);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  test('the best corner is nearer the camera than the worst', () => {
    const best = project([-1, TOP, -1], DEFAULT_CAMERA, 800, 600);
    const worst = project([1, FLOOR, 1], DEFAULT_CAMERA, 800, 600);
    expect(best.depth).not.toBeCloseTo(worst.depth, 3);
  });
});
