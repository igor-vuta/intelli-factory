import { useRouter } from 'next/router';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { getLocaleFromQuery } from '../lib/i18n';
import { statusLabel } from '../lib/status';

const SIGNERS = [
  ['CUSTOMER', 'Customer'],
  ['FACTORY', 'Factory'],
  ['LOGIST', 'Carrier'],
] as const;

/** Who has signed a contract: a tick per party, with the status spelled out for screen readers. */
export default function SignatureList({
  status,
}: {
  status: Record<(typeof SIGNERS)[number][0], string>;
}) {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  return (
    <ul className="signature-list">
      {SIGNERS.map(([key, name]) => {
        const signed = status[key] === 'SIGNED';
        return (
          <li key={key} data-signed={signed}>
            <span aria-hidden="true">{signed ? '✓' : '○'}</span>
            {e(name)}
            <span className="sr-only">: {statusLabel(locale, status[key])}</span>
          </li>
        );
      })}
    </ul>
  );
}
