export type Theme = 'midnightCore' | 'telegramBlue' | 'whatsappEmerald' | 'cyberNeon';

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
    id: 'midnightCore',
    label: 'Midnight Core',
    cssClass: 'theme-midnight-core',
    personality: 'Premium, technical, high-trust',
    useCase: 'Default product surfaces and dashboards',
    palette: {
      bg: '#070b14',
      card: '#0e1628',
      accent: '#67a2ff',
      text: '#eef3ff',
      muted: '#a6b5d3',
    },
  },
  {
    id: 'telegramBlue',
    label: 'Telegram Blue',
    cssClass: 'theme-telegram-blue',
    personality: 'Clear, responsive, communication-first',
    useCase: 'Messaging-like real-time status and partner collaboration',
    palette: {
      bg: '#0c1628',
      card: '#17263f',
      accent: '#54a9ff',
      text: '#edf5ff',
      muted: '#9fb8d9',
    },
  },
  {
    id: 'whatsappEmerald',
    label: 'WhatsApp Emerald',
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
    id: 'cyberNeon',
    label: 'Cyber Neon',
    cssClass: 'theme-cyber-neon',
    personality: 'Controlled cyberpunk, energetic but not noisy',
    useCase: 'Hero surfaces and feature spotlights',
    palette: {
      bg: '#140a21',
      card: '#251338',
      accent: '#ff4fd8',
      text: '#f6ebff',
      muted: '#c6addf',
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
