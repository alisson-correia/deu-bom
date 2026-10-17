export const accentPalettes = {
  purple: { label: 'Roxo', light: '258 43% 49%', dark: '258 78% 76%' },
  blue: { label: 'Azul', light: '217 70% 42%', dark: '217 90% 78%' },
  green: { label: 'Verde', light: '153 55% 28%', dark: '153 50% 68%' },
  pink: { label: 'Rosa', light: '333 50% 40%', dark: '333 80% 82%' },
  indigo: { label: 'Índigo', light: '239 55% 43%', dark: '239 85% 80%' },
  teal: { label: 'Turquesa', light: '174 65% 25%', dark: '174 60% 70%' },
  cyan: { label: 'Ciano', light: '192 75% 28%', dark: '192 75% 75%' },
  orange: { label: 'Laranja', light: '24 80% 35%', dark: '24 90% 76%' },
  coral: { label: 'Coral', light: '4 60% 40%', dark: '4 85% 80%' },
  slate: { label: 'Grafite', light: '215 20% 35%', dark: '215 25% 78%' },
} as const;

export type AccentColor = keyof typeof accentPalettes;
export const accentColors = Object.keys(accentPalettes) as AccentColor[];
export const isAccentColor = (value: unknown): value is AccentColor =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(accentPalettes, value);
