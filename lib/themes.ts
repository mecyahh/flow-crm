export type ThemeKey =
  | 'blue'
  | 'gold'
  | 'green'
  | 'red'
  | 'mono'
  | 'fuchsia'
  | 'bw'
  | 'orange'

export const DEFAULT_THEME: ThemeKey = 'blue'

export const THEME_VARS: Record<
  ThemeKey,
  {
    accent: string
    accent2: string
    textOnAccent: string
    card: string
    cardBorder: string
    glow: string
  }
> = {
  blue: {
    accent: '#3b82f6',
    accent2: '#60a5fa',
    textOnAccent: '#ffffff',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(59,130,246,0.35)',
  },
  gold: {
    accent: '#f59e0b',
    accent2: '#fbbf24',
    textOnAccent: '#0b0f1a',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(245,158,11,0.35)',
  },
  green: {
    accent: '#22c55e',
    accent2: '#4ade80',
    textOnAccent: '#06110b',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(34,197,94,0.35)',
  },
  red: {
    accent: '#ef4444',
    accent2: '#fb7185',
    textOnAccent: '#0b0f1a',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(239,68,68,0.35)',
  },
  mono: {
    accent: '#e5e7eb',
    accent2: '#9ca3af',
    textOnAccent: '#0b0f1a',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(229,231,235,0.25)',
  },
  fuchsia: {
    accent: '#d946ef',
    accent2: '#f472b6',
    textOnAccent: '#0b0f1a',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(217,70,239,0.35)',
  },
  bw: {
    accent: '#ffffff',
    accent2: '#a3a3a3',
    textOnAccent: '#000000',
    card: 'rgba(255,255,255,0.08)',
    cardBorder: 'rgba(255,255,255,0.16)',
    glow: 'rgba(255,255,255,0.25)',
  },
  orange: {
    accent: '#f97316',
    accent2: '#fdba74',
    textOnAccent: '#0b0f1a',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glow: 'rgba(249,115,22,0.35)',
  },
}
