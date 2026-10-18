export const accentPalettes = {
  purple: { label: 'Roxo', light: '258 55% 49%', dark: '258 88% 70%' },
  blue: { label: 'Azul', light: '217 82% 42%', dark: '217 95% 72%' },
  green: { label: 'Verde', light: '153 67% 28%', dark: '153 60% 62%' },
  pink: { label: 'Rosa', light: '333 62% 40%', dark: '333 90% 76%' },
  indigo: { label: 'Índigo', light: '239 67% 43%', dark: '239 95% 74%' },
  teal: { label: 'Turquesa', light: '174 77% 25%', dark: '174 70% 64%' },
  cyan: { label: 'Ciano', light: '192 87% 28%', dark: '192 85% 69%' },
  orange: { label: 'Laranja', light: '24 92% 35%', dark: '24 95% 70%' },
  coral: { label: 'Coral', light: '4 72% 40%', dark: '4 95% 74%' },
  black: { label: 'Preto', light: '0 0% 7%', dark: '0 0% 92%' },
  charcoal: { label: 'Cinza escuro', light: '0 0% 28%', dark: '0 0% 72%' },
  silver: { label: 'Prata', light: '210 6% 38%', dark: '210 8% 82%' },
  navy: { label: 'Azul-marinho', light: '222 72% 30%', dark: '222 75% 70%' },
  lavender: { label: 'Lavanda', light: '270 52% 42%', dark: '270 75% 74%' },
  magenta: { label: 'Magenta', light: '305 72% 35%', dark: '305 80% 74%' },
  wine: { label: 'Vinho', light: '345 67% 32%', dark: '345 75% 72%' },
  brown: { label: 'Chocolate', light: '25 57% 30%', dark: '25 55% 69%' },
  amber: { label: 'Âmbar', light: '35 95% 29%', dark: '35 95% 69%' },
  yellow: { label: 'Amarelo', light: '48 95% 24%', dark: '48 95% 69%' },
  lime: { label: 'Lima', light: '82 82% 25%', dark: '82 85% 69%' },
  olive: { label: 'Oliva', light: '65 52% 28%', dark: '65 55% 66%' },
  mint: { label: 'Menta', light: '160 67% 25%', dark: '160 70% 72%' },
  emerald: { label: 'Esmeralda', light: '145 77% 25%', dark: '145 70% 66%' },
  slate: { label: 'Grafite', light: '215 20% 35%', dark: '215 25% 78%' },
} as const;

export type AccentColor = keyof typeof accentPalettes;
export const accentColors = Object.keys(accentPalettes) as AccentColor[];
export const isAccentColor = (value: unknown): value is AccentColor =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(accentPalettes, value);
