import Link from 'next/link';
import { useRouter } from 'next/router';
import { getLocaleFromQuery, t } from '../lib/i18n';
export default function HeaderActions() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
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
