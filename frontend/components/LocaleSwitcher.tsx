import { useState } from 'react';
import { ApiError, saveAccountLocale } from '../lib/authClient';
import { rememberLocale } from '../lib/localePreference';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supportedLocales, type Locale } from '../lib/i18n';

type LocaleSwitcherProps = {
  currentLocale: Locale;
  basePath: string;
};

export default function LocaleSwitcher({ currentLocale, basePath }: LocaleSwitcherProps) {
  const router = useRouter();
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  async function choose(lang: Locale) {
    rememberLocale(lang);
    setSaveError(false);
    setSaving(true);
    try {
      await saveAccountLocale(lang);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setSaveError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--card))]/80 p-1">
      {supportedLocales.map((lang) => (
        <Link
          key={lang}
          aria-disabled={saving}
          onClick={(event) => {
            if (saving) {
              event.preventDefault();
              return;
            }
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            void choose(lang);
          }}
          href={{ pathname: basePath, query: { ...router.query, lang } }}
          className={`rounded-md px-2 py-1 text-xs transition ${
            lang === currentLocale
              ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
              : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
          }`}
        >
          {lang.toUpperCase()}
        </Link>
      ))}
      {saveError && (
        <span role="alert" className="max-w-48 text-xs">
          {currentLocale === 'ru'
            ? 'Язык выбран. Не удалось сохранить его в аккаунте.'
            : currentLocale === 'kk'
              ? 'Тіл таңдалды. Аккаунтқа сақтау мүмкін болмады.'
              : 'Language selected. Could not save it to your account.'}
        </span>
      )}
    </div>
  );
}
