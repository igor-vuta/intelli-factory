export type Theme = 'modernLight' | 'modernDark' | 'whatsappEmerald';

export type ThemePreset = {
  id: Theme;
  label: string;
  cssClass: string;
  personality: string;
  useCase: string;
  palette: {
    bg: string;
    card: string;
    accent: string;
    text: string;
    muted: string;
  };
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'whatsappEmerald',
    label: 'Grove',
    cssClass: 'theme-whatsapp-emerald',
    personality: 'Trustworthy, conversational, operationally calm',
    useCase: 'Operational workflows and action-heavy forms',
    palette: {
      bg: '#071916',
      card: '#0f2a25',
      accent: '#45cf95',
      text: '#eafff6',
      muted: '#99cdbb',
    },
  },
  {
    id: 'modernLight',
    label: 'Pearl',
    cssClass: 'theme-modern-light',
    personality: 'Clean, minimal, professional - Vercel/Linear style',
    useCase: 'Light mode dashboards and professional surfaces',
    palette: {
      bg: '#fafafc',
      card: '#ffffff',
      accent: '#2563eb',
      text: '#0f172a',
      muted: '#51627a',
    },
  },
  {
    id: 'modernDark',
    label: 'Midnight',
    cssClass: 'theme-modern-dark',
    personality: 'Deep charcoal with vibrant blue/purple - premium dark mode',
    useCase: 'Default premium app surfaces and dashboards',
    palette: {
      bg: '#0f172a',
      card: '#1e293b',
      accent: '#60a5fa',
      text: '#f8fafc',
      muted: '#94a3b8',
    },
  },
];

export const THEME_LABELS: Record<Theme, string> = THEME_PRESETS.reduce(
  (result, preset) => {
    result[preset.id] = preset.label;
    return result;
  },
  {} as Record<Theme, string>
);

export const THEME_CLASSES: Record<Theme, string> = THEME_PRESETS.reduce(
  (result, preset) => {
    result[preset.id] = preset.cssClass;
    return result;
  },
  {} as Record<Theme, string>
);

export function resolveTheme(stored: string | null): Theme {
  if (stored === 'modernLight' || stored === 'whatsappEmerald') return stored;
  return 'modernDark';
}
