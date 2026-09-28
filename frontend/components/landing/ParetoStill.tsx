import { useMemo } from 'react';
import {
  AXES,
  DEFAULT_CAMERA,
  FLOOR,
  type Vec3,
  frontSurface,
  project,
  worldPoints,
} from '../../lib/paretoScene';
import type { Scenario } from '../../lib/benchmarkShowcase';

const WIDTH = 720;
const HEIGHT = 560;

/** The hero scene as SVG, from the same camera as the WebGL stage (paretoStage3d). */
export default function ParetoStill({ scenario, pick }: { scenario: Scenario; pick: number }) {
  const drawing = useMemo(() => {
    const points = worldPoints(scenario.pool);
    const at = (p: Vec3) => project(p, DEFAULT_CAMERA, WIDTH, HEIGHT);
    const floor = (p: Vec3): Vec3 => [p[0], FLOOR, p[2]];
    const gridLines: [Vec3, Vec3][] = [];
    for (let i = -1; i <= 1.0001; i += 0.5) {
      gridLines.push([
        [-1, FLOOR, i],
        [1, FLOOR, i],
      ]);
      gridLines.push([
        [i, FLOOR, -1],
        [i, FLOOR, 1],
      ]);
    }
    const front = new Set(scenario.front);
    return {
      grid: gridLines.map(([a, b]) => [at(a), at(b)]),
      axes: AXES.map(({ from, to }) => [at(from), at(to)]),
      surface: frontSurface(points, scenario.front).map((t) => t.map((i) => at(points[i]))),
      // Far points first so nearer ones overlap them.
      offers: points
        .map((p, i) => ({ i, top: at(p), base: at(floor(p)), front: front.has(i) }))
        .sort((a, b) => b.top.depth - a.top.depth),
      cheapest: at(points[scenario.picks.greedy]),
      knee: scenario.knee === null || scenario.knee === pick ? null : at(points[scenario.knee]),
    };
  }, [scenario, pick]);

  return (
    <svg
      className="pareto-still"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g className="pareto-still-grid">
        {drawing.grid.map(([a, b], k) => (
          <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        ))}
      </g>
      <g className="pareto-still-axis">
        {drawing.axes.map(([a, b], k) => (
          <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        ))}
      </g>
      <g className="pareto-still-surface">
        {drawing.surface.map((t, k) => (
          <polygon key={k} points={t.map((p) => `${p.x},${p.y}`).join(' ')} />
        ))}
      </g>
      {drawing.offers.map(({ i, top, base, front }) => (
        <g key={i}>
          <line className="pareto-still-drop" x1={top.x} y1={top.y} x2={base.x} y2={base.y} />
          <circle
            className={
              i === pick
                ? 'pareto-still-pick'
                : front
                  ? 'pareto-still-front'
                  : 'pareto-still-dominated'
            }
            cx={top.x}
            cy={top.y}
            r={(i === pick ? 8 : front ? 5.5 : 4) * (7 / top.depth)}
          />
        </g>
      ))}
      <circle
        className="pareto-still-ring pareto-still-cheapest"
        cx={drawing.cheapest.x}
        cy={drawing.cheapest.y}
        r={11}
      />
      {drawing.knee && (
        <circle
          className="pareto-still-ring pareto-still-knee"
          cx={drawing.knee.x}
          cy={drawing.knee.y}
          r={11}
        />
      )}
    </svg>
  );
}
