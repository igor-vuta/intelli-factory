import { useRouter } from 'next/router';
import { getLocaleFromQuery } from '../lib/i18n';
import { guidanceText, type GuidanceKey } from '../lib/guidance';

export default function GuidanceHint({ hint, id }: { hint: GuidanceKey; id?: string }) {
  const { query } = useRouter();
  return (
    <p id={id} className="guidance-hint">
      {guidanceText(getLocaleFromQuery(query.lang), hint)}
    </p>
  );
}
