import { useRouter } from 'next/router';
import { getLocaleFromQuery } from '../lib/i18n';
import { statusLabel, statusTone } from '../lib/status';

/** A lifecycle status as a readable, translated chip. Colour is never the only signal. */
export default function StatusBadge({ status }: { status: string }) {
  const locale = getLocaleFromQuery(useRouter().query.lang);
  return (
    <span className={`status-badge status-badge-${statusTone(status)}`} data-status={status}>
      <span className="status-badge-dot" aria-hidden="true" />
      {statusLabel(locale, status)}
    </span>
  );
}
