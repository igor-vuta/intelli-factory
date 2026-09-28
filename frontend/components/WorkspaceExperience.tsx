import Head from 'next/head';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import GettingStarted from './GettingStarted';
import GuidanceHint from './GuidanceHint';
import { sectionHints } from '../lib/guidance';
import { useEffect, useState, type ReactNode } from 'react';
import Modal from './Modal';
import ReorderableCards from './ReorderableCards';
import Link from 'next/link';
import { useRouter } from 'next/router';
import PresetIcon from './PresetIcon';
import ModeSwitcher from './ModeSwitcher';
import StatusBadge from './StatusBadge';
import LocaleSwitcher from './LocaleSwitcher';
import { getLocaleFromQuery, t } from '../lib/i18n';

type Role = 'customer' | 'factory' | 'logist' | 'admin';
export type WorkItem = {
  id: string;
  title: string;
  status: string;
  detail?: string;
  action?: () => void;
  actionLabel?: string;
  /** Workspace view the card's action opens when it has no custom action. */
  actionView?: string;
  moveToRoad?: () => void;
};
type Props = {
  guidance?: { userId: string; completed: boolean[] };
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
    title: 'Your requests',
    nav: [
      ['home', 'For you'],
      ['requests', 'My requests'],
      ['workflow', 'Orders & delivery'],
    ],
    stats: ['Requests', 'Active orders', 'Completed'],
    primary: 'New request',
    more: ['requests', 'All requests'],
    steps: ['Make a request', 'Compare proposals', 'Sign together', 'Track delivery'],
  },
  factory: {
    name: 'Factory floor',
    title: 'Your factory floor',
    nav: [
      ['home', 'Overview'],
      ['requests', 'Demand board'],
      ['bids', 'My bids'],
      ['inventory', 'Inventory'],
      ['workflow', 'Production'],
    ],
    stats: ['Open requests', 'Inventory lines', 'Active contracts'],
    primary: 'Add inventory',
    more: ['requests', 'Demand board'],
    steps: ['Add stock', 'Bid on requests', 'Sign together', 'Hand to the carrier'],
  },
  logist: {
    name: 'Dispatch',
    title: 'Your deliveries',
    nav: [
      ['home', 'Dispatch board'],
      ['quotes', 'Quote requests'],
      ['workflow', 'Deliveries'],
      ['offers', 'Delivery services'],
    ],
    stats: ['Awaiting quotes', 'Active shipments', 'Delivery services'],
    primary: 'Find your next delivery',
    more: ['quotes', 'Quote requests'],
    steps: ['Quote', 'Collect', 'Deliver', 'Complete'],
  },
  admin: {
    name: 'Control room',
    title: 'Network overview',
    nav: [
      ['home', 'Network overview'],
      ['operations', 'Requests & optimisation'],
    ],
    stats: ['Total requests', 'In matching', 'Completed'],
    primary: 'Compare strategies',
    more: ['operations', 'All requests'],
  },
} as const;

function Arrow() {
  return (
    <span aria-hidden className="experience-arrow">
      ↗
    </span>
  );
}

