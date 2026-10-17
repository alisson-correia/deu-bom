import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { parseVoiceCommand, type ParsedVoiceCommand } from '@/services/voiceCommandParser';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionCard } from '@/components/TransactionCard';
import { TransactionForm } from '@/components/TransactionForm';
import {
  useCategories,
  useFinanceLoading,
  useFinanceStore,
  useTransactions,
} from '@/stores/financeStore';
import {
  filterTransactionsByMonth,
  sortTransactionsByDateDesc,
  summarizeTransactions,
} from '@/utils/transactionInsights';
import { formatCurrency } from '@/utils/currency';
import type { Transaction, TransactionType } from '@/types/finance';

const Dashboard: React.FC = () => {
  const [voiceDraft, setVoiceDraft] = useState<Extract<ParsedVoiceCommand, { kind: 'transaction' }> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [defaultType, setDefaultType] = useState<TransactionType>('expense');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const transactions = useTransactions();
  const categories = useCategories();
  const loading = useFinanceLoading();
  const initialize = useFinanceStore((state) => state.initialize);
  const loadError = useFinanceStore((state) => state.loadError);
  const initialized = useFinanceStore((state) => state.initialized);

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialize, initialized]);

  const monthlyTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const summary = useMemo(
    () => summarizeTransactions(monthlyTransactions),
    [monthlyTransactions]
  );

  const recentTransactions = useMemo(
    () => sortTransactionsByDateDesc(monthlyTransactions).slice(0, 4),
    [monthlyTransactions]
  );

  const pendingExpenses = useMemo(
    () =>
      monthlyTransactions.filter(
        (transaction) =>
          transaction.type === 'expense' && transaction.status === 'pending'
      ),
    [monthlyTransactions]
  );

  const pendingIncome = useMemo(
    () =>
      monthlyTransactions.filter(
        (transaction) =>
          transaction.type === 'income' && transaction.status === 'pending'
      ),
    [monthlyTransactions]
  );

  const pendingExpenseTotal = useMemo(
    () =>
      pendingExpenses.reduce(
        (total, transaction) => total + transaction.amount,
        0
      ),
    [pendingExpenses]
  );

  const pendingIncomeTotal = useMemo(
    () =>
      pendingIncome.reduce((total, transaction) => total + transaction.amount, 0),
    [pendingIncome]
  );

  const topCategory = useMemo(() => {
    const totals = monthlyTransactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' && transaction.status === 'completed'
      )
      .reduce<Record<string, number>>((accumulator, transaction) => {
        accumulator[transaction.categoryId] =
          (accumulator[transaction.categoryId] || 0) + transaction.amount;
        return accumulator;
      }, {});

    const [categoryId, amount] =
      Object.entries(totals).sort((first, second) => second[1] - first[1])[0] || [];

    if (!categoryId || !amount) {
      return null;
    }

    return {
      category: categories.find((item) => item.id === categoryId),
      amount,
    };
  }, [categories, monthlyTransactions]);

  const { isSupported, isListening, lastTranscript, startListening, stopListening } = useVoiceCommand({
    onTranscript: (text) => {
      const command = parseVoiceCommand(text, { preferredKind: 'transaction' });
      if (!command || command.kind !== 'transaction') { toast.error('Não entendi o lançamento. Diga “despesa mercado 35,90 reais” ou preencha manualmente.'); return; }
      setVoiceDraft(command); setDefaultType(command.type); setEditTransaction(null); setIsFormOpen(true);
      toast.info('Revise os dados reconhecidos antes de salvar.');
    },
  });

  const handleAddTransaction = (type: TransactionType) => {
    setVoiceDraft(null);
    setDefaultType(type);
    setEditTransaction(null);
    setIsFormOpen(true);
  };

  const handleMonthChange = (direction: number) => {
    setSelectedMonth(
      (previous) =>
        new Date(previous.getFullYear(), previous.getMonth() + direction, 1)
    );
  };

  const nextStep = useMemo(() => {
    if (monthlyTransactions.length === 0) {
      return {
        label: 'Comece pelo basico',
        title: 'Cadastre a primeira receita ou despesa.',
        description:
          'Com poucos lancamentos o app ja mostra saldo, pendencias e o que precisa de atencao.',
      };
    }

    if (summary.completedBalance < 0) {
      return {
        label: 'Atencao ao saldo',
        title: `Seu saldo confirmado esta negativo em ${formatCurrency(Math.abs(summary.completedBalance))}.`,
        description:
          'Revise despesas, pendencias e entradas ainda nao confirmadas antes de assumir novos compromissos.',
      };
    }

    if (pendingExpenses.length > 0) {
      return {
        label: 'Proxima acao',
        title: `Voce tem ${formatCurrency(pendingExpenseTotal)} em despesas pendentes.`,
        description:
          'Atualize o que ja foi pago para manter o calculo do mes confiavel.',
      };
    }

    if (pendingIncome.length > 0) {
      return {
        label: 'Acompanhe entradas',
        title: `Ainda ha ${formatCurrency(pendingIncomeTotal)} para receber.`,
        description:
          'Confirme as entradas quando cairem para enxergar melhor a grana disponivel.',
      };
    }

    return {
      label: 'Mes em ordem',
      title: 'Seus principais lancamentos ja estao atualizados.',
      description:
        'Mantenha o habito de registrar mudancas para nao perder a visao real do mes.',
    };
  }, [
    monthlyTransactions.length,
    pendingExpenseTotal,
    pendingExpenses.length,
    pendingIncome.length,
    pendingIncomeTotal,
    summary.completedBalance,
  ]);

  const quickCards = [
    {
      label: 'Saldo confirmado',
      value: formatCurrency(summary.completedBalance),
      accent:
        summary.completedBalance >= 0
          ? 'text-income bg-income/10'
          : 'text-expense bg-expense/10',
      icon: Wallet,
    },
    {
      label: 'A pagar',
      value: formatCurrency(pendingExpenseTotal),
      accent: 'text-expense bg-expense/10',
      icon: TrendingDown,
    },
    {
      label: 'A receber',
      value: formatCurrency(pendingIncomeTotal),
      accent: 'text-income bg-income/10',
      icon: TrendingUp,
    },
  ];

  if (loadError) return <div className="min-h-screen bg-background p-6 md:ml-[88px]"><div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-5"><p>{loadError}</p><button type="button" className="touch-btn mt-4 rounded-xl border border-border px-4" onClick={() => void initialize()}>Tentar novamente</button></div><BottomNav /></div>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--app-bottom-nav-height,0px)+1rem+env(safe-area-inset-bottom,0px))] md:pl-[var(--app-sidebar-width,88px)]">
      <header className="border-b border-border/50 bg-background/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-border/60 bg-card/90 p-4 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Inicio
              </p>
              <h1 className="text-2xl font-semibold">Como esta sua grana agora</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                O essencial do mes para entender saldo, pendencias e proximo passo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAddTransaction('income')}
                aria-pressed={isFormOpen && defaultType === 'income'}
                className="new-transaction-button touch-btn rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
              >
                Nova receita
              </button>
              <button
                onClick={() => handleAddTransaction('expense')}
                aria-pressed={isFormOpen && defaultType === 'expense'}
                className="new-transaction-button touch-btn rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
              >
                Nova despesa
              </button>
            </div>
          </div>

          <MonthSwitcher
            selectedMonth={selectedMonth}
            onChange={handleMonthChange}
            className="mt-5"
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section aria-label="Assistente por voz" className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><h2 className="font-semibold">Use sua voz</h2><p className="text-sm text-muted-foreground">Prepare um lançamento ou diga “tema escuro”. Você revisa antes de salvar.</p></div>
            <button type="button" disabled={!isSupported} aria-pressed={isListening} onClick={isListening ? stopListening : startListening} className="touch-btn inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium disabled:opacity-50">
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{isListening ? 'Parar microfone' : 'Falar com o app'}
            </button>
          </div>
          {!isSupported && <p className="mt-2 text-sm text-muted-foreground">Voz indisponível neste navegador. Use Nova receita ou Nova despesa.</p>}
          {lastTranscript && <p className="mt-2 text-sm" role="status">Ouvi: {lastTranscript}</p>}
          <details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer py-2">Como usar a voz</summary><p>Diga “despesa mercado 35,90 reais”, “recebi salário 2000 reais”, “tema claro” ou “tema do sistema”. O microfone só inicia ao tocar no botão; o navegador pode processar o áudio online.</p></details>
        </section>
        <section className="grid gap-3 md:grid-cols-3">
          {quickCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <span className={`rounded-full p-2 ${card.accent}`}>
                  <card.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-foreground">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {nextStep.label}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{nextStep.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {nextStep.description}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm font-medium text-muted-foreground">Pendencias</p>
                <p className="mt-2 text-2xl font-semibold">{summary.pendingCount}</p>
              </div>

              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm font-medium text-muted-foreground">Lancamentos</p>
                <p className="mt-2 text-2xl font-semibold">{monthlyTransactions.length}</p>
              </div>

              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm font-medium text-muted-foreground">Projetado</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(summary.balance)}
                </p>
              </div>
            </div>


          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Leitura discreta
            </p>
            <h2 className="mt-1 text-xl font-semibold">Para onde a grana foi</h2>

            <div className="mt-5 rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm font-medium">Maior peso do mes</p>
                {topCategory?.category ? (
                  <>
                    <p className="mt-2 text-lg font-semibold">
                      {topCategory.category.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(topCategory.amount)} em despesas concluidas.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Quando houver despesas concluidas, o app destaca a categoria mais pesada.
                  </p>
                )}
            </div>
          </motion.div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recentes
              </p>
              <h2 className="mt-1 text-xl font-semibold">Ultimos movimentos</h2>
            </div>
            <Link to="/transactions" className="text-sm font-medium text-primary">
              Ver todos
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nada por aqui ainda</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Adicione a primeira receita ou despesa para o painel ganhar vida.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={setEditTransaction}
                />
              ))}
            </div>
          )}
        </section>
      </main>


      <BottomNav />

      <TransactionForm
        isOpen={isFormOpen || !!editTransaction}
        onClose={() => {
          setVoiceDraft(null);
          setIsFormOpen(false);
          setEditTransaction(null);
        }}
        editTransaction={editTransaction}
        defaultType={defaultType}
        initialDraft={voiceDraft}
      />
    </div>
  );
};

export default Dashboard;
