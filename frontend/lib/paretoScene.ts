// Geometry shared by the SVG still (ParetoStill) and the WebGL stage (paretoStage3d): both draw
// the same candidates from the same camera, so the still is the scene, not an illustration of it.
import { type Candidate, normalisedObjectives } from './tradeoff';

export type Vec3 = [number, number, number];

// World box: cost along x, delivery days along z (both lower is better, toward the viewer),
// reliability up y. Normalised objectives map into [-1, 1] × [FLOOR, TOP] × [-1, 1].
export const FLOOR = -0.75;
export const TOP = 0.75;

export function worldPoints(pool: Candidate[]): Vec3[] {
  return normalisedObjectives(pool).map(([cost, days, unreliability]) => [
    cost * 2 - 1,
    FLOOR + (1 - unreliability) * (TOP - FLOOR),
    days * 2 - 1,
  ]);
}

export type Camera = { azimuth: number; elevation: number; distance: number; fov: number };
export const DEFAULT_CAMERA: Camera = {
  azimuth: (-38 * Math.PI) / 180,
  elevation: (24 * Math.PI) / 180,
  distance: 6.2,
  fov: 30,
};

export function cameraPosition({ azimuth, elevation, distance }: Camera): Vec3 {
  return [
    distance * Math.cos(elevation) * Math.sin(azimuth),
    distance * Math.sin(elevation),
    distance * Math.cos(elevation) * Math.cos(azimuth),
  ];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Perspective projection looking at the origin, matching three's PerspectiveCamera with the
 * same position, vertical fov and aspect. Returns CSS pixels and view depth.
 */
export function project(p: Vec3, camera: Camera, width: number, height: number) {
  const eye = cameraPosition(camera);
  const forward = unit(sub([0, 0, 0], eye));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const v = sub(p, eye);
  const depth = dot(v, forward);
  const f = 1 / Math.tan((camera.fov * Math.PI) / 180 / 2);
  const x = (dot(v, right) / depth) * f * (height / width);
  const y = (dot(v, up) / depth) * f;
  return { x: ((x + 1) / 2) * width, y: ((1 - y) / 2) * height, depth };
}

type Triangle = [number, number, number];

/**
 * Delaunay triangulation (Bowyer–Watson) of points in the plane. n is at most a few dozen here,
 * so the quadratic algorithm is instant and needs no library.
 */
export function delaunay(points: [number, number][]): Triangle[] {
  if (points.length < 3) return [];
  const all: [number, number][] = [...points, [-100, -100], [100, -100], [0, 100]];
  const n = points.length;
  let triangles: Triangle[] = [[n, n + 1, n + 2]];

  const circumcircle = ([a, b, c]: Triangle) => {
    const [ax, ay] = all[a];
    const [bx, by] = all[b];
    const [cx, cy] = all[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return { x: 0, y: 0, r2: Infinity };
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return { x, y, r2: (ax - x) ** 2 + (ay - y) ** 2 };
  };

  for (let i = 0; i < n; i++) {
    const [px, py] = all[i];
    const bad = triangles.filter((t) => {
      const { x, y, r2 } = circumcircle(t);
      return (px - x) ** 2 + (py - y) ** 2 < r2;
    });
    const edges: [number, number][] = [];
    for (const t of bad)
      for (const [a, b] of [
        [t[0], t[1]],
        [t[1], t[2]],
        [t[2], t[0]],
      ] as [number, number][]) {
        const shared = bad.some((o) => o !== t && o.includes(a) && o.includes(b));
        if (!shared) edges.push([a, b]);
      }
    triangles = triangles.filter((t) => !bad.includes(t));
    for (const [a, b] of edges) triangles.push([a, b, i]);
  }
  return triangles.filter((t) => t.every((v) => v < n));
}

/** Triangles of the surface through the non-dominated candidates, as indexes into the pool. */
export function frontSurface(points: Vec3[], front: number[]): Triangle[] {
  return delaunay(front.map((i) => [points[i][0], points[i][2]])).map(
    (t) => t.map((k) => front[k]) as Triangle
  );
}
