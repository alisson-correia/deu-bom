import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, PiggyBank, X } from 'lucide-react';
import { useCategories, useFinanceStore } from '@/stores/financeStore';
import { CurrencyInput } from './CurrencyInput';
import { getCategoryIcon } from '@/utils/categoryIcons';

interface BudgetFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetForm: React.FC<BudgetFormProps> = ({ isOpen, onClose }) => {
  const categories = useCategories();
  const { setBudget } = useFinanceStore();

  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState(0);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const handleSubmit = async () => {
    if (!categoryId || !limit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await setBudget(categoryId, limit);
      if (!success) return;

      onClose();
      setCategoryId('');
      setLimit(0);
      setShowCategoryPicker(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CategoryIcon = getCategoryIcon(selectedCategory);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          onClick={(event) => event.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[88vh] flex-col overflow-hidden rounded-t-[28px] bg-card sm:static sm:max-h-[82vh] sm:w-[min(40rem,calc(100vw-1.5rem))] sm:rounded-[28px]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Novo orcamento</h2>
                <p className="text-sm text-muted-foreground">
                  Defina um limite simples para acompanhar a categoria.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="touch-btn h-9 rounded-full bg-muted px-3 text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 overflow-y-auto px-4 pb-20 pt-4 sm:px-5 sm:pb-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Categoria
              </label>
              <button
                onClick={() => setShowCategoryPicker((current) => !current)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-input px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  {selectedCategory ? (
                    <>
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}
                      >
                        <CategoryIcon
                          className="h-5 w-5"
                          style={{ color: 'hsl(var(--primary))' }}
                        />
                      </div>
                      <span>{selectedCategory.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Selecionar categoria</span>
                  )}
                </div>
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${
                    showCategoryPicker ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {showCategoryPicker ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-2xl bg-muted p-3 sm:grid-cols-3">
                      {expenseCategories.map((category) => {
                        const Icon = getCategoryIcon(category);

                        return (
                          <button
                            key={category.id}
                            onClick={() => {
                              setCategoryId(category.id);
                              setShowCategoryPicker(false);
                            }}
                            className={`rounded-2xl p-3 text-left transition-colors ${
                              categoryId === category.id
                                ? 'bg-card shadow-[var(--shadow-sm)]'
                                : 'hover:bg-card/50'
                            }`}
                          >
                            <div
                              className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl"
                              style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}
                            >
                              <Icon className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
                            </div>
                            <p className="truncate text-sm font-medium">{category.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Limite mensal
              </label>
              <CurrencyInput value={limit} onChange={setLimit} />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 border-t border-border bg-card p-4 sm:mt-auto sm:p-5">
            <button
              onClick={handleSubmit}
              disabled={!categoryId || !limit || isSubmitting}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar orcamento'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
