import * as THREE from 'three';
import {
  type Camera,
  DEFAULT_CAMERA,
  FLOOR,
  TOP,
  type Vec3,
  cameraPosition,
  frontSurface,
  project,
  worldPoints,
} from './paretoScene';
import type { Candidate } from './tradeoff';

/* The hero's trade-off scene: every offer of one real benchmark scenario in cost × days ×
   reliability space. Loaded on demand by components/landing/ParetoStage.tsx, never on first
   paint. The SVG still underneath is the same scene, so this only adds depth and motion. */

export type StageInput = {
  pool: Candidate[];
  front: number[];
  knee: number | null;
  pick: number;
  cheapest: number;
  palette: { text: string; muted: string; line: string; accent: string; dominated: string };
};

export type StageHandles = {
  destroy: () => void;
  rotateBy: (azimuth: number, elevation: number) => void;
  setPalette: (palette: StageInput['palette']) => void;
};

type Label = { element: HTMLElement; point: Vec3 };

const INTRO_MS = 1400;
const MIN_ELEVATION = (8 * Math.PI) / 180;
const MAX_ELEVATION = (62 * Math.PI) / 180;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function mountStage(
  host: HTMLElement,
  input: StageInput,
  labels: Label[],
  onSlow: () => void
): StageHandles | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'pareto-canvas';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA.fov, 1, 0.1, 50);
  const view: Camera = { ...DEFAULT_CAMERA };
  const points = worldPoints(input.pool);
  const frontSet = new Set(input.front);
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T) => (disposables.push(item), item);

  // Floor grid and axes.
  const gridMaterial = track(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 }));
  const grid: number[] = [];
  for (let i = -1; i <= 1.0001; i += 0.5) {
    grid.push(-1, FLOOR, i, 1, FLOOR, i, i, FLOOR, -1, i, FLOOR, 1);
  }
  grid.push(-1, FLOOR, -1, -1, TOP, -1);
  const gridGeometry = track(new THREE.BufferGeometry());
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));

  // Candidates: instanced spheres, dominated ones smaller and dimmer.
  const sphere = track(new THREE.SphereGeometry(1, 20, 14));
  const dominatedMaterial = track(new THREE.MeshBasicMaterial());
  const frontMaterial = track(new THREE.MeshBasicMaterial());
  const accentMaterial = track(new THREE.MeshBasicMaterial());
  const dominated = points.map((_, i) => i).filter((i) => !frontSet.has(i) && i !== input.pick);
  const frontOnly = input.front.filter((i) => i !== input.pick);
  const dominatedMesh = new THREE.InstancedMesh(sphere, dominatedMaterial, dominated.length);
  const frontMesh = new THREE.InstancedMesh(sphere, frontMaterial, frontOnly.length);
  const pickMesh = new THREE.Mesh(sphere, accentMaterial);
  scene.add(dominatedMesh, frontMesh, pickMesh);

  // Drop lines from each offer to the floor give the depth cue.
  const dropMaterial = track(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 }));
  const dropGeometry = track(new THREE.BufferGeometry());
  dropGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(points.length * 6), 3)
  );
  scene.add(new THREE.LineSegments(dropGeometry, dropMaterial));

  // Surface through the non-dominated offers.
  const triangles = frontSurface(points, input.front);
  const surfaceGeometry = track(new THREE.BufferGeometry());
  surfaceGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(points.length * 3), 3)
  );
  surfaceGeometry.setIndex(triangles.flat());
  const surfaceMaterial = track(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  // Unique triangle edges, drawn as lines whose ends follow the rising points.
  const edges = [
    ...new Set(
      triangles.flatMap(([a, b, c]) =>
        [
          [a, b],
          [b, c],
          [c, a],
        ].map(([u, v]) => `${Math.min(u, v)}-${Math.max(u, v)}`)
      )
    ),
  ].map((key) => key.split('-').map(Number));
  const wireMaterial = track(new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }));
  const wireGeometry = track(new THREE.BufferGeometry());
  wireGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(edges.length * 6), 3)
  );
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const wire = new THREE.LineSegments(wireGeometry, wireMaterial);
  scene.add(surface, wire);

  // Rings for the cheapest offer and the knee, always facing the camera.
  const ringGeometry = track(new THREE.RingGeometry(1, 1.22, 40));
  const cheapestMaterial = track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const kneeMaterial = track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const cheapestRing = new THREE.Mesh(ringGeometry, cheapestMaterial);
  const kneeRing = new THREE.Mesh(ringGeometry, kneeMaterial);
  scene.add(cheapestRing);
  if (input.knee !== null && input.knee !== input.pick) scene.add(kneeRing);

  function setPalette(palette: StageInput['palette']) {
    gridMaterial.color.set(palette.line);
    dropMaterial.color.set(palette.line);
    dominatedMaterial.color.set(palette.dominated);
    frontMaterial.color.set(palette.text);
    accentMaterial.color.set(palette.accent);
    surfaceMaterial.color.set(palette.accent);
    wireMaterial.color.set(palette.accent);
    cheapestMaterial.color.set(palette.muted);
    kneeMaterial.color.set(palette.text);
  }
  setPalette(input.palette);

  const labelRoot = labels[0]?.element.parentElement ?? host;

  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();

  // Offers rise from the floor in order of cost, then the surface and markers fade in.
  function layout(progress: number) {
    const positions = surfaceGeometry.attributes.position as THREE.BufferAttribute;
    const drops = dropGeometry.attributes.position as THREE.BufferAttribute;
    const order = points.map((p, i) => [p[0], i]).sort((a, b) => a[0] - b[0]);
    const rank = new Map(order.map(([, i], r) => [i, r / Math.max(1, order.length - 1)]));
    const heightAt = (i: number) => {
      const local = Math.min(1, Math.max(0, (progress - (rank.get(i) ?? 0) * 0.45) / 0.55));
      return FLOOR + (points[i][1] - FLOOR) * easeOut(local);
    };
    const place = (mesh: THREE.InstancedMesh, list: number[], size: number) => {
      list.forEach((i, k) => {
        position.set(points[i][0], heightAt(i), points[i][2]);
        scale.setScalar(size);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(k, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(dominatedMesh, dominated, 0.028);
    place(frontMesh, frontOnly, 0.04);
    pickMesh.position.set(points[input.pick][0], heightAt(input.pick), points[input.pick][2]);
    pickMesh.scale.setScalar(0.06);
    points.forEach((p, i) => {
      positions.setXYZ(i, p[0], heightAt(i), p[2]);
      drops.setXYZ(i * 2, p[0], heightAt(i), p[2]);
      drops.setXYZ(i * 2 + 1, p[0], FLOOR, p[2]);
    });
    positions.needsUpdate = true;
    drops.needsUpdate = true;
    const reveal = easeOut(Math.min(1, Math.max(0, (progress - 0.75) / 0.25)));
    surfaceMaterial.opacity = 0.12 * reveal;
    wireMaterial.opacity = 0.45 * reveal;
    const wirePositions = wireGeometry.attributes.position as THREE.BufferAttribute;
    edges.forEach(([u, v], k) => {
      wirePositions.setXYZ(k * 2, points[u][0], heightAt(u), points[u][2]);
      wirePositions.setXYZ(k * 2 + 1, points[v][0], heightAt(v), points[v][2]);
    });
    wirePositions.needsUpdate = true;
    for (const [ring, index] of [
      [cheapestRing, input.cheapest],
      [kneeRing, input.knee],
    ] as const) {
      if (index === null) continue;
      ring.position.set(points[index][0], heightAt(index), points[index][2]);
      ring.scale.setScalar(0.075 * reveal);
    }
    labelRoot.style.opacity = String(reveal);
  }

  let width = 0;
  let height = 0;
  let dirty = true;
  function resize() {
    const box = host.getBoundingClientRect();
    width = box.width;
    height = box.height;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    // setSize clears the canvas, so the next frame must redraw even after the intro.
    dirty = true;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function frame() {
    const [x, y, z] = cameraPosition(view);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    cheapestRing.quaternion.copy(camera.quaternion);
    kneeRing.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    for (const { element, point } of labels) {
      const p = project(point, view, width, height);
      element.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
  }

  let raf = 0;
  let running = false;
  let start = 0;
  let introDone = false;
  const frameTimes: number[] = [];
  let last = 0;

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (!start) start = now;
    if (last) {
      frameTimes.push(now - last);
      if (frameTimes.length === 60) {
        const average = frameTimes.reduce((a, b) => a + b, 0) / 60;
        if (average > 24) {
          onSlow();
          return;
        }
      }
    }
    last = now;
    if (!introDone) {
      const progress = Math.min(1, (now - start) / INTRO_MS);
      layout(progress);
      introDone = progress === 1;
      dirty = true;
    }
    if (dirty) {
      frame();
      dirty = false;
    }
  }

  function play() {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const visibility = new IntersectionObserver(([entry]) =>
    entry.isIntersecting && !document.hidden ? play() : pause()
  );
  visibility.observe(host);
  const onHidden = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onHidden);

  return {
    rotateBy(azimuth, elevation) {
      view.azimuth += azimuth;
      view.elevation = Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, view.elevation + elevation));
      dirty = true;
    },
    setPalette(palette) {
      setPalette(palette);
      dirty = true;
    },
    destroy() {
      pause();
      visibility.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
      dominatedMesh.dispose();
      frontMesh.dispose();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
