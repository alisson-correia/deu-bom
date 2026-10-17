import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Transaction } from '@/types/finance';
import { formatCurrency } from '@/utils/currency';

export function buildPendingReminder(transactions: Transaction[], now = new Date()) {
  const pending = transactions.filter((item) => item.status === 'pending');
  const relevant = pending.filter((item) => differenceInCalendarDays(parseISO(item.date), now) <= 3);
  if (!relevant.length) return null;
  const todayExpenses = relevant.filter((item) => item.type === 'expense' && differenceInCalendarDays(parseISO(item.date), now) === 0);
  const overdue = relevant.filter((item) => differenceInCalendarDays(parseISO(item.date), now) < 0);
  const soon = relevant.filter((item) => differenceInCalendarDays(parseISO(item.date), now) > 0);
  const todayIncome = relevant.filter((item) => item.type === 'income' && differenceInCalendarDays(parseISO(item.date), now) === 0);
  const title = todayExpenses.length
    ? `${todayExpenses.length} despesa(s) vencem hoje`
    : overdue.length ? `${overdue.length} pendência(s) em atraso` : 'Confira suas próximas pendências';
  const descriptions = [
    todayExpenses.length ? `A pagar hoje: ${formatCurrency(todayExpenses.reduce((sum, item) => sum + item.amount, 0))}.` : '',
    todayIncome.length ? `${todayIncome.length} receita(s) prevista(s) para hoje.` : '',
    overdue.length ? `${overdue.length} lançamento(s) em atraso.` : '',
    soon.length ? `${soon.length} vencimento(s) nos próximos 3 dias.` : '',
  ].filter(Boolean);
  return { title, description: descriptions.join(' '), signature: relevant.map((item) => `${item.id}:${item.date}:${item.type}:${item.amount}`).sort().join('|') };
}
