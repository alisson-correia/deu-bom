import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import {
  useBudgets,
  useCategories,
  useFinanceStore,
  useTransactions,
} from '@/stores/financeStore';
import { formatCurrency } from '@/utils/currency';
import { EmptyState } from '@/components/EmptyState';
import { getCategoryIcon } from '@/utils/categoryIcons';

interface BudgetCardProps {
  onAddBudget: () => void;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ onAddBudget }) => {
  const budgets = useBudgets();
  const categories = useCategories();
  const transactions = useTransactions();
  const { removeBudget } = useFinanceStore();

  const budgetsWithSpent = useMemo(() => {
    return budgets.map((budget) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const spent = transactions
        .filter(
          (transaction) =>
            transaction.categoryId === budget.categoryId &&
            transaction.type === 'expense' &&
            transaction.status === 'completed' &&
            new Date(transaction.date) >= startOfMonth
        )
        .reduce((total, transaction) => total + transaction.amount, 0);

      const category = categories.find((item) => item.id === budget.categoryId);
      return { ...budget, spent, category };
    });
  }, [budgets, categories, transactions]);

  if (budgetsWithSpent.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="Nenhum orçamento definido"
        description="Crie limites para acompanhar categorias com mais clareza e evitar estouros."
        action={
          <button
            onClick={onAddBudget}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Criar orçamento
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Limites ativos
          </p>
          <h2 className="mt-1 text-lg font-semibold">Orçamentos do mês</h2>
        </div>
        <button
          onClick={onAddBudget}
          className="touch-btn h-11 rounded-2xl border border-primary/20 bg-primary/10 px-4 text-primary"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {budgetsWithSpent.map((budget, index) => {
          const Icon = getCategoryIcon(budget.category);

          const percentage = Math.min((budget.spent / budget.limit) * 100, 100);
          const isOverBudget = budget.spent > budget.limit;
          const remaining = budget.limit - budget.spent;

          return (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-[24px] border border-border/70 bg-card p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}
                  >
                    <Icon className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
                  </div>
                  <div>
                    <h3 className="font-medium">{budget.category?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isOverBudget ? (
                        <span className="text-expense">
                          Excedeu {formatCurrency(Math.abs(remaining))}
                        </span>
                      ) : (
                        <span>Restam {formatCurrency(remaining)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeBudget(budget.categoryId)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                  className={`h-full rounded-full ${
                    isOverBudget ? 'bg-expense' : percentage > 80 ? 'bg-warning' : 'bg-primary'
                  }`}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-mono">{formatCurrency(budget.spent)}</span>
                <span className="font-mono text-muted-foreground">
                  {formatCurrency(budget.limit)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
