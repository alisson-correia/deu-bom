import { Circle, icons } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category } from '@/types/finance';

const normalizeCategoryName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const iconByCategoryName: Record<string, keyof typeof icons> = {
  salario: 'Wallet',
  freelance: 'Briefcase',
  investimentos: 'TrendingUp',
  outros: 'Plus',
  alimentacao: 'Utensils',
  mercado: 'ShoppingCart',
  transporte: 'Car',
  moradia: 'House',
  aluguel: 'House',
  casa: 'House',
  saude: 'Heart',
  educacao: 'GraduationCap',
  lazer: 'Gamepad2',
  assinaturas: 'CreditCard',
  compras: 'ShoppingBag',
};

export const resolveCategoryIconName = (category?: Pick<Category, 'name' | 'icon'> | null) => {
  if (!category) return undefined;

  const normalizedName = normalizeCategoryName(category.name);
  return iconByCategoryName[normalizedName] || category.icon;
};

export const getCategoryIcon = (
  category?: Pick<Category, 'name' | 'icon'> | null
): LucideIcon => {
  const iconName = resolveCategoryIconName(category);
  return (iconName ? icons[iconName as keyof typeof icons] : undefined) || Circle;
};
