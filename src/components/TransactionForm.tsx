import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import { addMonths, addWeeks, addYears, format, parseISO } from 'date-fns';
import { useCategories, useFinanceStore, useTransactions } from '@/stores/financeStore';
import { CurrencyInput } from './CurrencyInput';
import { openGoogleCalendar } from '@/utils/googleCalendar';
import { useGoogleIntegration } from '@/hooks/useGoogleIntegration';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { toast } from 'sonner';
import type {
  RecurrenceInterval,
  RecurrenceType,
  Transaction,
  TransactionType,
} from '@/types/finance';
import type { ParsedVoiceCommand } from '@/services/voiceCommandParser';
import { TransactionUpdateModal } from '@/components/TransactionDeleteModal';

type EndConditionType = 'never' | 'date' | 'occurrences';

const clampCount = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  editTransaction?: Transaction | null;
  defaultType?: TransactionType;
  initialDraft?: Extract<ParsedVoiceCommand, { kind: 'transaction' }> | null;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  onClose,
  editTransaction,
  defaultType = 'expense',
  initialDraft,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(false);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')].filter((item) => !item.hasAttribute('disabled') && item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => { dialog.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [isOpen]);
  const categories = useCategories();
  const { connected: googleConnected } = useGoogleIntegration();
  const transactions = useTransactions();
  const {
    addTransaction,
    updateTransaction,
    generateRecurringTransactions,
    replaceTransactionWithRecurringTransactions,
  } = useFinanceStore();

  const [type, setType] = useState<TransactionType>(defaultType);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceInterval, setRecurrenceInterval] =
    useState<RecurrenceInterval>('monthly');
  const [endCondition, setEndCondition] = useState<EndConditionType>('occurrences');
  const [occurrences, setOccurrences] = useState(12);
  const [endDate, setEndDate] = useState(
    format(addMonths(new Date(), 12), 'yyyy-MM-dd')
  );
  const [installments, setInstallments] = useState(2);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(true);
  const [showUpdateScopeModal, setShowUpdateScopeModal] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] =
    useState<Record<string, unknown> | null>(null);
  const [pendingUpdateTransactionId, setPendingUpdateTransactionId] = useState<string | null>(null);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingScope, setIsResolvingScope] = useState(false);
  busyRef.current = isSubmitting || isResolvingScope;

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type]
  );
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const resetForm = useCallback(() => {
    setType(defaultType);
    setTitle('');
    setAmount(0);
    setCategoryId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    setStatus('pending');
    setRecurrenceType('none');
    setInstallments(2);
    setRecurrenceInterval('monthly');
    setEndCondition('occurrences');
    setOccurrences(12);
    setEndDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
    setShowCategoryPicker(false);
    setShowAdvancedFields(true);
    setShowUpdateScopeModal(false);
    setPendingUpdateData(null);
    setPendingUpdateTransactionId(null);
    setSuggestedCategoryId(null);
    setIsSubmitting(false);
    setIsResolvingScope(false);
  }, [defaultType]);

  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setTitle(editTransaction.title);
      setAmount(editTransaction.amount);
      
      setCategoryId(editTransaction.categoryId);
      setDate(editTransaction.date);
      setNotes(editTransaction.notes || '');
      setStatus(editTransaction.status);
      setRecurrenceType(editTransaction.recurrenceType);
      if (editTransaction.recurrenceInterval) {
        setRecurrenceInterval(editTransaction.recurrenceInterval);
      }
      setShowAdvancedFields(
        editTransaction.recurrenceType !== 'none' || Boolean(editTransaction.notes)
      );
      setSuggestedCategoryId(null);
      setShowCategoryPicker(false);
    } else {
      resetForm();
      if (isOpen && initialDraft) {
        setType(initialDraft.type);
        setTitle(initialDraft.title);
        // The parser returns the installment price; this form expects the total.
        setAmount(initialDraft.amount * (initialDraft.recurrenceType === 'installment' ? (initialDraft.installmentCount || 2) : 1));
        setRecurrenceType(initialDraft.recurrenceType);
        setInstallments(initialDraft.installmentCount || 2);
        if (initialDraft.date) {
          setDate(initialDraft.date);
        } else if (initialDraft.dayOfMonth) {
          const today = new Date();
          const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
          setDate(format(new Date(today.getFullYear(), today.getMonth(), Math.min(lastDay, initialDraft.dayOfMonth)), 'yyyy-MM-dd'));
        }
      }
    }
  }, [editTransaction, isOpen, resetForm, initialDraft]);

  useEffect(() => {
    if (filteredCategories.length === 0) {
      if (categoryId) setCategoryId('');
      return;
    }

    if (!categoryId || selectedCategory?.type !== type) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [categoryId, filteredCategories, selectedCategory?.type, type]);

  useEffect(() => {
    if (editTransaction || !title.trim()) {
      setSuggestedCategoryId(null);
      return;
    }

    const normalizedTitle = title.trim().toLowerCase();

    const categoryNameMatch = filteredCategories.find((category) =>
      normalizedTitle.includes(category.name.toLowerCase())
    );

    if (categoryNameMatch) {
      setSuggestedCategoryId(categoryNameMatch.id);
      return;
    }

    const recentMatch = [...transactions]
      .filter((transaction) => transaction.type === type)
      .sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      )
      .find((transaction) => {
        const transactionTitle = transaction.title.trim().toLowerCase();
        return (
          transactionTitle === normalizedTitle ||
          transactionTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(transactionTitle)
        );
      });

    setSuggestedCategoryId(recentMatch?.categoryId || null);
  }, [editTransaction, filteredCategories, title, transactions, type]);

  const calculateOccurrencesFromDate = (): number => {
    const start = parseISO(date);
    const end = parseISO(endDate);
    let count = 0;
    let current = start;

    while (current <= end) {
      count += 1;
      if (recurrenceInterval === 'weekly') {
        current = addWeeks(current, 1);
      } else if (recurrenceInterval === 'monthly') {
        current = addMonths(current, 1);
      } else {
        current = addYears(current, 1);
      }
    }

    return Math.max(1, count);
  };

  const isRecurringEdit = Boolean(
    editTransaction &&
      (editTransaction.groupId ||
        editTransaction.parentTransactionId ||
        (editTransaction.totalInstallments && editTransaction.totalInstallments > 1))
  );

  const handleSubmit = async (updateFuture = false, updateAll = false) => {
    if (!title || !amount || !categoryId || isSubmitting || isResolvingScope) return;

    const normalizedInstallments = clampCount(installments, 2, 120);
    const normalizedOccurrences = clampCount(occurrences, 2, 120);
    const recurringCount =
      recurrenceType === 'installment'
        ? normalizedInstallments
        : endCondition === 'never'
          ? 24
          : endCondition === 'date'
            ? calculateOccurrencesFromDate()
            : normalizedOccurrences;
    const seriesInterval =
      recurrenceType === 'installment' ? 'monthly' : recurrenceInterval;

    const transactionData = {
      title,
      amount,
      type,
      status: editTransaction
        ? status
        : ('pending' as const),
      categoryId,
      date,
      notes,
      notify: false,
      recurrenceType,
      recurrenceInterval: recurrenceType === 'none' ? undefined : seriesInterval,
      recurrenceEndDate:
        recurrenceType === 'subscription' && endCondition === 'date' ? endDate : undefined,
    };

    if (editTransaction) {
      const canConvertSingleToSeries =
        !isRecurringEdit &&
        (recurrenceType === 'installment' || recurrenceType === 'subscription') &&
        recurringCount > 1;

      if (canConvertSingleToSeries) {
        setIsSubmitting(true);
        try {
          const success = await replaceTransactionWithRecurringTransactions(
            editTransaction.id,
            transactionData,
            recurringCount,
            seriesInterval,
            recurrenceType === 'installment'
          );
          if (!success) return;

          toast.success(
            recurrenceType === 'installment'
              ? `${recurringCount} parcelas salvas!`
              : `${recurringCount} lancamentos recorrentes salvos!`
          );
          onClose();
          resetForm();
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      if (isRecurringEdit && !showUpdateScopeModal && !updateFuture && !updateAll) {
        setPendingUpdateData(transactionData);
        setPendingUpdateTransactionId(editTransaction.id);
        setShowUpdateScopeModal(true);
        return;
      }

      setIsSubmitting(true);
      try {
        const success = await updateTransaction(
          editTransaction.id,
          transactionData,
          updateFuture,
          updateAll
        );
        if (!success) return;

        toast.success('Transacao atualizada e sincronizada!');
        onClose();
        resetForm();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (recurrenceType === 'installment' && normalizedInstallments > 1) {
      setIsSubmitting(true);
      try {
        const success = await generateRecurringTransactions(
          transactionData,
          normalizedInstallments,
          'monthly',
          true
        );
        if (!success) return;

        toast.success(`${normalizedInstallments} parcelas criadas!`);
        onClose();
        resetForm();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (recurrenceType === 'subscription') {
      setIsSubmitting(true);
      try {
        const success = await generateRecurringTransactions(
          transactionData,
          recurringCount,
          recurrenceInterval,
          false
        );
        if (!success) return;

        toast.success(`${recurringCount} transacoes recorrentes criadas!`);
        onClose();
        resetForm();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await addTransaction(transactionData);
      if (!success) return;

      toast.success('Transacao adicionada!');
      onClose();
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateScopeConfirm = async (scope: 'single' | 'future' | 'all') => {
    if (!pendingUpdateTransactionId || !pendingUpdateData || isResolvingScope) return;

    setIsResolvingScope(true);
    try {
      const success =
        scope === 'single'
          ? await updateTransaction(
              pendingUpdateTransactionId,
              pendingUpdateData as Partial<Transaction>,
              false
            )
          : scope === 'future'
            ? await updateTransaction(
                pendingUpdateTransactionId,
                pendingUpdateData as Partial<Transaction>,
                true
              )
            : await updateTransaction(
                pendingUpdateTransactionId,
                pendingUpdateData as Partial<Transaction>,
                false,
                true
              );

      if (!success) return;

      const scopeLabel =
        scope === 'single'
          ? 'este lancamento'
          : scope === 'future'
            ? 'este e os proximos lancamentos'
            : 'toda a serie';

      toast.success(`Atualizacao aplicada em ${scopeLabel}.`);
      setShowUpdateScopeModal(false);
      setPendingUpdateData(null);
      setPendingUpdateTransactionId(null);
      onClose();
      resetForm();
    } finally {
      setIsResolvingScope(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isResolvingScope) return;
    onClose();
    resetForm();
  };

  const canOpenCalendar = Boolean(title.trim() && amount > 0 && date);

  const handleAddToCalendar = () => {
    if (!canOpenCalendar) return;

    openGoogleCalendar({
      title: title.trim(),
      date,
      amount,
      type,
      notes: notes.trim() || undefined,
    });

    toast.success('Abrindo Google Agenda...');
  };

  const canSave = Boolean(title && amount && categoryId && !isSubmitting && !isResolvingScope);

  const applySuggestedCategory = () => {
    if (!suggestedCategoryId) return;
    setCategoryId(suggestedCategoryId);
  };

  const CategoryIcon = getCategoryIcon(selectedCategory);

  const suggestedCategory = suggestedCategoryId
    ? categories.find((category) => category.id === suggestedCategoryId)
    : null;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div key="transaction-sheet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          onClick={(event) => event.stopPropagation()}
          ref={dialogRef} role="dialog" aria-modal="true" aria-label={editTransaction ? 'Editar transacao' : 'Nova transacao'}
          className="transaction-dialog absolute bottom-0 left-0 right-0 flex max-h-[96dvh] flex-col overflow-hidden rounded-t-3xl bg-card sm:static sm:max-h-[86vh] sm:w-[min(42rem,calc(100vw-1.5rem))] sm:rounded-3xl"
        >
          <div className="sticky top-0 z-30 flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold sm:text-lg">
              {editTransaction ? 'Editar transacao' : 'Nova transacao'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                aria-label="Fechar formulário"
                className="touch-btn flex h-9 w-9 items-center justify-center rounded-full bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-5 sm:pb-6">
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                onClick={() => setType('expense')}
                aria-pressed={type === 'expense'}
                className={`py-3 rounded-lg font-medium transition-all ${
                  type === 'expense'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground'
                }`}
              >
                Despesa
              </button>
              <button
                onClick={() => setType('income')}
                aria-pressed={type === 'income'}
                className={`py-3 rounded-lg font-medium transition-all ${
                  type === 'income'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground'
                }`}
              >
                Receita
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Valor
              </label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                className="focus:ring-ring"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Descricao
              </label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Descrição"
                placeholder="Ex: Supermercado"
                className="w-full rounded-xl border border-border bg-input px-4 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {!editTransaction && suggestedCategory && suggestedCategory.id !== categoryId ? (
                <button
                  type="button"
                  onClick={applySuggestedCategory}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Sugerir categoria: {suggestedCategory.name}
                </button>
              ) : null}
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Categoria
              </label>
              <button
                aria-expanded={showCategoryPicker}
                aria-label="Selecionar categoria"
                onClick={() => setShowCategoryPicker((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-input px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${selectedCategory?.color || '#64748b'}20` }}
                  >
                    <CategoryIcon
                      className="h-5 w-5"
                      style={{ color: selectedCategory?.color }}
                    />
                  </div>
                  <span>{selectedCategory?.name || 'Selecionar'}</span>
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
                    <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-muted p-3">
                      {filteredCategories.map((category) => {
                        const Icon = getCategoryIcon(category);

                        return (
                          <button
                            key={category.id}
                            aria-pressed={categoryId === category.id}
                            onClick={() => {
                              setCategoryId(category.id);
                              setShowCategoryPicker(false);
                            }}
                            className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-all ${
                              categoryId === category.id
                                ? 'bg-primary/10 ring-2 ring-ring shadow-md'
                                : 'hover:bg-card/50'
                            }`}
                          >
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${category.color}20` }}
                            >
                              <Icon className="h-5 w-5" style={{ color: category.color }} />
                            </div>
                            <span className="w-full truncate text-center text-xs">
                              {category.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                {recurrenceType === 'none' ? 'Data' : 'Data de inicio'}
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-xl border border-border bg-input py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mb-6 rounded-[20px] border border-border/70 bg-muted/30">
              <button
                type="button"
                onClick={() => setShowAdvancedFields((current) => !current)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
              >
                <div>
                  <p className="text-sm font-medium">Recorrencia e parcelas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use recorrente para salario mensal e parcelado para dividas em varias vezes.
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    showAdvancedFields ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {showAdvancedFields ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border/70"
                  >
                    <div className="px-4 pb-4 pt-3.5">
                        <div className="mb-6">
                          <label className="mb-2 block text-sm font-medium text-muted-foreground">
                            Como esse lancamento se repete?
                          </label>
                          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
                            <button
                              type="button"
                              onClick={() => setRecurrenceType('none')}
                              className={`py-3 rounded-lg text-sm font-medium transition-all ${
                                recurrenceType === 'none'
                                  ? 'bg-card text-foreground shadow-md'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Unica
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecurrenceType('installment')}
                              className={`py-3 rounded-lg text-sm font-medium transition-all ${
                                recurrenceType === 'installment'
                                  ? 'bg-card text-foreground shadow-md'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Parcelado
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecurrenceType('subscription')}
                              className={`py-3 rounded-lg text-sm font-medium transition-all ${
                                recurrenceType === 'subscription'
                                  ? 'bg-card text-foreground shadow-md'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Recorrente
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setType('income');
                                setRecurrenceType('subscription');
                                setRecurrenceInterval('monthly');
                                setEndCondition('never');
                              }}
                              className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-left text-xs font-medium text-primary"
                            >
                              Salario mensal
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setType('expense');
                                setRecurrenceType('installment');
                              }}
                              className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-left text-xs font-medium text-primary"
                            >
                              Divida parcelada
                            </button>
                          </div>

                          {recurrenceType === 'installment' ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="mt-4"
                            >
                              <label className="mb-2 block text-sm text-muted-foreground">
                                Numero de parcelas
                              </label>
                              <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                                <input
                                  type="number"
                                  min="2"
                                  max="120"
                                  value={installments}
                                  onChange={(event) =>
                                    setInstallments(
                                      clampCount(Number.parseInt(event.target.value, 10), 2, 120)
                                    )
                                  }
                                  className="h-12 rounded-xl border border-border bg-input px-4 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <div className="grid grid-cols-5 gap-2">
                                  {[3, 6, 12, 24, 48].map((option) => (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => setInstallments(option)}
                                      className={`h-12 rounded-xl border text-sm font-medium transition-colors ${
                                        installments === option
                                          ? 'border-primary bg-primary text-primary-foreground'
                                          : 'border-border bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {option}x
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                Valor por parcela:{' '}
                                <span className="font-mono font-medium text-foreground">
                                  R${' '}
                                  {(amount / clampCount(installments, 2, 120)).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </p>
                            </motion.div>
                          ) : null}

                          {recurrenceType === 'subscription' ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="mt-4 space-y-4"
                            >
                              <div>
                                <label className="mb-2 block text-sm text-muted-foreground">
                                  Repetir a cada
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                  {(['weekly', 'monthly', 'yearly'] as RecurrenceInterval[]).map(
                                    (interval) => (
                                      <button
                                        key={interval}
                                        onClick={() => setRecurrenceInterval(interval)}
                                        className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                                          recurrenceInterval === interval
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-muted text-muted-foreground'
                                        }`}
                                      >
                                        {interval === 'weekly' && 'Semana'}
                                        {interval === 'monthly' && 'Mes'}
                                        {interval === 'yearly' && 'Ano'}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm text-muted-foreground">
                                  Termina
                                </label>
                                <div className="mb-3 grid grid-cols-3 gap-2">
                                  <button
                                    onClick={() => setEndCondition('never')}
                                    className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                                      endCondition === 'never'
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    Nunca
                                  </button>
                                  <button
                                    onClick={() => setEndCondition('occurrences')}
                                    className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                                      endCondition === 'occurrences'
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    Apos X vezes
                                  </button>
                                  <button
                                    onClick={() => setEndCondition('date')}
                                    className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                                      endCondition === 'date'
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    Em data
                                  </button>
                                </div>

                                {endCondition === 'occurrences' ? (
                                  <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                                    <input
                                      type="number"
                                      min="2"
                                      max="120"
                                      value={occurrences}
                                      onChange={(event) =>
                                        setOccurrences(
                                          clampCount(Number.parseInt(event.target.value, 10), 2, 120)
                                        )
                                      }
                                      className="h-12 rounded-xl border border-border bg-input px-4 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                    <div className="grid grid-cols-4 gap-2">
                                      {[6, 12, 24, 36].map((option) => (
                                        <button
                                          key={option}
                                          type="button"
                                          onClick={() => setOccurrences(option)}
                                          className={`h-12 rounded-xl border text-sm font-medium transition-colors ${
                                            occurrences === option
                                              ? 'border-primary bg-primary text-primary-foreground'
                                              : 'border-border bg-muted text-muted-foreground'
                                          }`}
                                        >
                                          {option}x
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {endCondition === 'date' ? (
                                  <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                      type="date"
                                      value={endDate}
                                      onChange={(event) => setEndDate(event.target.value)}
                                      className="w-full rounded-xl border border-border bg-input py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </motion.div>
                          ) : null}
                        </div>

                      <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">
                          Observacoes (opcional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Adicione uma nota..."
                          rows={3}
                          className="w-full resize-none rounded-xl border border-border bg-input px-4 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {editTransaction ? (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                  <button
                    aria-pressed={status === 'pending'}
                    onClick={() => setStatus('pending')}
                    className={`flex items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all ${
                      status === 'pending'
                        ? 'border border-primary bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    Pendente
                  </button>
                  <button
                    aria-pressed={status === 'completed'}
                    onClick={() => setStatus('completed')}
                    className={`flex items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all ${
                      status === 'completed'
                        ? 'border border-primary bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    Confirmado
                  </button>
                </div>
              </div>
            ) : null}

            {editTransaction &&
            editTransaction.installmentNumber &&
            editTransaction.totalInstallments ? (
              <div className="mb-6 rounded-xl border border-border bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Parcela</span>
                  <span className="text-sm font-semibold">
                    {editTransaction.installmentNumber} de{' '}
                    {editTransaction.totalInstallments}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
            <div className={googleConnected ? 'grid grid-cols-1' : 'grid grid-cols-[3.25rem_1fr] gap-2 sm:grid-cols-[auto_1fr]'}>
              {!googleConnected && <button
                type="button"
                onClick={handleAddToCalendar}
                disabled={!canOpenCalendar || isSubmitting || isResolvingScope}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                aria-label="Criar lembrete manual no Google"
                title="Lembrete manual; a conclusão não é sincronizada"
              >
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Lembrete manual</span>
              </button>}

              <button
                onClick={() => handleSubmit()}
                disabled={!canSave}
                className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Salvando...'
                  : editTransaction
                    ? 'Salvar alteracoes'
                    : 'Salvar'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <TransactionUpdateModal key="update-scope"
        isOpen={showUpdateScopeModal}
        onClose={() => {
          if (isResolvingScope) return;
          setShowUpdateScopeModal(false);
          setPendingUpdateData(null);
          setPendingUpdateTransactionId(null);
        }}
        onConfirm={handleUpdateScopeConfirm}
        transactionTitle={editTransaction?.title || ''}
        isSubmitting={isResolvingScope}
      />
    </AnimatePresence>
  );
};
