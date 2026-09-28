import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { getLocaleFromQuery } from '../lib/i18n';

export default function NotFound() {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  return (
    <>
      <Head>
        <title>{`${e('Page not found')} · Intelli-Factory`}</title>
      </Head>
      <main id="main" className="not-found">
        <p className="not-found-code num">404</p>
        <h1>{e('Page not found')}</h1>
        <p>{e('The address may be mistyped, or the page has moved.')}</p>
        <Link href={`/?lang=${locale}`} className="if-button if-button-primary">
          {e('Back to the home page')}
        </Link>
      </main>
    </>
  );
}
