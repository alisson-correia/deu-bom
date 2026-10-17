export const accentPalettes = {
  purple: { label: 'Roxo', light: '258 43% 49%', dark: '258 78% 76%' },
  blue: { label: 'Azul', light: '217 70% 42%', dark: '217 90% 78%' },
  green: { label: 'Verde', light: '153 55% 28%', dark: '153 50% 68%' },
  pink: { label: 'Rosa', light: '333 50% 40%', dark: '333 80% 82%' },
} as const;

export type AccentColor = keyof typeof accentPalettes;
export const accentColors = Object.keys(accentPalettes) as AccentColor[];
export const isAccentColor = (value: unknown): value is AccentColor =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(accentPalettes, value);
