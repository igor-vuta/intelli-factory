import { supportedLocales, type Locale } from './i18n';

export function validLocale(value: unknown): value is Locale {
  return typeof value === 'string' && supportedLocales.includes(value as Locale);
}
export function rememberLocale(locale: Locale) {
  try {
    localStorage.setItem('if-locale', locale);
  } catch {
    /* Storage may be disabled. */
  }
}
export function rememberedLocale(): Locale {
  try {
    const value = localStorage.getItem('if-locale');
    if (validLocale(value)) return value;
  } catch {
    /* The URL still carries the selected language. */
  }
  return 'en';
}
