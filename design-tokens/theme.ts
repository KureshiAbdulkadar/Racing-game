export interface ThemeColors {
  bg0: string;
  bg1: string;
  accent: string;
  accent2: string;
  track: string;
  grass: string;
  danger: string;
  text: string;
  border: string;
  cardBg: string;
}

export type ThemeName = 'neon-night' | 'sunset-coast' | 'retro-arcade' | 'monochrome';

export const THEMES: Record<ThemeName, { name: string; colors: ThemeColors }> = {
  'neon-night': {
    name: 'Neon Night',
    colors: {
      bg0: '#0A0A14',
      bg1: '#141428',
      accent: '#00E5FF',
      accent2: '#FF00A8',
      track: '#1F2937',
      grass: '#0B3D2E',
      danger: '#FF3860',
      text: '#F5F5FA',
      border: '#2A2A48',
      cardBg: 'rgba(20, 20, 40, 0.85)',
    },
  },
  'sunset-coast': {
    name: 'Sunset Coast',
    colors: {
      bg0: '#1A0F1F',
      bg1: '#2D1A2E',
      accent: '#FF6B35',
      accent2: '#FFB84D',
      track: '#3A2438',
      grass: '#4A2545',
      danger: '#FF3860',
      text: '#FFE8D6',
      border: '#532D54',
      cardBg: 'rgba(45, 26, 46, 0.85)',
    },
  },
  'retro-arcade': {
    name: 'Retro Arcade',
    colors: {
      bg0: '#1D1D1D',
      bg1: '#2A2A2A',
      accent: '#F07C00',
      accent2: '#FFD400',
      track: '#333333',
      grass: '#2E4A2E',
      danger: '#FF3860',
      text: '#F0F0F0',
      border: '#444444',
      cardBg: 'rgba(42, 42, 42, 0.85)',
    },
  },
  'monochrome': {
    name: 'Monochrome Cyber',
    colors: {
      bg0: '#0D1117',
      bg1: '#161B22',
      accent: '#39D353',
      accent2: '#58A6FF',
      track: '#21262D',
      grass: '#1B2C24',
      danger: '#F85149',
      text: '#C9D1D9',
      border: '#30363D',
      cardBg: 'rgba(22, 27, 34, 0.85)',
    },
  },
};

// 32-color classic retro palette for car paint & details
export const PALETTE_32 = [
  '#FFFFFF', '#C0CBDC', '#8B9BB4', '#5A6988', '#3A4466', '#262B44', '#181425', '#000000',
  '#FF0044', '#FF5500', '#FFAA00', '#FFEA00', '#B4FF00', '#00FF44', '#00FFAA', '#00EAFF',
  '#0088FF', '#0022FF', '#7700FF', '#CC00FF', '#FF00AA', '#FF6688', '#FF9988', '#FFCCAA',
  '#994400', '#662200', '#441100', '#224422', '#116633', '#114466', '#223355', '#443355'
];

export function applyTheme(themeName: ThemeName) {
  if (typeof document === 'undefined') return;
  const theme = THEMES[themeName] || THEMES['neon-night'];
  const root = document.documentElement;
  root.style.setProperty('--bg-0', theme.colors.bg0);
  root.style.setProperty('--bg-1', theme.colors.bg1);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--accent-2', theme.colors.accent2);
  root.style.setProperty('--track', theme.colors.track);
  root.style.setProperty('--grass', theme.colors.grass);
  root.style.setProperty('--danger', theme.colors.danger);
  root.style.setProperty('--text', theme.colors.text);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--card-bg', theme.colors.cardBg);
}
