import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Filter,
  Loader2,
  Search,
  WalletCards,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionCard } from '@/components/TransactionCard';
import { TransactionUpdateModal } from '@/components/TransactionDeleteModal';
import { TransactionForm } from '@/components/TransactionForm';
import {
  useCategories,
  useFinanceLoading,
  useFinanceStore,
  useSettings,
  useTransactions,
} from '@/stores/financeStore';
import {
  filterTransactionsByMonth,
  sortTransactionsByDateDesc,
  summarizeTransactions,
} from '@/utils/transactionInsights';
import { formatCurrency } from '@/utils/currency';
import type { Transaction, TransactionType } from '@/types/finance';
import { toast } from 'sonner';
import { usePageVoice } from '@/components/VoiceProvider';
import { parseVoiceCommand } from '@/services/voiceCommandParser';

type ColumnId = 'pay' | 'receive' | 'done';

interface KanbanColumn {
  id: ColumnId;
  title: string;
  description: string;
  total: number;
  count: number;
  empty: string;
  tone: string;
  items: Transaction[];
}

interface VoiceTransactionDraft {
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  recurrenceType: 'none' | 'installment' | 'subscription';
  installmentCount: number;
  dayOfMonth?: number;
}

const Transactions: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<'all' | string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [defaultType, setDefaultType] = useState<TransactionType>('expense');
  const [showCyclePicker, setShowCyclePicker] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceTransactionDraft | null>(null);
  const [voicePrompt, setVoicePrompt] = useState('');
  const [isSavingVoiceDraft, setIsSavingVoiceDraft] = useState(false);
  const [draggingTransactionId, setDraggingTransactionId] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<ColumnId | null>(null);
  const [pendingDragTransaction, setPendingDragTransaction] = useState<Transaction | null>(null);
  const [pendingDragUpdates, setPendingDragUpdates] =
    useState<Partial<Transaction> | null>(null);
  const [isResolvingDragScope, setIsResolvingDragScope] = useState(false);

  const transactions = useTransactions();
  const categories = useCategories();
  const loading = useFinanceLoading();
  const settings = useSettings();
  const {
    initialize,
    initialized,
    updateSettings,
    updateTransaction,
    addTransaction,
    generateRecurringTransactions,
  } = useFinanceStore();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialize, initialized]);

  const cycleDays = Array.from({ length: 30 }, (_, index) => index + 2);
  const cycleLabel =
    settings.cycleStartDay === 1 ? 'Sem ajuste' : `Dia ${settings.cycleStartDay}`;

  const getDateFromDayOfMonth = (dayOfMonth?: number) => {
    const today = new Date();
    const normalizedDay = Math.min(
      Math.max(dayOfMonth || today.getDate(), 1),
      new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    );

    return new Date(today.getFullYear(), today.getMonth(), normalizedDay)
      .toISOString()
      .slice(0, 10);
  };

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const filteredTransactions = useMemo(() => {
    return sortTransactionsByDateDesc(
      monthTransactions.filter((transaction) => {
        if (filterType !== 'all' && transaction.type !== filterType) return false;
        if (filterStatus !== 'all' && transaction.status !== filterStatus) return false;
        if (filterCategoryId !== 'all' && transaction.categoryId !== filterCategoryId) return false;

        if (!searchQuery) return true;

        const category = categories.find((item) => item.id === transaction.categoryId);
        const term = searchQuery.toLowerCase();

        return (
          transaction.title.toLowerCase().includes(term) ||
          category?.name.toLowerCase().includes(term) ||
          transaction.notes?.toLowerCase().includes(term)
        );
      })
    );
  }, [categories, filterCategoryId, filterStatus, filterType, monthTransactions, searchQuery]);

  const summary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions]
  );

  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    const buildColumn = (
      id: ColumnId,
      title: string,
      description: string,
      empty: string,
      tone: string,
      predicate: (transaction: Transaction) => boolean
    ) => {
      const items = filteredTransactions.filter(predicate);

      return {
        id,
        title,
        description,
        empty,
        tone,
        items,
        count: items.length,
        total: items.reduce((total, transaction) => total + transaction.amount, 0),
      };
    };

    return [
      buildColumn(
        'pay',
        'A pagar',
        'Despesas pendentes para voce fechar.',
        'Nenhuma despesa pendente nesse filtro.',
        'border-expense/20 bg-expense/10',
        (transaction) =>
          transaction.type === 'expense' && transaction.status === 'pending'
      ),
      buildColumn(
        'receive',
        'A receber',
        'Receitas ainda abertas no periodo.',
        'Nenhuma receita aguardando entrada.',
        'border-income/20 bg-income/10',
        (transaction) =>
          transaction.type === 'income' && transaction.status === 'pending'
      ),
      buildColumn(
        'done',
        'Concluido',
        'Tudo que ja foi confirmado.',
        'Nada concluido com os filtros atuais.',
        'border-primary/20 bg-primary/10',
        (transaction) => transaction.status === 'completed'
      ),
    ];
  }, [filteredTransactions]);

  const handleMonthChange = (direction: number) => {
    setSelectedMonth(
      (previous) =>
        new Date(previous.getFullYear(), previous.getMonth() + direction, 1)
    );
  };

  const openForm = (type: TransactionType) => {
    setDefaultType(type);
    setEditTransaction(null);
    setIsFormOpen(true);
  };

  const handleVoiceTranscript = (transcript: string) => {
    const command = parseVoiceCommand(transcript, { preferredKind: 'transaction' });

    if (!command || command.kind !== 'transaction') {
      setVoiceDraft(null);
      setVoicePrompt('Nao entendi os dados principais. Diga algo como: salario do Joao 5000 ou despesa mercado 45 reais.');
      return;
    }

    setVoicePrompt('Confira os dados interpretados antes de salvar.');
    setVoiceDraft({
      title: command.title,
      amount: command.amount,
      type: command.type,
      date: command.date || getDateFromDayOfMonth(command.dayOfMonth),
      recurrenceType: command.recurrenceType,
      installmentCount: command.installmentCount || 2,
      dayOfMonth: command.dayOfMonth,
    });
  };

  const handleSaveVoiceDraft = async () => {
    if (!voiceDraft || isSavingVoiceDraft) return;

    if (!voiceDraft.title.trim() || voiceDraft.amount <= 0 || !voiceDraft.date) {
      setVoicePrompt('Ainda falta titulo, valor ou data antes de salvar.');
      return;
    }

    const fallbackCategory = categories.find((category) => category.type === voiceDraft.type);
    if (!fallbackCategory) {
      setVoicePrompt('Nao encontrei uma categoria para esse tipo de lancamento.');
      return;
    }

    const recurringCount =
      voiceDraft.recurrenceType === 'installment'
        ? Math.max(2, voiceDraft.installmentCount)
        : 24;
    const amountForStore =
      voiceDraft.recurrenceType === 'installment'
        ? voiceDraft.amount * recurringCount
        : voiceDraft.amount;

    const transactionData = {
      title: voiceDraft.title.trim(),
      amount: amountForStore,
      type: voiceDraft.type,
      status: 'pending' as const,
      categoryId: fallbackCategory.id,
      date: voiceDraft.date,
      notes: 'Revisado a partir de comando de voz',
      notify: false,
      recurrenceType: voiceDraft.recurrenceType,
      recurrenceInterval: voiceDraft.recurrenceType === 'none' ? undefined : ('monthly' as const),
    };

    setIsSavingVoiceDraft(true);
    try {
      const success = voiceDraft.recurrenceType === 'subscription'
        ? await generateRecurringTransactions(transactionData, 24, 'monthly', false)
        : voiceDraft.recurrenceType === 'installment'
          ? await generateRecurringTransactions(transactionData, recurringCount, 'monthly', true)
        : await addTransaction(transactionData);

      if (!success) return;

      setVoiceDraft(null);
      setVoicePrompt('');
      toast.success(
        voiceDraft.recurrenceType === 'none'
          ? 'Lancamento salvo.'
          : voiceDraft.recurrenceType === 'installment'
            ? 'Parcelas salvas.'
            : 'Lancamento recorrente salvo.'
      );
    } finally {
      setIsSavingVoiceDraft(false);
    }
  };

  const { isListening, lastTranscript } = usePageVoice({
    onTranscript: (transcript) => {
      void handleVoiceTranscript(transcript);
    },
  });

  const isRecurringTransaction = (transaction: Transaction) =>
    Boolean(
      transaction.groupId ||
        transaction.parentTransactionId ||
        (transaction.totalInstallments && transaction.totalInstallments > 1)
    );

  const getUpdatesForColumn = (
    transaction: Transaction,
    columnId: ColumnId
  ): Partial<Transaction> | null => {
    const nextType: TransactionType =
      columnId === 'receive' ? 'income' : columnId === 'pay' ? 'expense' : transaction.type;
    const nextStatus = columnId === 'done' ? 'completed' : 'pending';
    const currentCategory = categories.find((category) => category.id === transaction.categoryId);
    const fallbackCategory = categories.find((category) => category.type === nextType);
    const nextCategoryId =
      currentCategory?.type === nextType
        ? transaction.categoryId
        : fallbackCategory?.id || transaction.categoryId;

    const updates: Partial<Transaction> = {};

    if (transaction.status !== nextStatus) updates.status = nextStatus;
    if (transaction.type !== nextType) updates.type = nextType;
    if (transaction.categoryId !== nextCategoryId) updates.categoryId = nextCategoryId;

    return Object.keys(updates).length > 0 ? updates : null;
  };

  const applyDragUpdates = async (
    transaction: Transaction,
    updates: Partial<Transaction>,
    scope: 'single' | 'future' | 'all' = 'single'
  ) => {
    const success =
      scope === 'single'
        ? await updateTransaction(transaction.id, updates, false)
        : scope === 'future'
          ? await updateTransaction(transaction.id, updates, true)
          : await updateTransaction(transaction.id, updates, false, true);

    if (success) {
      toast.success('Card movido.');
    }

    return success;
  };

  const handleDropOnColumn = async (columnId: ColumnId) => {
    const transaction = transactions.find((item) => item.id === draggingTransactionId);
    setDropTargetColumn(null);

    if (!transaction) return;

    const updates = getUpdatesForColumn(transaction, columnId);
    if (!updates) return;

    if (isRecurringTransaction(transaction)) {
      setPendingDragTransaction(transaction);
      setPendingDragUpdates(updates);
      return;
    }

    await applyDragUpdates(transaction, updates);
  };

  const handleDragScopeConfirm = async (scope: 'single' | 'future' | 'all') => {
    if (!pendingDragTransaction || !pendingDragUpdates || isResolvingDragScope) return;

    setIsResolvingDragScope(true);
    try {
      const success = await applyDragUpdates(pendingDragTransaction, pendingDragUpdates, scope);
      if (!success) return;

      setPendingDragTransaction(null);
      setPendingDragUpdates(null);
    } finally {
      setIsResolvingDragScope(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando financas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--app-bottom-nav-height,0px)+1rem+env(safe-area-inset-bottom,0px))] xl:pl-[var(--app-sidebar-width,88px)]">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 py-4 backdrop-blur-xl">
        <div className="app-content">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-lg">
              <h1 className="text-xl font-semibold sm:text-2xl">Finanças</h1>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                Receitas, despesas e pendências do mês.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">

              <button
                onClick={() => openForm('income')}
                aria-pressed={isFormOpen && defaultType === 'income'}
                className="new-transaction-button min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Nova receita
              </button>
              <button
                onClick={() => openForm('expense')}
                aria-pressed={isFormOpen && defaultType === 'expense'}
                className="new-transaction-button min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Nova despesa
              </button>
            </div>
          </div>

          {isListening || lastTranscript ? (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
              {lastTranscript || 'Ouvindo...'}
            </div>
          ) : null}

          {(voiceDraft || voicePrompt) ? (
            <div className="mt-3 rounded-2xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Revisar comando de voz</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {voicePrompt || 'Confira os dados antes de salvar.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceDraft(null);
                    setVoicePrompt('');
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Fechar
                </button>
              </div>

              {voiceDraft ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted-foreground">
                      Tipo
                      <select
                        value={voiceDraft.type}
                        onChange={(event) =>
                          setVoiceDraft((current) =>
                            current
                              ? { ...current, type: event.target.value as TransactionType }
                              : current
                          )
                        }
                        className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                      >
                        <option value="income">Receita</option>
                        <option value="expense">Despesa</option>
                      </select>
                    </label>

                    <label className="text-xs text-muted-foreground">
                      Data
                      <input
                        type="date"
                        value={voiceDraft.date}
                        onChange={(event) =>
                          setVoiceDraft((current) =>
                            current ? { ...current, date: event.target.value } : current
                          )
                        }
                        className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-muted-foreground">
                    Descricao
                    <input
                      type="text"
                      value={voiceDraft.title}
                      onChange={(event) =>
                        setVoiceDraft((current) =>
                          current ? { ...current, title: event.target.value } : current
                        )
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                    />
                  </label>

                  <label className="block text-xs text-muted-foreground">
                    {voiceDraft.recurrenceType === 'installment' ? 'Valor da parcela' : 'Valor'}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={voiceDraft.amount}
                      onChange={(event) =>
                        setVoiceDraft((current) =>
                          current ? { ...current, amount: Number(event.target.value) } : current
                        )
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                    />
                  </label>

                  {voiceDraft.recurrenceType === 'installment' ? (
                    <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Total parcelado:{' '}
                      {formatCurrency(voiceDraft.amount * Math.max(2, voiceDraft.installmentCount))}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border/70 bg-muted/30 p-2">
                    <p className="text-xs font-medium text-foreground">Como esse lancamento entra?</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { value: 'none', label: 'Unico' },
                        { value: 'subscription', label: 'Mensal' },
                        { value: 'installment', label: 'Parcelado' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setVoiceDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    recurrenceType: option.value as VoiceTransactionDraft['recurrenceType'],
                                  }
                                : current
                            )
                          }
                          className={`h-9 rounded-lg text-sm font-medium ${
                            voiceDraft.recurrenceType === option.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card text-muted-foreground'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {voiceDraft.recurrenceType === 'installment' ? (
                      <label className="mt-2 block text-xs text-muted-foreground">
                        Parcelas
                        <input
                          type="number"
                          min="2"
                          max="120"
                          value={voiceDraft.installmentCount}
                          onChange={(event) =>
                            setVoiceDraft((current) =>
                              current
                                ? { ...current, installmentCount: Number(event.target.value) }
                                : current
                            )
                          }
                          className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                        />
                      </label>
                    ) : null}

                    {voiceDraft.dayOfMonth ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Dia de pagamento/vencimento entendido: {voiceDraft.dayOfMonth}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSaveVoiceDraft()}
                    disabled={isSavingVoiceDraft}
                    className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {isSavingVoiceDraft ? 'Salvando...' : 'Confirmar e salvar'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <MonthSwitcher
            selectedMonth={selectedMonth}
            onChange={handleMonthChange}
            className="mt-4"
          />

          <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar lancamento"
                className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => setShowFilters((current) => !current)}
                className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg ${
                  showFilters ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
                aria-label="Mostrar filtros"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
              <div className="min-w-[112px] rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Entradas</p>
                <p className="mt-0.5 text-sm font-semibold text-income">
                  {formatCurrency(summary.income)}
                </p>
              </div>
              <div className="min-w-[112px] rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Saidas</p>
                <p className="mt-0.5 text-sm font-semibold text-expense">
                  {formatCurrency(summary.expense)}
                </p>
              </div>
              <div
                className={`min-w-[112px] rounded-xl border bg-background px-3 py-2 ${
                  summary.balance >= 0
                    ? 'border-border'
                    : 'border-expense/30'
                }`}
              >
                <p className="text-[11px] text-muted-foreground">Saldo</p>
                <p
                  className={`mt-0.5 text-sm font-semibold ${
                    summary.balance >= 0 ? 'text-primary' : 'text-expense'
                  }`}
                >
                  {formatCurrency(summary.balance)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 xl:hidden">
            <button
              type="button"
              onClick={() => setShowCyclePicker((current) => !current)}
              className="flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3 text-left text-sm font-medium text-foreground"
              aria-expanded={showCyclePicker}
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Ciclo: {cycleLabel}
              </span>
              <span className="text-xs text-muted-foreground">Alterar</span>
            </button>

            <AnimatePresence>
              {showCyclePicker ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-2 rounded-xl border border-border bg-background p-2"
                >
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, ...cycleDays].map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          void updateSettings({ cycleStartDay: day });
                          setShowCyclePicker(false);
                        }}
                        className={`h-9 rounded-lg text-xs font-medium transition-colors ${
                          settings.cycleStartDay === day
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        {day === 1 ? 'Sem' : day}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mt-3 hidden rounded-xl border border-border/60 bg-background/70 px-3 py-2 xl:block">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">Dia de vencimento do ciclo</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Opcional: use se seu mes financeiro comeca em um dia fixo, como dia 5 ou 10. Em meses curtos, dia 29, 30 ou 31 vira o ultimo dia valido.
                </p>
              </div>
            <select
              value={settings.cycleStartDay}
              onChange={(event) =>
                updateSettings({ cycleStartDay: Number(event.target.value) })
              }
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground sm:w-40"
              aria-label="Dia de fechamento do mes"
            >
                <option value={1}>Sem ajuste</option>
              {cycleDays.map((day) => (
                <option key={day} value={day}>
                  Dia {day}
                </option>
              ))}
            </select>
            </div>
          </div>
        </div>
      </header>

      <main className="app-content space-y-4 py-5 sm:space-y-5 sm:py-6">
        <AnimatePresence>
          {showFilters && (
            <motion.section
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl border border-border bg-card p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Filtros</p>
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterStatus('all');
                    setFilterCategoryId('all');
                    setSearchQuery('');
                  }}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Limpar
                </button>
              </div>

              <div className="grid gap-2 xl:grid-cols-[1fr_1fr_180px]">
                <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
                  {(['all', 'income', 'expense'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`h-8 flex-1 rounded-lg px-2 text-xs font-medium transition-colors ${
                        filterType === type
                          ? type === 'income'
                            ? 'bg-income text-white'
                            : type === 'expense'
                            ? 'bg-expense text-white'
                            : 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {type === 'all'
                        ? 'Todos'
                        : type === 'income'
                        ? 'Receitas'
                        : 'Despesas'}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
                  {(['all', 'completed', 'pending'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`h-8 flex-1 rounded-lg px-2 text-xs font-medium transition-colors ${
                        filterStatus === status
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {status === 'all'
                        ? 'Todos'
                        : status === 'completed'
                        ? 'Concluidos'
                        : 'Pendentes'}
                    </button>
                  ))}
                </div>

                <select
                  value={filterCategoryId}
                  onChange={(event) => setFilterCategoryId(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground"
                >
                  <option value="all">Categorias</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {filteredTransactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-dashed border-border bg-card p-8 text-center"
          >
            <WalletCards className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Lista vazia</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou cadastre uma nova movimentacao para preencher o mes.
            </p>
          </motion.div>
        ) : (
          <>
            <section className="space-y-2 xl:hidden">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-sm font-semibold text-foreground">Lancamentos do mes</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {filteredTransactions.length} item
                    {filteredTransactions.length === 1 ? '' : 's'} no filtro atual
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {filteredTransactions.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    onEdit={setEditTransaction}
                  />
                ))}
              </div>
            </section>

            <section className="hidden gap-3 pb-2 xl:grid xl:grid-cols-3 xl:overflow-visible">
              {kanbanColumns.map((column, index) => (
                <motion.div
                  key={column.id}
                  onDragEnter={() => setDropTargetColumn(column.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropTargetColumn(column.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDropTargetColumn((current) =>
                        current === column.id ? null : current
                      );
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleDropOnColumn(column.id);
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`min-h-[320px] rounded-2xl border bg-card p-2.5 transition-colors ${
                    dropTargetColumn === column.id
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className={`rounded-xl border px-3 py-3 ${column.tone}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-foreground">{column.title}</p>
                        <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
                          {column.description}
                        </p>
                      </div>
                      <span className="rounded-full bg-background/70 px-3 py-1 text-sm font-medium text-foreground">
                        {column.count}
                      </span>
                    </div>
                    <p className="mt-4 text-xl font-semibold text-foreground">
                      {formatCurrency(column.total)}
                    </p>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {column.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                        {column.empty}
                      </div>
                    ) : (
                      column.items.map((transaction) => (
                        <TransactionCard
                          key={transaction.id}
                          transaction={transaction}
                          onEdit={setEditTransaction}
                          compact
                          draggable
                          isDragging={draggingTransactionId === transaction.id}
                          onDragStart={(item) => setDraggingTransactionId(item.id)}
                          onDragEnd={() => {
                            setDraggingTransactionId(null);
                            setDropTargetColumn(null);
                          }}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              ))}
            </section>
          </>
        )}
      </main>

      <BottomNav />

      <TransactionForm
        isOpen={isFormOpen || !!editTransaction}
        onClose={() => {
          setIsFormOpen(false);
          setEditTransaction(null);
        }}
        editTransaction={editTransaction}
        defaultType={defaultType}
      />

      <TransactionUpdateModal
        isOpen={Boolean(pendingDragTransaction)}
        onClose={() => {
          if (isResolvingDragScope) return;
          setPendingDragTransaction(null);
          setPendingDragUpdates(null);
        }}
        onConfirm={handleDragScopeConfirm}
        transactionTitle={pendingDragTransaction?.title || ''}
        isSubmitting={isResolvingDragScope}
      />
    </div>
  );
};

export default Transactions;
