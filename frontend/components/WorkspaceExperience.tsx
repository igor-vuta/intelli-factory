import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { useState, type ReactNode } from 'react';
import Modal from './Modal';
import ReorderableCards from './ReorderableCards';
import Link from 'next/link';
import { useRouter } from 'next/router';
import PresetIcon from './PresetIcon';
import ThemeSwitcher from './ThemeSwitcher';
import LocaleSwitcher from './LocaleSwitcher';
import { useTheme } from '../hooks/useTheme';
import { getLocaleFromQuery, t } from '../lib/i18n';

type Role = 'customer' | 'factory' | 'logist' | 'admin';
export type WorkItem = {
  id: string;
  title: string;
  status: string;
  detail?: string;
  action?: () => void;
  actionLabel?: string;
  moveToRoad?: () => void;
};
type Props = {
  role: Role;
  children: ReactNode;
  loading: boolean;
  error?: string | null;
  items: WorkItem[];
  counts: number[];
  onLogout: () => void;
  onCreate?: () => void;
};
const config = {
  customer: {
    name: 'Purchasing studio',
    eyebrow: 'YOUR NEXT POSSIBILITY',
    title: 'Good things,\nset in motion.',
    description: 'Find the right supply. Choose your partners. Follow every step.',
    nav: [
      ['home', 'For you'],
      ['requests', 'My requests'],
      ['workflow', 'Orders & delivery'],
    ],
    stats: ['Requests', 'Active orders', 'Completed'],
    primary: 'New Request',
  },
  factory: {
    name: 'Factory floor',
    eyebrow: 'PRODUCTION WORKSPACE',
    title: 'Make room\nfor what’s next.',
    description: 'Turn available stock into your next order.',
    nav: [
      ['home', 'Overview'],
      ['requests', 'Demand board'],
      ['bids', 'My bids'],
      ['inventory', 'Inventory'],
      ['workflow', 'Production'],
    ],
    stats: ['Open requests', 'Inventory lines', 'Active contracts'],
    primary: 'Manage inventory',
  },
  logist: {
    name: 'Dispatch',
    eyebrow: 'LOGISTICS OPERATIONS',
    title: 'Every move.\nIn your hands.',
    description: 'From the first quote to the final handover.',
    nav: [
      ['home', 'Dispatch board'],
      ['quotes', 'Quote requests'],
      ['workflow', 'Deliveries'],
      ['offers', 'Delivery services'],
    ],
    stats: ['Awaiting quotes', 'Active shipments', 'Delivery services'],
    primary: 'Review quotes',
  },
  admin: {
    name: 'Control room',
    eyebrow: 'NETWORK INTELLIGENCE',
    title: 'The whole picture.\nA clearer decision.',
    description: 'Understand the pipeline. Compare outcomes. Move the network forward.',
    nav: [
      ['home', 'Network overview'],
      ['operations', 'Requests & optimisation'],
    ],
    stats: ['Total requests', 'In matching', 'Completed'],
    primary: 'Open optimisation',
  },
} as const;

function label(status: string) {
  return status.toLowerCase().replace(/_/g, ' ');
}
function Arrow() {
  return (
    <span aria-hidden className="experience-arrow">
      ↗
    </span>
  );
}

