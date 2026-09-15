import { useExperienceCopy } from '../hooks/useExperienceCopy';
import GuidanceHint from '../components/GuidanceHint';
import PresetIcon from '../components/PresetIcon';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import HeaderActions from '../components/HeaderActions';
import LocaleSwitcher from '../components/LocaleSwitcher';
import { useTheme } from '../hooks/useTheme';
import { getLocaleFromQuery, t } from '../lib/i18n';
import { THEME_LABELS } from '../styles/themePresets';

const liveEvents = [
  'Customer request created: Titanium pipes · Almaty',
  'Manufacturer inventory matched: 240 units available',
  'Logistics coverage matched: Almaty route confirmed',
  'Contract package generated for 3 parties',
  'Signatures completed · awaiting payment',
  'Payment confirmed · fulfillment started',
];

export default function Home() {
  const e = useExperienceCopy();
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);
  const [theme, setTheme] = useTheme();

  const roleCards = useMemo(
    () => [
      {
        role: 'CUSTOMER',
        icon: 'customer',
        title: copy.customersTitle,
        subtitle: copy.customersSubtitle,
        bullets: ['Smart request form', 'Live response stream', 'Contract + payment flow'],
      },
      {
        role: 'FACTORY',
        icon: 'factory',
        title: copy.manufacturersTitle,
        subtitle: copy.manufacturersSubtitle,
        bullets: ['Inventory with specs', 'Instant candidate alerts', 'Liability-ready contracts'],
      },
      {
        role: 'LOGIST',
        icon: 'logist',
        title: copy.logisticsTitle,
        subtitle: copy.logisticsSubtitle,
        bullets: [
          'Area and route coverage',
          'Pricing constraints',
          'Signature and execution tracking',
        ],
      },
    ],
    [copy]
  );

  const marqueeEvents = liveEvents;

  return (
    <main
      className={`landing relative min-h-screen overflow-hidden bg-[rgb(var(--bg))] px-4 pb-12 pt-6 text-[rgb(var(--text))] sm:px-8 lg:px-12`}
    >
      <div aria-hidden className="orb orb-1" />
      <div aria-hidden className="orb orb-2" />
      <div aria-hidden className="orb orb-3" />

      <header className="relative z-40 mb-16 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 font-semibold tracking-wide">
          <PresetIcon src="/presets/brand.svg" alt="" size={30} />
          <span>{copy.brand}</span>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher currentLocale={locale} basePath="/" />
          <HeaderActions theme={theme} themeLabel={THEME_LABELS} onThemeChange={setTheme} />
        </div>
      </header>

      <section className="landing-hero relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[rgb(var(--accent))]">
            {e('THE PLACE WHERE SUPPLY MEETS POSSIBILITY')}{' '}
          </p>
          <h1 className="slide-up max-w-[14ch] text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {locale === 'ru'
              ? 'Большие дела. Вместе проще.'
              : locale === 'kk'
                ? 'Үлкен істер. Бірге оңай.'
                : 'Good work. Better connected.'}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[rgb(var(--muted))]">
            {copy.landingHeroSubtitle}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/register?lang=${locale}`}
              className="btn btn-primary btn-lg"
              aria-label={e('Create account now')}
            >
              {copy.createAccount}
            </Link>
            <Link
              href={`/login?lang=${locale}`}
              className="btn btn-ghost btn-lg"
              aria-label={e('Open your dashboard')}
            >
              {copy.openDashboard}
            </Link>
          </div>
          <GuidanceHint hint="landing" />

          <div className="mt-7 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric title={e('<1s')} subtitle={copy.matchingReaction} />
            <Metric title={e('3-party')} subtitle={copy.threePartyWorkflow} />
            <Metric title={e('live')} subtitle={copy.liveStatusStreaming} />
          </div>
        </div>

        <div
          aria-label={e('Example supply journey')}
          className="rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur"
        >
          <div className="mb-3 flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--dot))]" />
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--dot))]" />
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--dot))]" />
            <p className="ml-1 text-[rgb(var(--text))]">{e('A shared journey · Example')}</p>
          </div>

          <div className="h-[240px] overflow-y-auto rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))]">
            <ul className="list-none p-0">
              {marqueeEvents.map((entry, index) => (
                <li
                  key={`${entry}-${index}`}
                  className="border-b border-[rgb(var(--stroke-muted))] px-3 py-3 text-sm text-[rgb(var(--text-soft))]"
                >
                  {e(entry)}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Pill text={e('Request')} active />
            <span className="text-[rgb(var(--muted))]">-</span>
            <Pill text={e('Match')} active />
            <span className="text-[rgb(var(--muted))]">-</span>
            <Pill text={e('Contract')} active />
            <span className="text-[rgb(var(--muted))]">-</span>
            <Pill text={e('Payment')} pulse />
          </div>
        </div>
      </section>

      <section className="landing-role-grid relative z-10 mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {roleCards.map((role) => (
          <article
            key={role.title}
            className="rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-6"
          >
            <PresetIcon
              src={`/presets/${role.icon}.svg`}
              alt=""
              size={28}
              className="mb-5 text-[rgb(var(--accent))]"
            />
            <h3 className="text-xl font-semibold">{role.title}</h3>
            <p className="mt-1 text-[rgb(var(--muted))]">{role.subtitle}</p>
            <GuidanceHint
              hint={
                role.role === 'CUSTOMER'
                  ? 'customerRole'
                  : role.role === 'FACTORY'
                    ? 'factoryRole'
                    : 'logistRole'
              }
            />
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[rgb(var(--text-soft))]">
              {role.bullets.map((bullet) => (
                <li key={bullet}>{e(bullet)}</li>
              ))}
            </ul>
            <Link
              href={`/register?role=${role.role}&lang=${locale}`}
              className="btn btn-ghost mt-5 text-sm"
            >
              {copy.createAccount}
              <span aria-hidden>↗</span>
            </Link>
          </article>
        ))}
      </section>

      <section className="relative z-10 mt-5 rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-4">
        <h2 className="text-xl font-semibold sm:text-2xl">{copy.oneTransactionTitle}</h2>
        <p className="mt-2 max-w-4xl text-[rgb(var(--muted))]">{copy.oneTransactionSubtitle}</p>
      </section>
      <footer className="experience-footer">
        <span>INTELLI–FACTORY</span>
        <span>{e('Source. Make. Move.')}</span>
        <Link href={`/login?lang=${locale}`}>{copy.openDashboard} ↗</Link>
      </footer>
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
