import Link from 'next/link';
import { useMemo, useState } from 'react';
import HeaderActions from '../components/HeaderActions';
import { THEME_CLASSES, THEME_LABELS, type Theme } from '../styles/themePresets';

const liveEvents = [
  'Customer request created: Titanium pipes · Almaty',
  'Manufacturer inventory matched: 240 units available',
  'Logistics coverage matched: Almaty route confirmed',
  'Contract package generated for 3 parties',
  'Signatures completed · awaiting payment',
  'Payment confirmed · fulfillment started',
];

const roleCards = [
  {
    title: 'Customers',
    subtitle: 'Create requests. Track outcomes in real-time.',
    bullets: ['Smart request form', 'Live response stream', 'Contract + payment flow'],
  },
  {
    title: 'Manufacturers',
    subtitle: 'Publish inventory once. Get matched automatically.',
    bullets: ['Inventory with specs', 'Instant candidate alerts', 'Liability-ready contracts'],
  },
  {
    title: 'Logistics',
    subtitle: 'Set coverage and pricing. Join feasible deals.',
    bullets: ['Area and route coverage', 'Pricing constraints', 'Signature and execution tracking'],
  },
];

export default function Home() {
  const [theme, setTheme] = useState<Theme>('midnightCore');

  const marqueeEvents = useMemo(() => liveEvents.concat(liveEvents), []);

  return (
    <main
      className={`${THEME_CLASSES[theme]} relative min-h-screen overflow-hidden bg-[rgb(var(--bg))] px-4 pb-12 pt-6 text-[rgb(var(--text))] sm:px-8 lg:px-12`}
    >
      <div aria-hidden className="orb orb-1" />
      <div aria-hidden className="orb orb-2" />
      <div aria-hidden className="orb orb-3" />

      <header className="relative z-40 mb-10 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 font-semibold tracking-wide">
          <span aria-hidden className="text-[rgb(var(--accent))]">
            ◉
          </span>
          <span>Intelli-Factory</span>
        </div>

        <HeaderActions theme={theme} themeLabel={THEME_LABELS} onThemeChange={setTheme} />
      </header>

      <section className="relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[rgb(var(--accent))]">
            Supply Chain Orchestration
          </p>
          <h1 className="max-w-[14ch] text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Every request finds its best path—fast, accurate, and live.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[rgb(var(--muted))]">
            Intelli-Factory connects customers, manufacturers, and logistics in one real-time
            execution loop with contract and payment gates built in.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="btn btn-primary btn-lg"
              aria-label="Create account now"
            >
              Create account
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg" aria-label="Open your dashboard">
              Open dashboard
            </Link>
          </div>

          <div className="mt-7 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric title="<1s" subtitle="matching reaction" />
            <Metric title="3-party" subtitle="contract workflow" />
            <Metric title="live" subtitle="status streaming" />
          </div>
        </div>

        <div
          aria-label="Live execution preview"
          className="rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.28)] backdrop-blur"
        >
          <div className="mb-3 flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--dot))]" />
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--dot))]" />
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--dot))]" />
            <p className="ml-1 text-[rgb(var(--text))]">Live Flow Monitor</p>
          </div>

          <div className="h-[186px] overflow-hidden rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))]">
            <ul className="ticker list-none p-0">
              {marqueeEvents.map((entry, index) => (
                <li
                  key={`${entry}-${index}`}
                  className="border-b border-[rgb(var(--stroke-muted))] px-3 py-3 text-sm text-[rgb(var(--text-soft))]"
                >
                  {entry}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Pill text="Request" active />
            <span className="text-[rgb(var(--muted))]">→</span>
            <Pill text="Match" active />
            <span className="text-[rgb(var(--muted))]">→</span>
            <Pill text="Contract" active />
            <span className="text-[rgb(var(--muted))]">→</span>
            <Pill text="Payment" pulse />
          </div>
        </div>
      </section>

      <section className="relative z-10 mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {roleCards.map((role) => (
          <article
            key={role.title}
            className="rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-4 transition-transform hover:-translate-y-0.5"
          >
            <h3 className="text-xl font-semibold">{role.title}</h3>
            <p className="mt-1 text-[rgb(var(--muted))]">{role.subtitle}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[rgb(var(--text-soft))]">
              {role.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="relative z-10 mt-5 rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-4">
        <h2 className="text-xl font-semibold sm:text-2xl">
          One transaction, one synchronized timeline.
        </h2>
        <p className="mt-2 max-w-4xl text-[rgb(var(--muted))]">
          Requests and listings enter as pending entities, then become active as soon as category,
          item details, and region coverage align.
        </p>
      </section>
    </main>
  );
}

function Metric({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-3">
      <strong className="block text-base">{title}</strong>
      <span className="text-sm text-[rgb(var(--muted))]">{subtitle}</span>
    </div>
  );
}

function Pill({ text, active, pulse }: { text: string; active?: boolean; pulse?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        active
          ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
          : 'border-[rgb(var(--stroke))] bg-[rgb(var(--card))] text-[rgb(var(--text-soft))]'
      } ${pulse ? 'pulse' : ''}`}
    >
      {text}
    </span>
  );
}