export default function WorkspaceExperience({
  role,
  children,
  loading,
  error,
  items,
  counts,
  onLogout,
  onCreate,
}: Props) {
  const e = useExperienceCopy();
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);
  const [theme, setTheme] = useTheme();
  const c = config[role];
  const [navigationOpen, setNavigationOpen] = useState(false);
  const requestedView = router.query.view;
  const view =
    typeof requestedView === 'string' && c.nav.some(([id]) => id === requestedView)
      ? requestedView
      : 'home';
  function navigate(next: string) {
    setNavigationOpen(false);
    const query = { ...router.query, view: next };
    void router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
  const primary = () =>
    role === 'customer'
      ? onCreate?.()
      : navigate(role === 'factory' ? 'inventory' : role === 'logist' ? 'quotes' : 'operations');
  const nav = (
    <nav aria-label={e('Workspace sections')} className="experience-nav">
      {c.nav.map(([id, text], index) => (
        <button
          key={id}
          type="button"
          aria-current={view === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          <span className="nav-index">0{index + 1}</span>
          <span>{e(text)}</span>
          <span className="nav-indicator" aria-hidden>
            ↗
          </span>
        </button>
      ))}
    </nav>
  );
  const cards = (list: WorkItem[], empty: string) =>
    loading ? (
      <p className="workspace-loading" role="status">
        {e('Loading your workspace…')}{' '}
      </p>
    ) : list.length ? (
      <ReorderableCards
        storageKey={`workspace-order:${role}:${empty}`}
        items={list.slice(0, 6)}
        onExternalDrop={(item, x, y) => {
          const lane = document.elementFromPoint(x, y)?.closest('[data-delivery-lane]');
          if (lane?.getAttribute('data-delivery-lane') === '1') item.moveToRoad?.();
        }}
        render={(item, index) => (
          <article
            className="work-card"
            key={item.id}
            style={{ '--order': index } as React.CSSProperties}
          >
            <div className="work-card-top">
              <span className={`status-dot status-${item.status.toLowerCase()}`} />{' '}
              <span>{locale === 'en' ? label(item.status) : e(item.status)}</span>
              <span className="work-reference">{item.id.slice(0, 6)}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.detail || e('Your next step is ready in the workspace.')}</p>
            <button
              type="button"
              className="work-card-action"
              onClick={
                item.action ??
                (() =>
                  navigate(
                    role === 'customer'
                      ? 'requests'
                      : role === 'factory'
                        ? 'requests'
                        : role === 'logist'
                          ? 'workflow'
                          : 'operations'
                  ))
              }
            >
              {e(item.actionLabel ?? 'Open details')}
              <Arrow />
            </button>
          </article>
        )}
      />
    ) : (
      <div className="experience-empty">
        <PresetIcon src={`/presets/${role}.svg`} alt="" size={42} />
        <h3>{e(empty)}</h3>
        <p>{e('Everything you need will appear here as work moves forward.')}</p>
        <button type="button" className="experience-primary" onClick={primary}>
          {e(c.primary)}
          <Arrow />
        </button>
      </div>
    );
  return (
    <main className={`experience experience-${role}`} data-view={view}>
      {role === 'factory' && (
        <aside className="factory-sidebar">
          <Link href={`/?lang=${locale}`} className="experience-brand">
            <PresetIcon src="/presets/brand.svg" alt="" size={30} />
            <span>
              Intelli<span className="brand-second">Factory</span>
            </span>
          </Link>
          <div className="sidebar-label">{e('WORKSPACE / 02')}</div>
          {nav}
          <div className="sidebar-foot">
            <div className="sidebar-orbit" aria-hidden />
            <strong>{e('Built to make.')}</strong>
            <p>{e('Your supply, connected to demand.')}</p>
            <span>{e('FACTORY EDITION')}</span>
          </div>
        </aside>
      )}
      {navigationOpen && (
        <Modal side="left" onClose={() => setNavigationOpen(false)}>
          <section className="navigation-sheet">
            <div className="sheet-title">
              <PresetIcon src={`/presets/${role}.svg`} alt="" size={32} />
              <h2>{e(c.name)}</h2>
              <button
                type="button"
                aria-label={e('Close')}
                onClick={() => setNavigationOpen(false)}
              >
                ×
              </button>
            </div>
            {nav}
          </section>
        </Modal>
      )}
      <div className="experience-body">
        <header className="experience-header">
          <button
            type="button"
            className="workspace-menu"
            aria-label={e('Workspace sections')}
            aria-expanded={navigationOpen}
            onClick={() => setNavigationOpen(true)}
          >
            <span aria-hidden>☰</span>
          </button>
          <Link href={`/?lang=${locale}`} className="experience-brand">
            <PresetIcon src="/presets/brand.svg" alt="" size={28} />
            <span>Intelli-Factory</span>
            <span className="edition">{e(c.name)}</span>
          </Link>
          <div className="experience-settings">
            <LocaleSwitcher currentLocale={locale} basePath={`/app/${role}`} />
            <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} compact />
            <button type="button" className="experience-logout" onClick={onLogout}>
              {copy.logout}
              <span aria-hidden>↗</span>
            </button>
          </div>
        </header>
        {role !== 'factory' && nav}
        {role === 'factory' && <div className="factory-mobile-nav">{nav}</div>}
        {error && (
          <p role="alert" className="experience-error">
            {error}
          </p>
        )}
        {view === 'home' ? (
          <div className="experience-overview" key="home">
            {role === 'customer' && (
              <>
                <section className="customer-hero">
                  <div>
                    <p className="experience-eyebrow">{e(c.eyebrow)}</p>
                    <h1>{e(c.title)}</h1>
                    <p className="hero-description">{e(c.description)}</p>
                    <button
                      type="button"
                      className="experience-primary"
                      disabled={loading}
                      onClick={primary}
                    >
                      {e('Start a new request')} <Arrow />
                    </button>
                    <div className="customer-proof">
                      <span className="proof-circles" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>{e('One request. Three partners. One clear journey.')}</span>
                    </div>
                  </div>
                  <div className="supply-sculpture" aria-hidden>
                    <span className="sculpture-orbit orbit-a" />
                    <span className="sculpture-orbit orbit-b" />
                    <div className="sculpture-core">
                      <PresetIcon src="/presets/brand.svg" alt="" size={100} />
                    </div>
                    <span className="sculpture-label sculpture-one">{e('01 / Your idea')}</span>
                    <span className="sculpture-label sculpture-two">
                      {e('02 / The right match')}
                    </span>
                    <span className="sculpture-label sculpture-three">{e('03 / Delivered')}</span>
                  </div>
                </section>
                <section className="customer-summary">
                  {c.stats.map((text, i) => (
                    <div key={e(text)}>
                      <strong>{loading ? '—' : (counts[i] ?? 0)}</strong>
                      <span>{e(text)}</span>
                    </div>
                  ))}
                  <p>
                    {e('Less chasing.')} <br />
                    <strong>{e('More moving forward.')}</strong>
                  </p>
                </section>
                <div className="experience-section-heading">
                  <div>
                    <p className="experience-eyebrow">{e('MADE FOR YOUR NEXT STEP')}</p>
                    <h2>{e('Your supply, in progress')}</h2>
                  </div>
                  <button type="button" onClick={() => navigate('requests')}>
                    {e('All requests')} <Arrow />
                  </button>
                </div>
                <section className="customer-order-grid">
                  {cards(items, 'Your next order starts here.')}
                </section>
                <section className="journey-strip">
                  <span>{e('THE WAY FORWARD')}</span>
                  {['Make a request', 'Compare proposals', 'Sign together', 'Track delivery'].map(
                    (text, i) => (
                      <div key={e(text)}>
                        <b>0{i + 1}</b>
                        {e(text)}
                        <span aria-hidden>→</span>
                      </div>
                    )
                  )}
                </section>
              </>
            )}
            {role === 'factory' && (
              <>
                <section className="factory-intro">
                  <div>
                    <p className="experience-eyebrow">{e(c.eyebrow)}</p>
                    <h1>{e(c.title)}</h1>
                    <p className="hero-description">{e(c.description)}</p>
                  </div>
                  <button type="button" className="experience-primary" onClick={primary}>
                    {e('＋ Add inventory')} <Arrow />
                  </button>
                </section>
                <section className="factory-counters">
                  {c.stats.map((text, i) => (
                    <button
                      type="button"
                      key={e(text)}
                      onClick={() => navigate(['requests', 'inventory', 'workflow'][i])}
                    >
                      <span>
                        {e(text)}
                        <Arrow />
                      </span>
                      <strong>
                        {loading ? '—' : (counts[i] ?? 0)}
                        <small>{e(['opportunities', 'stock lines', 'in progress'][i])}</small>
                      </strong>
                      <div className="counter-track">
                        <i style={{ width: '100%' }} />
                      </div>
                    </button>
                  ))}
                </section>
                <div className="factory-work-grid">
                  <section>
                    <div className="experience-section-heading">
                      <div>
                        <p className="experience-eyebrow">{e('DEMAND SIGNAL')}</p>
                        <h2>{e('Ready for your expertise')}</h2>
                      </div>
                      <button type="button" onClick={() => navigate('requests')}>
                        {e('View board')} <Arrow />
                      </button>
                    </div>
                    <div className="factory-demand-list">
                      {cards(items, 'Your next opportunity is on its way.')}
                    </div>
                  </section>
                  <aside className="factory-capacity">
                    <span className="experience-eyebrow">{e('YOUR PRODUCTION CYCLE')}</span>
                    <div className="machine-drawing" aria-hidden>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <h2>
                      {e('Stock.')} <br />
                      {e('Bid.')} <br />
                      {e('Build.')}{' '}
                    </h2>
                    <p>{e('A focused workspace for turning inventory into confirmed orders.')}</p>
                    <button type="button" onClick={() => navigate('bids')}>
                      {e('Review your bids')} <Arrow />
                    </button>
                    <div className="factory-cycle">
                      <span>{e('01 Inventory')}</span>
                      <span>{e('02 Proposal')}</span>
                      <span>{e('03 Handover')}</span>
                    </div>
                  </aside>
                </div>
              </>
            )}
            {role === 'logist' && (
              <>
                <section className="dispatch-heading">
                  <div>
                    <p className="experience-eyebrow">{e(c.eyebrow)}</p>
                    <h1>{e(c.title)}</h1>
                  </div>
                  <div className="dispatch-counter">
                    <strong>{loading ? '—' : (counts[1] ?? 0)}</strong>
                    <span>{e('active shipments')}</span>
                  </div>
                </section>
                <section className="dispatch-route">
                  <div className="route-caption">
                    <span>{e('THE DELIVERY JOURNEY')}</span>
                    <span>{e('FACTORY → CUSTOMER')}</span>
                  </div>
                  <div className="route-line" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="route-stops">
                    <div>
                      <b>01</b>
                      <strong>{e('Quote')}</strong>
                      <span>{e('Set the terms')}</span>
                    </div>
                    <div>
                      <b>02</b>
                      <strong>{e('Collect')}</strong>
                      <span>{e('Factory handover')}</span>
                    </div>
                    <div>
                      <b>03</b>
                      <strong>{e('Deliver')}</strong>
                      <span>{e('Keep it moving')}</span>
                    </div>
                    <div>
                      <b>04</b>
                      <strong>{e('Complete')}</strong>
                      <span>{e('Customer acceptance')}</span>
                    </div>
                  </div>
                  <button type="button" className="experience-primary" onClick={primary}>
                    {e('Find your next delivery')} <Arrow />
                  </button>
                </section>
                <section className="dispatch-toolbar">
                  <h2>{e('Dispatch board')}</h2>
                  <div>
                    <button type="button" onClick={() => navigate('quotes')}>
                      {e('Quote requests')} <b>{counts[0] ?? 0}</b>
                    </button>
                    <button type="button" onClick={() => navigate('offers')}>
                      {e('Delivery services')} <b>{counts[2] ?? 0}</b>
                    </button>
                  </div>
                </section>
                <section className="dispatch-lanes">
                  {[
                    [
                      'Before departure',
                      [
                        'PAYMENT_CONFIRMED',
                        'FULLY_SIGNED',
                        'AWAITING_PAYMENT',
                        'CONTRACT_SIGNING',
                        'CONTRACT_DRAFTED',
                      ],
                    ],
                    ['On the road', ['FULFILLMENT_STARTED', 'IN_PROGRESS']],
                    ['Delivered', ['COMPLETED']],
                  ].map(([name, statuses], i) => (
                    <div
                      data-delivery-lane={i}
                      className={`dispatch-lane lane-${i}`}
                      key={String(name)}
                    >
                      <div className="lane-heading">
                        <span className="status-dot" />
                        <h3>{e(String(name))}</h3>
                        <b>
                          {
                            items.filter((item) => (statuses as string[]).includes(item.status))
                              .length
                          }
                        </b>
                      </div>
                      {cards(
                        items.filter((item) => (statuses as string[]).includes(item.status)),
                        i === 0
                          ? 'Ready when you are.'
                          : i === 1
                            ? 'A clear road ahead.'
                            : 'The final stop.'
                      )}
                    </div>
                  ))}
                </section>
              </>
            )}
            {role === 'admin' && (
              <>
                <section className="control-intro">
                  <div>
                    <p className="experience-eyebrow">{e(c.eyebrow)}</p>
                    <h1>{e(c.title)}</h1>
                    <p className="hero-description">{e(c.description)}</p>
                  </div>
                  <div className="control-emblem" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <PresetIcon src="/presets/admin.svg" alt="" size={52} />
                  </div>
                </section>
                <section className="control-metrics">
                  {c.stats.map((text, i) => (
                    <div key={e(text)}>
                      <span>
                        0{i + 1} / {e(text)}
                      </span>
                      <strong>{loading ? '—' : (counts[i] ?? 0)}</strong>
                      <div className="metric-bars" aria-hidden>
                        {Array.from({ length: 18 }, (_, n) => (
                          <i key={n} style={{ height: '3px' }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
                <div className="control-grid">
                  <section className="control-pipeline">
                    <div className="experience-section-heading">
                      <div>
                        <p className="experience-eyebrow">{e('REQUEST DISTRIBUTION')}</p>
                        <h2>{e('Inside the network')}</h2>
                      </div>
                      <span>
                        {counts[0] ?? 0} {e('requests')}
                      </span>
                    </div>
                    {[
                      ['Pending', ['PENDING']],
                      ['Matching', ['PAIRING_IN_PROGRESS', 'MATCHED']],
                      [
                        'Execution',
                        [
                          'CONTRACT_SIGNING',
                          'FULLY_SIGNED',
                          'AWAITING_PAYMENT',
                          'PAYMENT_CONFIRMED',
                          'FULFILLMENT_STARTED',
                          'IN_PROGRESS',
                        ],
                      ],
                      ['Completed', ['COMPLETED']],
                    ].map(([name, statuses]) => {
                      const total = items.filter((item) =>
                        (statuses as string[]).includes(item.status)
                      ).length;
                      return (
                        <div className="pipeline-row" key={String(name)}>
                          <span>{e(String(name))}</span>
                          <div>
                            <i style={{ width: `${counts[0] ? (total / counts[0]) * 100 : 0}%` }} />
                          </div>
                          <strong>{total}</strong>
                        </div>
                      );
                    })}
                  </section>
                  <section className="control-optimizer">
                    <span className="experience-eyebrow">{e('DECISION ENGINE')}</span>
                    <div className="optimizer-nodes" aria-hidden>
                      <i>01</i>
                      <i>02</i>
                      <i>03</i>
                    </div>
                    <h2>
                      {e('One pool.')} <br />
                      {e('Three perspectives.')}{' '}
                    </h2>
                    <p>{e('Compare Greedy, Fast and Deep strategies against the same request.')}</p>
                    <button type="button" className="experience-primary" onClick={primary}>
                      {e('Explore optimisation')} <Arrow />
                    </button>
                  </section>
                </div>
                <div className="experience-section-heading">
                  <h2>{e('Latest activity in the pipeline')}</h2>
                  <button type="button" onClick={() => navigate('operations')}>
                    {e('Open operations')} <Arrow />
                  </button>
                </div>
                <section className="control-activity">
                  {items.slice(0, 5).map((item, i) => (
                    <button type="button" key={item.id} onClick={() => navigate('operations')}>
                      <span className="activity-number">0{i + 1}</span>
                      <strong>{item.title}</strong>
                      <span>{locale === 'en' ? label(item.status) : e(item.status)}</span>
                      <Arrow />
                    </button>
                  ))}
                  {!items.length && <p>{e('No requests yet. New activity will appear here.')}</p>}
                </section>
              </>
            )}
          </div>
        ) : null}
        <div key={`detail-${view}`} className="experience-detail" hidden={view === 'home'}>
          <div className="detail-heading">
            <button type="button" onClick={() => navigate('home')}>
              {e('← Overview')}{' '}
            </button>
            <span>
              {e(c.name)} / {e(c.nav.find(([id]) => id === view)?.[1] ?? '')}
            </span>
          </div>
          {children}
        </div>
        <footer className="experience-footer">
          <span>INTELLI–FACTORY</span>
          <span>{e('Connected work. Considered design.')}</span>
          <span>{e(c.name)}</span>
        </footer>
      </div>
    </main>
  );
}
