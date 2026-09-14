import { useCallback } from 'react';
import { useRouter } from 'next/router';
import { getLocaleFromQuery } from '../lib/i18n';
import { experienceText } from '../lib/experienceI18n';

export function useExperienceCopy() {
  const { query } = useRouter();
  const locale = getLocaleFromQuery(query.lang);
  return useCallback((source: string) => experienceText(locale, source), [locale]);
}