export default function WorkspaceExperience({
  guidance,
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
  const c = config[role];
  const [navigationOpen, setNavigationOpen] = useState(false);
  const requestedView = router.query.view;
  const view =
    typeof requestedView === 'string' && c.nav.some(([id]) => id === requestedView)
      ? requestedView
      : 'home';
  const sectionName = c.nav.find(([id]) => id === view)?.[1] ?? c.nav[0][1];
  // On narrow screens the section tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.experience-nav').forEach((bar) => {
      const current = bar.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current || bar.scrollWidth <= bar.clientWidth) return;
      bar.scrollLeft = current.offsetLeft - (bar.clientWidth - current.offsetWidth) / 2;
    });
  }, [view]);
  function navigate(next: string, extra: Record<string, string> = {}) {
    setNavigationOpen(false);
    // `add` (open a form) and `focus` (open a record) apply once; never carry them along.
    const { add: _add, focus: _focus, ...rest } = router.query;
    void _add;
    void _focus;
    const query = { ...rest, view: next, ...extra };
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
      : role === 'factory'
        ? navigate('inventory', { add: '1' })
        : navigate(role === 'logist' ? 'quotes' : 'operations');
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
              <StatusBadge status={item.status} />
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
                    item.actionView ??
                      (role === 'customer'
                        ? 'requests'
                        : role === 'factory'
                          ? 'requests'
                          : role === 'logist'
                            ? 'workflow'
                            : 'operations'),
                    // Land on this record, opened.
                    { focus: item.id }
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
    <div className={`experience experience-${role}`}>
      <Head>
        <title>{`${e(sectionName)} · ${e(c.name)} · Intelli-Factory`}</title>
      </Head>
      <a className="skip-link" href="#main">
        {e('Skip to content')}
      </a>
      {role === 'factory' && (
        <aside className="factory-sidebar" aria-label={e('Factory workspace')}>
          <Link href={`/?lang=${locale}`} className="experience-brand">
            <PresetIcon src="/presets/brand.svg" alt="" size={30} />
            <span>
              Intelli<span className="brand-second">Factory</span>
            </span>
          </Link>
          <div className="sidebar-label">{e('WORKSPACE / 02')}</div>
          {nav}
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
            <ModeSwitcher />
            <button type="button" className="experience-logout" onClick={onLogout}>
              {copy.logout}
              <span aria-hidden>↗</span>
            </button>
          </div>
        </header>
        {role !== 'factory' && nav}
        {role === 'factory' && <div className="factory-mobile-nav">{nav}</div>}
        <main id="main" className="experience-main" data-view={view} tabIndex={-1}>
          {view === 'home' && 'more' in c && (
            <section className="overview-head" aria-labelledby="overview-title">
              <div>
                <h1 id="overview-title">{e(c.title)}</h1>
                <p className="overview-counts num">
                  {c.stats
                    .map((text, i) => `${loading ? '—' : (counts[i] ?? 0)} ${e(text)}`)
                    .join(' · ')}
                </p>
              </div>
              <div className="overview-actions">
                <button type="button" className="overview-more" onClick={() => navigate(c.more[0])}>
                  {e(c.more[1])} <Arrow />
                </button>
                <button
                  type="button"
                  className="if-button if-button-primary"
                  disabled={loading}
                  onClick={primary}
                >
                  {e(c.primary)}
                </button>
              </div>
            </section>
          )}
          {role !== 'admin' && !loading && guidance && (
            <GettingStarted
              key={`${role}:${guidance.userId}`}
              role={role}
              userId={guidance.userId}
              completed={guidance.completed}
              onNavigate={navigate}
            />
          )}
          {role !== 'admin' && <GuidanceHint hint={sectionHints[role][view] ?? 'workflow'} />}
          {error && (
            <p role="alert" className="experience-error">
              {error}
            </p>
          )}
          {view === 'home' ? (
            <div className="experience-overview" key="home">
              {role === 'customer' && (
                <>
                  <h2 className="sr-only">{e('Recent requests')}</h2>
                  <section className="customer-order-grid">
                    {cards(items, 'Your next order starts here.')}
                  </section>
                </>
              )}
              {role === 'factory' && (
                <>
                  <h2 className="overview-subhead">
                    {e('Needs your attention')}
                    <span className="num">{loading ? '' : items.length}</span>
                  </h2>
                  <section className="customer-order-grid">
                    {cards(items, 'Nothing needs you right now.')}
                  </section>
                </>
              )}
              {role === 'logist' && (
                <>
                  <h2 className="overview-subhead">{e('Dispatch board')}</h2>
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
                  <div className="control-grid">
                    <section className="control-pipeline">
                      <div className="experience-section-heading">
                        <h2>{e('Requests by stage')}</h2>
                        <span>
                          {counts[0] ?? 0} {e('requests')}
                        </span>
                      </div>
                      {[
                        ['Pending', ['PENDING']],
                        ['Matching', ['PAIRING_IN_PROGRESS', 'PAUSED', 'MATCHED']],
                        [
                          'Execution',
                          [
                            'CONTRACT_DRAFTED',
                            'CONTRACT_SIGNING',
                            'FULLY_SIGNED',
                            'AWAITING_PAYMENT',
                            'PAYMENT_CONFIRMED',
                            'FULFILLMENT_STARTED',
                            'IN_PROGRESS',
                          ],
                        ],
                        ['Completed', ['COMPLETED']],
                        // Every status belongs to exactly one row, so the rows add up to the total.
                        ['Stopped', ['CANCELLED', 'DISPUTED']],
                      ].map(([name, statuses]) => {
                        const total = items.filter((item) =>
                          (statuses as string[]).includes(item.status)
                        ).length;
                        return (
                          <div className="pipeline-row" key={String(name)}>
                            <span>{e(String(name))}</span>
                            <div>
                              <i
                                style={{ width: `${counts[0] ? (total / counts[0]) * 100 : 0}%` }}
                              />
                            </div>
                            <strong>{total}</strong>
                          </div>
                        );
                      })}
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
                        <StatusBadge status={item.status} />
                        <Arrow />
                      </button>
                    ))}
                    {!items.length && <p>{e('No requests yet. New activity will appear here.')}</p>}
                  </section>
                </>
              )}
              {'steps' in c && (
                <section className="journey-strip">
                  <span>{e('THE WAY FORWARD')}</span>
                  {c.steps.map((text, i) => (
                    <div key={text}>
                      <b>0{i + 1}</b>
                      {e(text)}
                      <span aria-hidden>→</span>
                    </div>
                  ))}
                </section>
              )}
            </div>
          ) : null}
          <div key={`detail-${view}`} className="experience-detail" hidden={view === 'home'}>
            <div className="detail-heading">
              <button type="button" onClick={() => navigate('home')}>
                {e('← Overview')}{' '}
              </button>
              <span>{e(c.name)}</span>
            </div>
            {/* Names the view for assistive tech; each page still shows its own visible heading. */}
            {view !== 'home' && <h1 className="sr-only">{e(sectionName)}</h1>}
            {children}
          </div>
        </main>
        <footer className="experience-footer">
          <span>INTELLI–FACTORY</span>
          <span>{e('Connected work. Considered design.')}</span>
          <span>{e(c.name)}</span>
        </footer>
      </div>
    </div>
  );
}
