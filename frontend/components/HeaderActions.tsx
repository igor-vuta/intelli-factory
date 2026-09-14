import Link from 'next/link';
import { useRouter } from 'next/router';
import ThemeSwitcher from './ThemeSwitcher';
import { getLocaleFromQuery, t } from '../lib/i18n';
import type { Theme } from '../styles/themePresets';

type HeaderActionsProps = {
  theme: Theme;
  themeLabel: Record<Theme, string>;
  onThemeChange: (theme: Theme) => void;
};

export default function HeaderActions({ theme, onThemeChange }: HeaderActionsProps) {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <ThemeSwitcher currentTheme={theme} onThemeChange={onThemeChange} />
      <Link href={`/login?lang=${locale}`} className="btn btn-ghost whitespace-nowrap text-sm">
        {copy.login}
      </Link>
      <Link
        href={`/register?lang=${locale}`}
        className="btn btn-primary hidden whitespace-nowrap text-sm sm:inline-flex"
      >
        {copy.createAccount}
      </Link>
    </nav>
  );
}
