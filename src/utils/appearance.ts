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
  black: { label: 'Preto', light: '0 0% 7%', dark: '0 0% 92%' },
  charcoal: { label: 'Cinza escuro', light: '0 0% 28%', dark: '0 0% 72%' },
  silver: { label: 'Prata', light: '210 6% 38%', dark: '210 8% 82%' },
  navy: { label: 'Azul-marinho', light: '222 60% 30%', dark: '222 65% 76%' },
  lavender: { label: 'Lavanda', light: '270 40% 42%', dark: '270 65% 80%' },
  magenta: { label: 'Magenta', light: '305 60% 35%', dark: '305 70% 80%' },
  wine: { label: 'Vinho', light: '345 55% 32%', dark: '345 65% 78%' },
  brown: { label: 'Chocolate', light: '25 45% 30%', dark: '25 45% 75%' },
  amber: { label: 'Âmbar', light: '35 85% 29%', dark: '35 90% 75%' },
  yellow: { label: 'Amarelo', light: '48 95% 24%', dark: '48 95% 75%' },
  lime: { label: 'Lima', light: '82 70% 25%', dark: '82 75% 75%' },
  olive: { label: 'Oliva', light: '65 40% 28%', dark: '65 45% 72%' },
  mint: { label: 'Menta', light: '160 55% 25%', dark: '160 60% 78%' },
  emerald: { label: 'Esmeralda', light: '145 65% 25%', dark: '145 60% 72%' },
  slate: { label: 'Grafite', light: '215 20% 35%', dark: '215 25% 78%' },
} as const;

export type AccentColor = keyof typeof accentPalettes;
export const accentColors = Object.keys(accentPalettes) as AccentColor[];
export const isAccentColor = (value: unknown): value is AccentColor =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(accentPalettes, value);
