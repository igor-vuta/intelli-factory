import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { logout, me, type AuthUser } from '../lib/authClient';
import { getLocaleFromQuery, t } from '../lib/i18n';
import { THEME_CLASSES, type Theme } from '../styles/themePresets';

type RoleWorkspaceProps = {
  expectedRole: AuthUser['role'];
};

export default function RoleWorkspace({ expectedRole }: RoleWorkspaceProps) {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const result = await me();

        if (cancelled) {
          return;
        }

        if (result.user.role !== expectedRole) {
          await router.replace(`/login?lang=${locale}`);
          return;
        }

        setUser(result.user);
      } catch {
        if (!cancelled) {
          setError('Unauthorized');
          await router.replace(`/login?lang=${locale}`);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [expectedRole, locale, router]);

  async function handleLogout() {
    await logout();
    await router.push(`/login?lang=${locale}`);
  }

  return (
    <main
      className={`${THEME_CLASSES[theme]} min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))]"
          >
            <Image
              src="/presets/logo.svg"
              alt="Intelli-Factory logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
              unoptimized
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
            <span>{copy.brand}</span>
          </Link>

          <button type="button" onClick={handleLogout} className="btn btn-ghost text-sm">
            {copy.logout}
          </button>
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">{copy.workspaceTitle}</h1>
          {!user && !error && (
            <p className="mt-3 text-[rgb(var(--muted))]">{copy.checkingSession}</p>
          )}
          {user && (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-[rgb(var(--muted))]">{copy.roleLabel}:</span> {user.role}
              </p>
              <p>
                <span className="text-[rgb(var(--muted))]">Email:</span> {user.email}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
