import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/router';
import Modal from './Modal';
import SelectField from './SelectField';
import PresetIcon from './PresetIcon';
import { useTheme } from '../hooks/useTheme';
import { THEME_PRESETS } from '../styles/themePresets';
import { getLocaleFromQuery, type Locale } from '../lib/i18n';
import { ApiError, saveAccountLocale } from '../lib/authClient';
import { rememberLocale } from '../lib/localePreference';

const copy = {
  en: {
    welcome: 'Make yourself at home',
    intro: 'Choose your language and the look that feels right for you.',
    settings: 'Profile settings',
    language: 'Language',
    appearance: 'Appearance',
    later: 'You can change these later in Profile settings.',
    continue: 'Continue',
    save: 'Save preferences',
    saving: 'Saving…',
    close: 'Close',
    error: 'Could not save your preferences. Try again.',
    local:
      'Appearance is saved on this browser. Language is also saved to your account when signed in.',
  },
  ru: {
    welcome: 'Настройте под себя',
    intro: 'Выберите язык и оформление, с которым вам удобно работать.',
    settings: 'Настройки профиля',
    language: 'Язык',
    appearance: 'Оформление',
    later: 'Позже это можно изменить в настройках профиля.',
    continue: 'Продолжить',
    save: 'Сохранить настройки',
    saving: 'Сохраняем…',
    close: 'Закрыть',
    error: 'Не удалось сохранить настройки. Попробуйте ещё раз.',
    local: 'Оформление сохраняется в этом браузере. После входа язык также сохраняется в аккаунте.',
  },
  kk: {
    welcome: 'Өзіңізге ыңғайлап алыңыз',
    intro: 'Тілді және өзіңізге ұнайтын безендіруді таңдаңыз.',
    settings: 'Профиль баптаулары',
    language: 'Тіл',
    appearance: 'Безендіру',
    later: 'Кейін бұларды профиль баптауларында өзгерте аласыз.',
    continue: 'Жалғастыру',
    save: 'Баптауларды сақтау',
    saving: 'Сақталуда…',
    close: 'Жабу',
    error: 'Баптаулар сақталмады. Қайталап көріңіз.',
    local: 'Безендіру осы браузерде сақталады. Жүйеге кіргенде тіл аккаунтта да сақталады.',
  },
};
const key = 'if-preferences-configured';
let sessionDone = false;
function done() {
  try {
    return sessionDone || localStorage.getItem(key) === '1';
  } catch {
    return sessionDone;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener('if-preferences-change', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('if-preferences-change', callback);
    window.removeEventListener('storage', callback);
  };
}
function complete() {
  sessionDone = true;
  try {
    localStorage.setItem(key, '1');
  } catch {}
  window.dispatchEvent(new Event('if-preferences-change'));
}

export function PreferencesDialog({
  onClose,
  welcome = false,
}: {
  onClose: () => void;
  welcome?: boolean;
}) {
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const [choice, setChoice] = useState(theme);
  const [language, setLanguage] = useState<Locale>(getLocaleFromQuery(router.query.lang));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const c = copy[language];
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      try {
        await saveAccountLocale(language);
      } catch (cause) {
        if (!(cause instanceof ApiError && cause.status === 401)) throw cause;
      }
      setTheme(choice);
      rememberLocale(language);
      await router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, lang: language },
          hash: window.location.hash,
        },
        undefined,
        { shallow: true }
      );
      complete();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={welcome ? () => undefined : onClose}
      busy={busy}
      className={welcome ? 'preferences-welcome' : ''}
    >
      <section className="preferences-panel" lang={language}>
        <header className="preferences-heading">
          <PresetIcon src="/presets/brand.svg" alt="" size={34} />
          {!welcome && (
            <button type="button" aria-label={c.close} disabled={busy} onClick={onClose}>
              ×
            </button>
          )}
        </header>
        <h2>{welcome ? c.welcome : c.settings}</h2>
        <p>{welcome ? c.intro : c.local}</p>
        <label className="preferences-language">
          {c.language}
          <SelectField
            aria-label={c.language}
            value={language}
            onChange={(event) => setLanguage(event.target.value as Locale)}
            disabled={busy}
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
            <option value="kk">Қазақша</option>
          </SelectField>
        </label>
        <fieldset className="preferences-themes">
          <legend>{c.appearance}</legend>
          <div>
            {THEME_PRESETS.map((preset) => (
              <label
                className={`preference-theme ${choice === preset.id ? 'is-selected' : ''}`}
                key={preset.id}
              >
                <input
                  type="radio"
                  name="appearance-theme"
                  value={preset.id}
                  checked={choice === preset.id}
                  disabled={busy}
                  onChange={() => setChoice(preset.id)}
                />
                <span
                  className="theme-miniature"
                  style={{ background: preset.palette.bg, color: preset.palette.accent }}
                  aria-hidden
                >
                  <i style={{ background: preset.palette.card }} />
                  <span>
                    <b />
                    <b />
                    <em style={{ background: preset.palette.accent }} />
                  </span>
                </span>
                <span className="theme-choice-name">
                  {preset.label}
                  <span aria-hidden>{choice === preset.id ? '✓' : ''}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {welcome && <p className="preferences-later">{c.later}</p>}
        {error && <p role="alert">{c.error}</p>}
        <button
          type="button"
          className="btn btn-primary preferences-save"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? c.saving : welcome ? c.continue : c.save}
        </button>
      </section>
    </Modal>
  );
}
export function WelcomePreferences() {
  const completed = useSyncExternalStore(subscribe, done, () => true);
  return completed ? null : <PreferencesDialog welcome onClose={complete} />;
}
export function ProfileSettingsButton() {
  const router = useRouter();
  const c = copy[getLocaleFromQuery(router.query.lang)];
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="profile-settings-trigger"
        aria-label={c.settings}
        onClick={() => setOpen(true)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
        <span>{c.settings}</span>
      </button>
      {open && <PreferencesDialog onClose={() => setOpen(false)} />}
    </>
  );
}
