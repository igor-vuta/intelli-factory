import { useEffect, useRef, useState } from 'react';
import { useColorMode } from '../../hooks/useColorMode';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import type { StoryHandles, StoryPalette } from '../../lib/workflowStory3d';
import StoryProposals from './StoryProposals';

const CHAPTERS = [
  {
    title: 'A customer asks',
    body: 'A buyer describes what they need: the item, the quantity and where it should arrive.',
  },
  {
    title: 'One among thousands',
    body: 'Every customer’s requests flow out at once to many factories. Ours goes only to the factory that makes that product.',
  },
  {
    title: 'The factory answers',
    body: 'The matching factory is notified, bids from its stock and hands the offer to logistics.',
  },
  {
    title: 'The carrier plans the route',
    body: 'A logistics provider traces the route from the factory to the customer and prices the delivery.',
  },
  {
    title: 'Into the engine',
    body: 'Customer, factory and carrier meet, and every complete proposal goes into the optimisation engine.',
  },
  {
    title: 'A list to choose from',
    body: 'The engine weighs cost, delivery time and reliability and returns the proposals with the balanced one marked. The customer makes the final choice.',
  },
] as const;

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function readPalette(element: HTMLElement): StoryPalette {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    bg: token('--if-bg'),
    line: token('--if-line'),
    text: token('--if-text'),
    muted: token('--if-muted'),
    accent: token('--if-accent'),
    surface: token('--if-raised'),
  };
}

type Role = 'customer' | 'factory' | 'logist';
const ROLES: [Role, string][] = [
  ['customer', 'Customer'],
  ['factory', 'Factory'],
  ['logist', 'Carrier'],
];

/** Where the pinned stage sits: below the sticky header (a CSS length in px). */
function pinTop(pin: HTMLElement | null) {
  return pin ? parseFloat(getComputedStyle(pin).top) || 0 : 0;
}

/**
 * The workflow as a scroll-driven story. With motion allowed and WebGL available, a pinned 3D
 * stage plays one chapter at a time as the reader scrolls (and chapter buttons jump to each);
 * nothing plays until the stage is pinned in view. Otherwise the chapters are a list of still
 * frames rendered from the same scene.
 */
export default function WorkflowStory() {
  const e = useExperienceCopy();
  const { mode } = useColorMode();
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<Partial<Record<Role, HTMLElement>>>({});
  const stage = useRef<StoryHandles | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  // A slow device keeps the scroll layout (so the page does not shrink under the reader) and
  // shows the captured still of the current chapter instead of the live scene.
  const [still, setStill] = useState(false);
  const progress = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !webglAvailable()) {
      setLive(false);
      return;
    }
    setLive(true);
  }, []);

  useEffect(() => {
    if (!live || !host.current) return;
    const element = host.current;
    let cancelled = false;
    const lite = window.matchMedia('(max-width: 768px)').matches;
    void import('../../lib/workflowStory3d').then(({ mountStory }) => {
      if (cancelled) return;
      const options = { lite, labels: labels.current };
      const handles = mountStory(element, readPalette(element), options, () => {
        stage.current?.destroy();
        stage.current = null;
        setStill(true);
      });
      if (!handles) return setStill(true);
      // Catch up with anything that happened while the module loaded.
      handles.setProgress(progress.current);
      handles.setPaused(pausedRef.current);
      stage.current = handles;
    });
    return () => {
      cancelled = true;
      stage.current?.destroy();
      stage.current = null;
    };
  }, [live]);

  // Scroll picks the chapter; the scene then plays that chapter to its end. Before the stage is
  // pinned (centred under the header) it rests at the start.
  useEffect(() => {
    if (!live) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = section.current;
      if (!node || !pin.current) return;
      const top = pinTop(pin.current);
      const rect = node.getBoundingClientRect();
      const travel = Math.max(1, rect.height - pin.current.offsetHeight);
      const share = Math.min(1, Math.max(0, (top - rect.top) / travel));
      const index = Math.min(CHAPTERS.length - 1, Math.floor(share * CHAPTERS.length));
      progress.current = rect.top <= top + 1 ? index + 0.999 : 0;
      stage.current?.setProgress(progress.current);
      setChapter(index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [live]);

  useEffect(() => {
    if (host.current) stage.current?.setPalette(readPalette(host.current));
  }, [mode]);

  useEffect(() => {
    pausedRef.current = paused;
    stage.current?.setPaused(paused);
  }, [paused]);

  function jumpTo(index: number) {
    const node = section.current;
    if (!node || !pin.current) return;
    const travel = node.offsetHeight - pin.current.offsetHeight;
    const top = node.getBoundingClientRect().top + window.scrollY - pinTop(pin.current);
    window.scrollTo({ top: top + ((index + 0.5) / CHAPTERS.length) * travel, behavior: 'smooth' });
  }

  if (live === false) {
    return (
      <section className="landing-section story story-static" aria-labelledby="story-title">
        <h2 id="story-title">{e('Follow one request.')}</h2>
        <p className="landing-lead">
          {e('How a request moves through the platform, step by step.')}
        </p>
        <ol className="story-stills">
          {CHAPTERS.map((c, i) => (
            <li key={c.title}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static stills, no optimiser needed */}
              <img
                src={`/story/chapter-${i + 1}-${mode}.webp`}
                alt=""
                width={960}
                height={540}
                loading="lazy"
              />
              <h3>
                <span className="num">{i + 1}</span> {e(c.title)}
              </h3>
              <p>{e(c.body)}</p>
              {i === CHAPTERS.length - 1 && <StoryProposals />}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section ref={section} className="story story-live" aria-labelledby="story-title">
      <div ref={pin} className="story-pin">
        <div className="story-text">
          <h2 id="story-title">{e('Follow one request.')}</h2>
          <ol className="story-chapters">
            {CHAPTERS.map((c, i) => (
              <li key={c.title} className={i === chapter ? 'is-active' : undefined}>
                <h3>
                  <span className="num">{i + 1}</span> {e(c.title)}
                </h3>
                <p>{e(c.body)}</p>
              </li>
            ))}
          </ol>
          <div className="story-controls">
            <nav aria-label={e('Story chapters')} className="story-dots">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.title}
                  type="button"
                  aria-label={`${i + 1}. ${e(c.title)}`}
                  aria-current={i === chapter ? 'step' : undefined}
                  onClick={() => jumpTo(i)}
                >
                  <span className="story-dot" aria-hidden="true" />
                </button>
              ))}
            </nav>
            {!still && (
              <button
                type="button"
                className="story-pause"
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? e('Play motion') : e('Pause motion')}
              </button>
            )}
          </div>
          <p className="story-note">
            {e('The scene is an illustration; the final list is real benchmark data.')}
          </p>
        </div>
        <div ref={host} className="story-stage">
          {!still && (
            // Decorative: the chapter text names each role; the scene only points at them.
            <div className="story-labels" aria-hidden="true">
              {ROLES.map(([role, name]) => (
                <span
                  key={role}
                  ref={(node) => {
                    if (node) labels.current[role] = node;
                  }}
                  className="story-label"
                  data-role={role}
                >
                  {e(name)}
                </span>
              ))}
            </div>
          )}
          {still && (
            // eslint-disable-next-line @next/next/no-img-element -- static stills, no optimiser needed
            <img
              className="story-still"
              src={`/story/chapter-${chapter + 1}-${mode}.webp`}
              alt=""
              width={960}
              height={540}
            />
          )}
          {chapter === CHAPTERS.length - 1 && (
            <StoryProposals className="story-proposals-overlay" />
          )}
        </div>
      </div>
    </section>
  );
}
