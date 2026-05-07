import Link from 'next/link';
import { supportedLocales, type Locale } from '../lib/i18n';

type LocaleSwitcherProps = {
  currentLocale: Locale;
  basePath: string;
};

export default function LocaleSwitcher({ currentLocale, basePath }: LocaleSwitcherProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--card))]/80 p-1">
      {supportedLocales.map((lang) => (
        <Link
          key={lang}
          href={`${basePath}?lang=${lang}`}
          className={`rounded-md px-2 py-1 text-xs transition ${
            lang === currentLocale
              ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
              : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
          }`}
        >
          {lang.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
