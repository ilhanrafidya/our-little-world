export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export type ThemeOverride = 'auto' | Phase;

export interface ThemeTokens {
  phase: Phase;
  label: string;
  icon: string;
  /** gradient langit di belakang globe */
  sky: string;
  /** opasitas bintang 0–1 */
  stars: number;
  accent: string;
  accentRgb: string;
  accent2: string;
  wish: string;
  wishRgb: string;
  atmosphere: string;
  arc: [string, string];
  tiles: 'voyager' | 'dark';
  panel: string;
}

export const THEMES: Record<Phase, ThemeTokens> = {
  dawn: {
    phase: 'dawn',
    label: 'Dawn',
    icon: '🌅',
    sky: 'linear-gradient(180deg,#1d1b45 0%,#5b3a6e 55%,#e48f7a 100%)',
    stars: 0.35,
    accent: '#ff8fa3',
    accentRgb: '255,143,163',
    accent2: '#ffcf99',
    wish: '#b9a6ff',
    wishRgb: '185,166,255',
    atmosphere: '#ffc9a8',
    arc: ['#ff8fa3', '#ffcf99'],
    tiles: 'voyager',
    panel: 'rgba(29,27,69,0.55)',
  },
  day: {
    phase: 'day',
    label: 'Day',
    icon: '☀️',
    sky: 'linear-gradient(180deg,#06162e 0%,#0f3266 55%,#2f6fb3 100%)',
    stars: 0.12,
    accent: '#ff5c8a',
    accentRgb: '255,92,138',
    accent2: '#ffb36b',
    wish: '#a89bff',
    wishRgb: '168,155,255',
    atmosphere: '#9fd3ff',
    arc: ['#ff5c8a', '#ffb36b'],
    tiles: 'voyager',
    panel: 'rgba(6,22,46,0.55)',
  },
  dusk: {
    phase: 'dusk',
    label: 'Dusk',
    icon: '🌇',
    sky: 'linear-gradient(180deg,#140c2e 0%,#3d1a4a 50%,#b5486a 100%)',
    stars: 0.55,
    accent: '#ff7a7a',
    accentRgb: '255,122,122',
    accent2: '#ffb86b',
    wish: '#c4b5fd',
    wishRgb: '196,181,253',
    atmosphere: '#ff9a76',
    arc: ['#ff7a7a', '#ffb86b'],
    tiles: 'voyager',
    panel: 'rgba(20,12,46,0.55)',
  },
  night: {
    phase: 'night',
    label: 'Night',
    icon: '🌙',
    sky: 'linear-gradient(180deg,#070716 0%,#0d0d24 55%,#17173a 100%)',
    stars: 1,
    accent: '#ff7a9c',
    accentRgb: '255,122,156',
    accent2: '#ffd3b0',
    wish: '#c4b5fd',
    wishRgb: '196,181,253',
    atmosphere: '#ff7a9c',
    arc: ['#ff7a9c', '#ffd3b0'],
    tiles: 'dark',
    panel: 'rgba(7,7,22,0.55)',
  },
};

export const OVERRIDE_ORDER: ThemeOverride[] = ['auto', 'dawn', 'day', 'dusk', 'night'];

export function phaseForHour(hour: number): Phase {
  if (hour >= 5 && hour < 10) return 'dawn';
  if (hour >= 10 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'dusk';
  return 'night';
}

export const TILE_URLS: Record<ThemeTokens['tiles'], string> = {
  voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
