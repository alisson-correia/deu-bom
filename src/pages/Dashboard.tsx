import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, Loader2, Mic, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { usePageVoice } from '@/components/VoiceProvider';
import { parseVoiceCommand, type ParsedVoiceCommand } from '@/services/voiceCommandParser';
import { BottomNav } from '@/components/BottomNav';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionCard } from '@/components/TransactionCard';
import { TransactionForm } from '@/components/TransactionForm';
import { useCategories, useFinanceLoading, useFinanceStore, useTransactions } from '@/stores/financeStore';
import { filterTransactionsByMonth, sortTransactionsByDateDesc, summarizeTransactions } from '@/utils/transactionInsights';
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

  useEffect(() => { if (!initialized) initialize(); }, [initialize, initialized]);

  const monthlyTransactions = useMemo(() => filterTransactionsByMonth(transactions, selectedMonth), [transactions, selectedMonth]);
  const summary = useMemo(() => summarizeTransactions(monthlyTransactions), [monthlyTransactions]);
  const recentTransactions = useMemo(() => sortTransactionsByDateDesc(monthlyTransactions).slice(0, 4), [monthlyTransactions]);
  const topCategory = useMemo(() => {
    const totals = monthlyTransactions.filter((item) => item.type === 'expense' && item.status === 'completed')
      .reduce<Record<string, number>>((totals, item) => { totals[item.categoryId] = (totals[item.categoryId] || 0) + item.amount; return totals; }, {});
    const [id, amount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || [];
    return id ? { category: categories.find((item) => item.id === id), amount } : null;
  }, [categories, monthlyTransactions]);

  const { isSupported, isListening, lastTranscript } = usePageVoice({
    onTranscript: (text) => {
      const command = parseVoiceCommand(text, { preferredKind: 'transaction' });
      if (!command || command.kind !== 'transaction') { toast.error('Não entendi o lançamento. Diga “despesa mercado 35,90 reais” ou preencha manualmente.'); return; }
      setVoiceDraft(command); setDefaultType(command.type); setEditTransaction(null); setIsFormOpen(true);
    },
  });

  const handleAddTransaction = (type: TransactionType) => {
    setVoiceDraft(null); setDefaultType(type); setEditTransaction(null); setIsFormOpen(true);
  };
  const handleMonthChange = (direction: number) => {
    setSelectedMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + direction, 1));
  };

  if (loadError) return <div className="min-h-screen bg-background p-6 xl:ml-[88px]"><div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-5"><p>{loadError}</p><button type="button" className="touch-btn mt-4 rounded-xl border border-border px-4" onClick={() => void initialize()}>Tentar novamente</button></div><BottomNav /></div>;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-center"><Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" /><p className="text-muted-foreground">Carregando painel...</p></div></div>;

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--app-bottom-nav-height,0px)+1rem+env(safe-area-inset-bottom,0px))] xl:pl-[var(--app-sidebar-width,88px)]">
      <main className="app-content space-y-5 py-5 sm:py-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <MonthSwitcher selectedMonth={selectedMonth} onChange={handleMonthChange} className="gap-3 sm:w-72" />
        </header>

        <section aria-label="Resumo do mês" className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="bg-primary/5 px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-sm font-medium text-muted-foreground">Saldo confirmado</p>
            <p className={`dashboard-balance mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl ${summary.completedBalance < 0 ? 'text-expense' : summary.completedBalance > 0 ? 'text-income' : 'text-primary'}`}>
              {formatCurrency(summary.completedBalance)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Receitas recebidas menos despesas pagas neste mês.</p>
          </div>
          <dl className="grid grid-cols-2 divide-x divide-border border-t border-border">
            <div className="min-w-0 px-4 py-4 sm:px-6">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />A pagar</dt>
              <dd className="mt-1 break-words text-base font-semibold text-expense sm:text-lg">{formatCurrency(summary.pendingExpense)}</dd>
            </div>
            <div className="min-w-0 px-4 py-4 sm:px-6">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />A receber</dt>
              <dd className="mt-1 break-words text-base font-semibold text-income sm:text-lg">{formatCurrency(summary.pendingIncome)}</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Adicionar lançamento" className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {(['expense', 'income'] as const).map((type) => <button
              key={type} type="button" aria-label={type === 'expense' ? 'Nova despesa' : 'Nova receita'}
              aria-pressed={isFormOpen && defaultType === type} onClick={() => handleAddTransaction(type)}
              className="new-transaction-button inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />{type === 'expense' ? 'Despesa' : 'Receita'}
            </button>)}

          </div>
          {isListening && <p role="status" className="text-sm text-primary">Ouvindo… Toque no microfone do cabeçalho para parar.</p>}
          {lastTranscript && <p role="status" className="break-words text-sm text-muted-foreground">Ouvi: {lastTranscript}</p>}
          <details className="text-xs text-muted-foreground">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mic aria-hidden="true" className="h-3.5 w-3.5" />Como usar a voz<ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /></summary>
            <p className="max-w-xl pb-2 leading-6">{isSupported ? 'Diga “despesa mercado 35,90 reais”, “recebi salário 2000 reais” ou “tema escuro”. Você revisa os dados antes de salvar. Use o microfone no cabeçalho; ele só inicia ao tocar no botão; o navegador pode processar o áudio online.' : 'Voz indisponível neste navegador. Use os botões Despesa e Receita para registrar manualmente.'}</p>
          </details>
        </section>

        {summary.completedBalance < 0 && <p className="rounded-xl border border-expense/30 bg-expense/5 px-4 py-3 text-sm leading-6"><span className="font-medium text-expense">Saldo negativo.</span> Confira as pendências antes de assumir novos compromissos.</p>}

        <section aria-labelledby="recent-movements" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-movements" className="text-base font-semibold">Últimos movimentos</h2>
            <Link to="/transactions" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver todos<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium">Nenhum lançamento neste mês</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Use Despesa, Receita ou o microfone para começar.</p>
            </div>
          ) : <div className="space-y-3">{recentTransactions.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} onEdit={setEditTransaction} />)}</div>}
        </section>

        {monthlyTransactions.length > 0 && <details className="group rounded-2xl border border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
            Mais detalhes do mês<ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-border p-4 sm:p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Saldo projetado</dt><dd className="mt-1 break-words text-lg font-semibold">{formatCurrency(summary.balance)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Lançamentos</dt><dd className="mt-1 text-lg font-semibold">{monthlyTransactions.length}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Pendências</dt><dd className="mt-1 text-lg font-semibold">{summary.pendingCount}</dd></div>
            </dl>
            <p className="text-xs leading-5 text-muted-foreground">O saldo projetado considera todos os lançamentos do mês, incluindo os pendentes.</p>
            {topCategory?.category && <p className="text-sm leading-6"><span className="text-muted-foreground">Maior despesa por categoria: </span>{topCategory.category.name} · {formatCurrency(topCategory.amount)} em pagamentos concluídos.</p>}
            <Link to="/analytics" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir análise completa<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </details>}
      </main>
      <BottomNav />
      <TransactionForm isOpen={isFormOpen || !!editTransaction} onClose={() => { setVoiceDraft(null); setIsFormOpen(false); setEditTransaction(null); }} editTransaction={editTransaction} defaultType={defaultType} initialDraft={voiceDraft} />
    </div>
  );
};
export default Dashboard;
