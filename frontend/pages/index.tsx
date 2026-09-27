import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import GuidanceHint from '../components/GuidanceHint';
import LocaleSwitcher from '../components/LocaleSwitcher';
import ModeSwitcher from '../components/ModeSwitcher';
import Lifecycle from '../components/landing/Lifecycle';
import ParetoStage from '../components/landing/ParetoStage';
import Results from '../components/landing/Results';
import TradeoffExplorer from '../components/landing/TradeoffExplorer';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { benchmark, heroScenario, totalRuns } from '../lib/benchmarkShowcase';
import type { GuidanceKey } from '../lib/guidance';
import { getLocaleFromQuery, t } from '../lib/i18n';

const HEADLINE = {
  en: ['Good work.', 'Better connected.'],
  ru: ['Большие дела.', 'Вместе проще.'],
  kk: ['Үлкен істер.', 'Бірге оңай.'],
} as const;

const ROLES: {
  role: 'CUSTOMER' | 'FACTORY' | 'LOGIST';
  title: 'customersTitle' | 'manufacturersTitle' | 'logisticsTitle';
  hint: GuidanceKey;
  bullets: string[];
}[] = [
  {
    role: 'CUSTOMER',
    title: 'customersTitle',
    hint: 'customerRole',
    bullets: [
      'Describe the goods you need',
      'Compare complete offers side by side',
      'Sign, pay and accept delivery in one place',
    ],
  },
  {
    role: 'FACTORY',
    title: 'manufacturersTitle',
    hint: 'factoryRole',
    bullets: [
      'Publish stock with its specifications',
      'Bid on open requests',
      'Sign contracts and start production',
    ],
  },
  {
    role: 'LOGIST',
    title: 'logisticsTitle',
    hint: 'logistRole',
    bullets: [
      'Set the areas you cover and your prices',
      'Quote on factory bids',
      'Update each shipment as it moves',
    ],
  },
];

function RoleIcon({ role }: { role: (typeof ROLES)[number]['role'] }) {
  const paths = {
    CUSTOMER: 'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4',
    FACTORY: 'M3 21V11l5 3V11l5 3V5h4v16H3Zm4-4h2m3 0h2',
    LOGIST: 'M2 6h11v10H2zM13 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
  };
  return (
    <svg
      className="role-icon"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[role]} />
    </svg>
  );
}

export default function Home() {
  const e = useExperienceCopy();
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);
  const count = new Intl.NumberFormat(locale);
  const pool = heroScenario.pool;
  const pick = pool[heroScenario.picks.fast];
  const cheapest = pool[heroScenario.picks.greedy];
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  });
  const days = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const caption = `${e('Benchmark scenario')} ${heroScenario.id}: ${pool.length} ${e('offers')}, ${heroScenario.front.length} ${e('on the trade-off front')}. ${e('Cheapest')}: ${money.format(cheapest.cost)}, ${days.format(cheapest.days)} ${e('days')}. ${e('Weighted pick')}: ${money.format(pick.cost)}, ${days.format(pick.days)} ${e('days')}.`;

  return (
    <>
      <Head>
        <title>{`Intelli-Factory · ${e('Supply matching that shows its trade-offs')}`}</title>
        <meta name="description" content={copy.landingHeroSubtitle} />
      </Head>
      <div className="landing">
        <a className="skip-link" href="#main">
          {e('Skip to content')}
        </a>
        <header className="landing-header">
          <Link href={`/?lang=${locale}`} className="landing-brand" aria-label={copy.brand}>
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path
                d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7L12 2.5Zm0 0v19M3.5 7 12 11.5 20.5 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span translate="no">{copy.brand}</span>
          </Link>
          <nav className="landing-nav" aria-label={e('Main')}>
            <a href="#how-it-works">{e('How it works')}</a>
            <a href="#tradeoffs">{e('Trade-offs')}</a>
            <a href="#results">{e('Results')}</a>
            <Link href={`/login?lang=${locale}`} className="landing-login">
              {copy.login}
            </Link>
          </nav>
          <div className="landing-tools">
            <LocaleSwitcher currentLocale={locale} basePath="/" />
            <ModeSwitcher />
            <Link href={`/register?lang=${locale}`} className="if-button if-button-primary">
              {copy.createAccount}
            </Link>
          </div>
        </header>

        <main id="main">
          <section className="landing-hero" aria-labelledby="hero-title">
            <div className="landing-hero-text">
              <h1 id="hero-title">
                <span>{HEADLINE[locale][0]}</span> <span>{HEADLINE[locale][1]}</span>
              </h1>
              <p className="landing-hero-lead">
                {e('Find the right supplier and delivery, balancing cost, time and reliability.')}
              </p>
              <div className="landing-actions">
                <Link
                  href={`/register?lang=${locale}`}
                  className="if-button if-button-primary if-button-lg"
                >
                  {copy.createAccount}
                </Link>
                <a href="#tradeoffs" className="if-button if-button-lg">
                  {e('See the trade-offs')}
                </a>
              </div>
              <p className="landing-hero-proof num">
                {count.format(totalRuns)} {e('benchmark runs')} ·{' '}
                {count.format(benchmark.scenarioCount)} {e('scenarios')}
              </p>
              <GuidanceHint hint="landing" />
            </div>
            <ParetoStage scenario={heroScenario} caption={caption} />
          </section>

          <Lifecycle />

          <TradeoffExplorer initial={heroScenario} />

          <section className="landing-section roles" aria-labelledby="roles-title">
            <h2 id="roles-title">{e('One place for three roles.')}</h2>
            <div className="landing-role-grid">
              {ROLES.map(({ role, title, hint, bullets }) => (
                <article key={role} className={`role role-${role.toLowerCase()}`}>
                  <RoleIcon role={role} />
                  <h3>{copy[title]}</h3>
                  <GuidanceHint hint={hint} />
                  <ul>
                    {bullets.map((bullet) => (
                      <li key={bullet}>{e(bullet)}</li>
                    ))}
                  </ul>
                  <Link href={`/register?role=${role}&lang=${locale}`} className="if-link">
                    {copy.createAccount} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <Results />

          <section className="landing-section landing-cta" aria-labelledby="cta-title">
            <h2 id="cta-title">
              <span>{e('Bring your next order.')}</span>{' '}
              <span>{e('See the trade-offs before you choose.')}</span>
            </h2>
            <div className="landing-actions">
              <Link
                href={`/register?lang=${locale}`}
                className="if-button if-button-primary if-button-lg"
              >
                {copy.createAccount}
              </Link>
              <Link href={`/login?lang=${locale}`} className="if-link">
                {copy.login}
              </Link>
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          <p>
            <span translate="no">{copy.brand}</span> ·{' '}
            {e('BSc Computer Science project, De Montfort University')}
          </p>
          <p className="num">
            {e('Figures from')} <code translate="no">benchmark_evaluation.py</code>
          </p>
        </footer>
      </div>
    </>
  );
}
