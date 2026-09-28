import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useColorMode } from '../../hooks/useColorMode';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import type { Scenario } from '../../lib/benchmarkShowcase';
import { DEFAULT_CAMERA, type Vec3, project, worldPoints, AXES } from '../../lib/paretoScene';
import type { StageHandles } from '../../lib/paretoStage3d';
import ParetoStill from './ParetoStill';

type MarkerKey = 'cost' | 'days' | 'reliability' | 'pick' | 'cheapest' | 'knee';
type Marker = { key: MarkerKey; point: Vec3; kind: 'axis' | 'marker' };

const MARKER_TEXT: Record<MarkerKey, string> = {
  cost: 'cost',
  days: 'days',
  reliability: 'reliability',
  pick: 'weighted pick',
  cheapest: 'cheapest',
  knee: 'knee',
};

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function readPalette(host: HTMLElement) {
  const style = getComputedStyle(host);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    text: token('--if-text'),
    muted: token('--if-muted'),
    line: token('--if-line'),
    accent: token('--if-accent'),
    dominated: token('--if-dominated'),
  };
}

/**
 * The hero's 3D view of one benchmark scenario. The SVG still is always rendered; the WebGL
 * stage replaces it after first paint when motion is allowed and WebGL works.
 */
export default function ParetoStage({
  scenario,
  caption,
}: {
  scenario: Scenario;
  caption: string;
}) {
  const e = useExperienceCopy();
  const { mode } = useColorMode();
  const host = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stage = useRef<StageHandles | null>(null);
  const [live, setLive] = useState(false);
  const pick = scenario.picks.fast;

  // Where each label sits depends only on the scenario; its text follows the locale.
  const markers = useMemo<Marker[]>(() => {
    const points = worldPoints(scenario.pool);
    return [
      ...AXES.map(({ key, to }) => ({ key, point: to, kind: 'axis' as const })),
      { key: 'pick', point: points[pick], kind: 'marker' },
      { key: 'cheapest', point: points[scenario.picks.greedy], kind: 'marker' },
      ...(scenario.knee !== null && scenario.knee !== pick
        ? [{ key: 'knee' as const, point: points[scenario.knee], kind: 'marker' as const }]
        : []),
    ];
  }, [scenario, pick]);

  // Place labels for the still; the WebGL stage takes over their transforms when live.
  useLayoutEffect(() => {
    const element = host.current;
    if (!element || live) return;
    const place = () => {
      const { width, height } = element.getBoundingClientRect();
      // The still keeps its 720×560 aspect inside the box (preserveAspectRatio="meet").
      const scale = Math.min(width / 720, height / 560);
      const offsetX = (width - 720 * scale) / 2;
      const offsetY = (height - 560 * scale) / 2;
      markers.forEach(({ point }, k) => {
        const p = project(point, DEFAULT_CAMERA, 720, 560);
        const label = labelRefs.current[k];
        if (label)
          label.style.transform = `translate(${(offsetX + p.x * scale).toFixed(1)}px, ${(offsetY + p.y * scale).toFixed(1)}px)`;
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [markers, live]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !webglAvailable()) return;
    let cancelled = false;
    // After first paint, so the page is interactive before three.js is fetched.
    const timer = window.setTimeout(async () => {
      const { mountStage } = await import('../../lib/paretoStage3d');
      if (cancelled) return;
      const labels = markers.map((marker, k) => ({
        element: labelRefs.current[k]!,
        point: marker.point,
      }));
      stage.current = mountStage(
        element,
        {
          pool: scenario.pool,
          front: scenario.front,
          knee: scenario.knee,
          pick,
          cheapest: scenario.picks.greedy,
          palette: readPalette(element),
        },
        labels,
        () => {
          stage.current?.destroy();
          stage.current = null;
          setLive(false);
        }
      );
      if (stage.current) setLive(true);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stage.current?.destroy();
      stage.current = null;
    };
  }, [scenario, pick, markers]);

  useEffect(() => {
    if (host.current) stage.current?.setPalette(readPalette(host.current));
  }, [mode]);

  const drag = useRef<{ x: number; y: number } | null>(null);

  return (
    <figure className="pareto-stage">
      <div
        ref={host}
        className={`pareto-stage-host${live ? ' is-live' : ''}`}
        tabIndex={live ? 0 : undefined}
        role={live ? 'group' : undefined}
        aria-label={live ? e('3D chart. Use the arrow keys or drag to turn it.') : undefined}
        onKeyDown={(event) => {
          const step = Math.PI / 36;
          const turns: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          };
          const turn = turns[event.key];
          if (!turn || !stage.current) return;
          event.preventDefault();
          stage.current.rotateBy(...turn);
        }}
        onPointerDown={(event) => {
          if (!stage.current) return;
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || !stage.current) return;
          stage.current.rotateBy(
            (event.clientX - drag.current.x) * 0.008,
            (event.clientY - drag.current.y) * 0.004
          );
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <ParetoStill scenario={scenario} pick={pick} />
        <div className="pareto-labels" aria-hidden="true">
          {markers.map((marker, k) => (
            <span
              key={marker.key}
              ref={(node) => {
                labelRefs.current[k] = node;
              }}
              className={`pareto-label pareto-label-${marker.kind} pareto-label-${marker.key}`}
            >
              {e(MARKER_TEXT[marker.key])}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="pareto-caption">{caption}</figcaption>
    </figure>
  );
}
