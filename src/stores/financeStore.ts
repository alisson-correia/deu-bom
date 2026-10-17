import { create } from 'zustand';
import { addMonths, addWeeks, addYears, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { z } from 'zod';
import type {
  Category,
  Budget,
  RecurrenceInterval,
  Transaction,
  UserSettings,
} from '@/types/finance';
import {
  getScopedTransactionIds,
  getTransactionSeries,
  getUniqueTransactionIds,
  validateAffectedTransactionIds,
} from '@/utils/transactionSeries';

const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'Salario', icon: 'Wallet', color: '#4b70b9', type: 'income' },
  { name: 'Freelance', icon: 'Briefcase', color: '#7560bb', type: 'income' },
  { name: 'Investimentos', icon: 'TrendingUp', color: '#9370c4', type: 'income' },
  { name: 'Outros', icon: 'Plus', color: '#06b6d4', type: 'income' },
  { name: 'Alimentacao', icon: 'Utensils', color: '#f97316', type: 'expense' },
  { name: 'Transporte', icon: 'Car', color: '#eab308', type: 'expense' },
  { name: 'Moradia', icon: 'Home', color: '#ef4444', type: 'expense' },
  { name: 'Saude', icon: 'Heart', color: '#ec4899', type: 'expense' },
  { name: 'Educacao', icon: 'GraduationCap', color: '#8b5cf6', type: 'expense' },
  { name: 'Lazer', icon: 'Gamepad2', color: '#6366f1', type: 'expense' },
  { name: 'Assinaturas', icon: 'CreditCard', color: '#a855f7', type: 'expense' },
  { name: 'Compras', icon: 'ShoppingBag', color: '#d946ef', type: 'expense' },
];

const defaultSettings: UserSettings = {
  cycleStartDay: 1,
  currency: 'BRL',
  locale: 'pt-BR',
  notificationsEnabled: true,
};

interface FinanceSnapshot {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  settings: UserSettings;
}

interface FinanceState extends FinanceSnapshot {
  loading: boolean;
  initialized: boolean;
  loadError: string | null;
  snapshotGeneration: number;
  scopeReady: boolean;
  resetScope: (ready?: boolean) => void;

  initialize: () => Promise<void>;
  refreshData: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateTransaction: (
    id: string,
    updates: Partial<Transaction>,
    updateFuture?: boolean,
    updateAll?: boolean
  ) => Promise<boolean>;
  deleteTransaction: (id: string, deleteFuture?: boolean, deleteAll?: boolean) => Promise<boolean>;
  toggleTransactionStatus: (id: string) => Promise<void>;

  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  setBudget: (categoryId: string, limit: number) => Promise<boolean>;
  removeBudget: (categoryId: string) => Promise<void>;

  updateSettings: (settings: Partial<UserSettings>) => Promise<boolean>;

  exportData: () => string;
  importData: (data: string) => Promise<boolean>;

  generateInstallments: (baseTransaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>, count: number) => Promise<void>;
  generateRecurringTransactions: (
    baseTransaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    count: number,
    interval: 'weekly' | 'monthly' | 'yearly',
    splitAmount: boolean
  ) => Promise<boolean>;
  replaceTransactionWithRecurringTransactions: (
    id: string,
    baseTransaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    count: number,
    interval: RecurrenceInterval,
    splitAmount: boolean
  ) => Promise<boolean>;
}

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type CategoryRow = Database['public']['Tables']['categories']['Row'];
type BudgetRow = Database['public']['Tables']['budgets']['Row'];

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  title: row.title,
  amount: Number(row.amount),
  type: row.type as 'income' | 'expense',
  status: row.status as 'pending' | 'completed',
  categoryId: row.category_id || '',
  date: row.date,
  notes: row.notes || undefined,
  recurrenceType: row.recurrence_type as 'none' | 'installment' | 'subscription',
  installmentNumber: row.installment_number || undefined,
  totalInstallments: row.total_installments || undefined,
  parentTransactionId: row.parent_transaction_id || undefined,
  groupId: row.group_id || undefined,
  recurrenceInterval: row.recurrence_interval as 'weekly' | 'monthly' | 'yearly' | undefined,
  recurrenceEndDate: row.recurrence_end_date || undefined,
  notify: row.notify,
  calendarEventId: row.calendar_event_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  type: row.type as 'income' | 'expense',
  budgetLimit: row.budget_limit ? Number(row.budget_limit) : undefined,
});

const toBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  categoryId: row.category_id,
  limit: Number(row.limit_amount),
  period: row.period as 'monthly' | 'weekly',
  spent: 0,
});

const buildDbTransactionUpdates = (updates: Partial<Transaction>) => {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId || null;
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
  if (updates.notify !== undefined) dbUpdates.notify = updates.notify;
  if (updates.recurrenceType !== undefined) dbUpdates.recurrence_type = updates.recurrenceType;
  if (updates.recurrenceInterval !== undefined) dbUpdates.recurrence_interval = updates.recurrenceInterval || null;
  if (updates.recurrenceEndDate !== undefined) dbUpdates.recurrence_end_date = updates.recurrenceEndDate || null;
  if (updates.installmentNumber !== undefined) dbUpdates.installment_number = updates.installmentNumber || null;
  if (updates.totalInstallments !== undefined) dbUpdates.total_installments = updates.totalInstallments || null;
  if (updates.parentTransactionId !== undefined) dbUpdates.parent_transaction_id = updates.parentTransactionId || null;
  if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId || null;

  if (updates.recurrenceType === 'none') {
    dbUpdates.recurrence_interval = null;
    dbUpdates.recurrence_end_date = null;
    dbUpdates.installment_number = null;
    dbUpdates.total_installments = null;
    dbUpdates.parent_transaction_id = null;
    dbUpdates.group_id = null;
  }

  if (updates.recurrenceType === 'subscription') {
    dbUpdates.installment_number = null;
    dbUpdates.total_installments = null;
    dbUpdates.parent_transaction_id = null;
  }

  return dbUpdates;
};

const addDateByInterval = (
  date: Date,
  index: number,
  interval: 'weekly' | 'monthly' | 'yearly'
): Date => {
  switch (interval) {
    case 'weekly':
      return addWeeks(date, index);
    case 'monthly':
      return addMonths(date, index);
    case 'yearly':
      return addYears(date, index);
    default:
      return addMonths(date, index);
  }
};

const subtractDateByInterval = (
  date: Date,
  index: number,
  interval: 'weekly' | 'monthly' | 'yearly'
): Date => addDateByInterval(date, index * -1, interval);

const resolveSeriesInterval = (
  transaction: Transaction,
  updates: Partial<Transaction>
): 'weekly' | 'monthly' | 'yearly' => {
  if (updates.recurrenceInterval) {
    return updates.recurrenceInterval;
  }

  if (transaction.recurrenceInterval) {
    return transaction.recurrenceInterval;
  }

  return transaction.recurrenceType === 'installment' ? 'monthly' : 'monthly';
};

const loadFinanceSnapshot = async (isCurrent: () => boolean): Promise<FinanceSnapshot | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isCurrent()) return null;
  if (!user) {
    return {
      transactions: [],
      categories: [],
      budgets: [],
      settings: defaultSettings,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!isCurrent()) return null;
  if (profileError) throw profileError;
  const workspaceId = profile?.current_workspace_id;

  let categoriesQuery = supabase.from('categories').select('*');
  let transactionsQuery = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  let budgetsQuery = supabase.from('budgets').select('*');

  if (workspaceId) {
    categoriesQuery = categoriesQuery.eq('workspace_id', workspaceId);
    transactionsQuery = transactionsQuery.eq('workspace_id', workspaceId);
    budgetsQuery = budgetsQuery.eq('workspace_id', workspaceId);
  } else {
    categoriesQuery = categoriesQuery.eq('user_id', user.id).is('workspace_id', null);
    transactionsQuery = transactionsQuery.eq('user_id', user.id).is('workspace_id', null);
    budgetsQuery = budgetsQuery.eq('user_id', user.id).is('workspace_id', null);
  }

  const categoryResult = await categoriesQuery;
  if (!isCurrent()) return null;
  if (categoryResult.error) throw categoryResult.error;
  let categories = categoryResult.data;

  if (!categories || categories.length === 0) {
    const categoriesToInsert = defaultCategories.map((category) => ({
      ...category,
      user_id: user.id,
      workspace_id: workspaceId || null,
    }));

    const { data: createdCategories, error: categoriesError } = await supabase
      .from('categories')
      .insert(categoriesToInsert)
      .select();

    if (categoriesError) {
      throw categoriesError;
    }

    categories = createdCategories || [];
  }

  const [{ data: transactions, error: transactionsError }, { data: budgets, error: budgetsError }] =
    await Promise.all([transactionsQuery, budgetsQuery]);

  if (transactionsError) throw transactionsError;
  if (budgetsError) throw budgetsError;

  return {
    settings: profile
      ? {
          cycleStartDay: profile.cycle_start_day,
          currency: profile.currency,
          locale: profile.locale,
          notificationsEnabled: profile.notifications_enabled,
        }
      : defaultSettings,
    categories: (categories || []).map(toCategory),
    transactions: (transactions || []).map(toTransaction),
    budgets: (budgets || []).map(toBudget),
  };
};

const applySnapshot = (
  set: (partial: Partial<FinanceState>) => void,
  snapshot: FinanceSnapshot
) => {
  set({
    ...snapshot,
    loadError: null,
    loading: false,
    initialized: true,
  });
};

const getFinanceErrorMessage = (error: unknown, fallback: string) => {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : '';

  if (/permission|policy|rls|not authorized|unauthorized|denied/i.test(message)) {
    return 'Nao foi possivel concluir: verifique sua permissao neste workspace.';
  }

  if (/network|fetch|timeout|connection/i.test(message)) {
    return 'Nao foi possivel sincronizar agora. Verifique a conexao e tente novamente.';
  }

  return fallback;
};

const initializeRequests = new Map<number, Promise<void>>();

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  categories: [],
  budgets: [],
  settings: defaultSettings,
  loading: true,
  initialized: false,
  loadError: null,
  snapshotGeneration: 0,
  scopeReady: true,

  resetScope: (ready = true) => {
    set({
      snapshotGeneration: get().snapshotGeneration + 1,
      scopeReady: ready,
      transactions: [],
      categories: [],
      budgets: [],
      settings: { ...defaultSettings },
      initialized: false,
      loading: true,
      loadError: null,
    });
  },

  initialize: async () => {
    if (!get().scopeReady) return;
    const generation = get().snapshotGeneration;
    const existing = initializeRequests.get(generation);
    if (existing) return existing;
    const isCurrent = () => get().snapshotGeneration === generation && get().scopeReady;
    set({ loading: true, loadError: null });
    const operation = (async () => {
      try {
        const snapshot = await loadFinanceSnapshot(isCurrent);
        if (!isCurrent()) return;
        if (snapshot) applySnapshot(set, snapshot);
        else set({ loading: false, initialized: true });
      } catch (error) {
        if (!isCurrent()) return;
        console.error('Failed to initialize finance store:', error);
        toast.error(getFinanceErrorMessage(error, 'Nao foi possivel carregar seus dados financeiros.'));
        set({ loading: false, initialized: true, loadError: 'Não foi possível carregar seus dados. Tente novamente.' });
      } finally {
        initializeRequests.delete(generation);
      }
    })();
    initializeRequests.set(generation, operation);
    return operation;
  },

  refreshData: async () => {
    if (!get().scopeReady) return;
    const generation = get().snapshotGeneration;
    const isCurrent = () => get().snapshotGeneration === generation && get().scopeReady;
    try {
      const snapshot = await loadFinanceSnapshot(isCurrent);
      if (snapshot && isCurrent()) applySnapshot(set, snapshot);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('Failed to refresh finance data:', error);
      toast.error(getFinanceErrorMessage(error, 'Nao foi possivel sincronizar os dados.'));
      set({ loadError: 'Não foi possível atualizar. Os dados exibidos podem estar desatualizados.' });
    }
  },

  addTransaction: async (transaction) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      workspace_id: profile?.current_workspace_id || null,
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      category_id: transaction.categoryId || null,
      date: transaction.date,
      notes: transaction.notes || null,
      recurrence_type: transaction.recurrenceType,
      installment_number: transaction.installmentNumber || null,
      total_installments: transaction.totalInstallments || null,
      parent_transaction_id: transaction.parentTransactionId || null,
      group_id: transaction.groupId || null,
      recurrence_interval: transaction.recurrenceInterval || null,
      recurrence_end_date: transaction.recurrenceEndDate || null,
      notify: transaction.notify,
    });

    if (error) {
      console.error('Failed to add transaction:', error);
      toast.error(getFinanceErrorMessage(error, 'Nao foi possivel salvar a transacao.'));
      return false;
    }

    await get().refreshData();
    return true;
  },

  updateTransaction: async (id, updates, updateFuture = false, updateAll = false) => {
    const transaction = get().transactions.find((item) => item.id === id);
    if (!transaction) return false;

    const scope = updateAll ? 'all' : updateFuture ? 'future' : 'single';
    const dbUpdates = buildDbTransactionUpdates(updates);
    const hasSeriesDateChange =
      scope !== 'single' &&
      (updates.date !== undefined || updates.recurrenceInterval !== undefined);

    if (hasSeriesDateChange) {
      const relatedTransactions = getTransactionSeries(get().transactions, transaction);
      const targetIndex = relatedTransactions.findIndex((item) => item.id === transaction.id);
      const scopedTransactions =
        scope === 'all'
          ? relatedTransactions.map((item, index) => ({ item, index }))
          : relatedTransactions
              .slice(targetIndex >= 0 ? targetIndex : 0)
              .map((item, index) => ({
                item,
                index: (targetIndex >= 0 ? targetIndex : 0) + index,
              }));
      const anchorDate = parseISO(updates.date ?? transaction.date);
      const interval = resolveSeriesInterval(transaction, updates);
      const updatedIds: string[] = [];

      for (const { item, index } of scopedTransactions) {
        const relativeIndex = index - (targetIndex >= 0 ? targetIndex : 0);
        const scopedDate = format(
          relativeIndex >= 0
            ? addDateByInterval(anchorDate, relativeIndex, interval)
            : subtractDateByInterval(anchorDate, Math.abs(relativeIndex), interval),
          'yyyy-MM-dd'
        );
        const scopedUpdates = {
          ...dbUpdates,
          date: scopedDate,
          recurrence_interval: interval,
        };

        const { data, error } = await supabase
          .from('transactions')
          .update(scopedUpdates)
          .eq('id', item.id)
          .select('id');

        if (error) {
          console.error('Failed to update recurring transaction series:', error);
          toast.error(getFinanceErrorMessage(error, 'Nao foi possivel atualizar a serie da transacao.'));
          return false;
        }

        if (!data || data.length !== 1 || data[0].id !== item.id) {
          console.error('Recurring update touched an unexpected set of records.', {
            expectedId: item.id,
            returned: data,
          });
          toast.error('A atualizacao nao foi aplicada com seguranca na serie.');
          return false;
        }

        updatedIds.push(item.id);
      }

      const validation = validateAffectedTransactionIds(
        scopedTransactions.map(({ item }) => item.id),
        updatedIds
      );

      if (!validation.ok) {
        console.error('Recurring update count mismatch.', {
          expectedIds: validation.expectedIds,
          updatedIds: validation.affectedIds,
        });
        toast.error('A serie nao foi sincronizada com seguranca. Recarregue e tente novamente.');
        return false;
      }

      await get().refreshData();
      return true;
    }

    const ids = getUniqueTransactionIds(
      getScopedTransactionIds(get().transactions, transaction, scope)
    );

    if (ids.length === 0) {
      toast.error('Nenhum card valido foi encontrado para atualizar.');
      return false;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(dbUpdates)
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Failed to update transaction:', error);
      toast.error(getFinanceErrorMessage(error, 'Nao foi possivel atualizar a transacao.'));
      return false;
    }

    const validation = validateAffectedTransactionIds(
      ids,
      (data || []).map((item) => item.id)
    );

    if (!validation.ok) {
      console.error('Update affected an unexpected number of records.', {
        expectedIds: validation.expectedIds,
        updatedIds: validation.affectedIds,
      });
      toast.error('A atualizacao nao foi sincronizada com seguranca. Recarregue e tente novamente.');
      return false;
    }

    await get().refreshData();
    return true;
  },

  deleteTransaction: async (id, deleteFuture = false, deleteAll = false) => {
    const transaction = get().transactions.find((item) => item.id === id);
    if (!transaction) return false;

    const scope = deleteAll ? 'all' : deleteFuture ? 'future' : 'single';
    const ids = getUniqueTransactionIds(
      getScopedTransactionIds(get().transactions, transaction, scope)
    );

    if (ids.length === 0) {
      toast.error('Nenhum card valido foi encontrado para excluir.');
      return false;
    }

    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Failed to delete transaction:', error);
      toast.error(getFinanceErrorMessage(error, 'Nao foi possivel excluir a transacao.'));
      return false;
    }

    const validation = validateAffectedTransactionIds(
      ids,
      (data || []).map((item) => item.id)
    );

    if (!validation.ok) {
      console.error('Delete affected an unexpected number of records.', {
        expectedIds: validation.expectedIds,
        deletedIds: validation.affectedIds,
      });
      toast.error('A exclusao nao foi sincronizada com seguranca. Recarregue e tente novamente.');
      return false;
    }

    await get().refreshData();
    return true;
  },

  toggleTransactionStatus: async (id) => {
    const transaction = get().transactions.find((item) => item.id === id);
    if (!transaction) return;

    const newStatus = transaction.status === 'completed' ? 'pending' : 'completed';
    await get().updateTransaction(id, { status: newStatus });
  },

  addCategory: async (category) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      workspace_id: profile?.current_workspace_id || null,
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
      budget_limit: category.budgetLimit || null,
    });

    if (error) {
      console.error('Failed to add category:', error);
      toast.error('Nao foi possivel criar a categoria.');
      return;
    }

    await get().refreshData();
  },

  updateCategory: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.budgetLimit !== undefined) dbUpdates.budget_limit = updates.budgetLimit;

    const { error } = await supabase
      .from('categories')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Failed to update category:', error);
      toast.error('Nao foi possivel atualizar a categoria.');
      return;
    }

    await get().refreshData();
  },

  deleteCategory: async (id) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete category:', error);
      toast.error('Nao foi possivel excluir a categoria.');
      return;
    }

    await get().refreshData();
  },

  setBudget: async (categoryId, limit) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    const existingBudget = get().budgets.find((budget) => budget.categoryId === categoryId);

    if (existingBudget) {
      const { error } = await supabase
        .from('budgets')
        .update({ limit_amount: limit })
        .eq('id', existingBudget.id);

      if (error) {
        console.error('Failed to update budget:', error);
        toast.error('Nao foi possivel atualizar o orcamento.');
        return false;
      }
    } else {
      const { error } = await supabase.from('budgets').insert({
        user_id: user.id,
        workspace_id: profile?.current_workspace_id || null,
        category_id: categoryId,
        limit_amount: limit,
        period: 'monthly',
      });

      if (error) {
        console.error('Failed to create budget:', error);
        toast.error('Nao foi possivel criar o orcamento.');
        return false;
      }
    }

    await get().refreshData();
    return true;
  },

  removeBudget: async (categoryId) => {
    const budget = get().budgets.find((item) => item.categoryId === categoryId);
    if (!budget) return;

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budget.id);

    if (error) {
      console.error('Failed to remove budget:', error);
      toast.error('Nao foi possivel remover o orcamento.');
      return;
    }

    await get().refreshData();
  },

  updateSettings: async (newSettings) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const dbUpdates: Record<string, unknown> = {};
    if (newSettings.cycleStartDay !== undefined) dbUpdates.cycle_start_day = newSettings.cycleStartDay;
    if (newSettings.currency !== undefined) dbUpdates.currency = newSettings.currency;
    if (newSettings.locale !== undefined) dbUpdates.locale = newSettings.locale;
    if (newSettings.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = newSettings.notificationsEnabled;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update settings:', error);
      toast.error('Nao foi possivel salvar as configuracoes.');
      return false;
    }

    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    return true;
  },

  exportData: () => {
    const state = get();

    return JSON.stringify(
      {
        transactions: state.transactions,
        categories: state.categories,
        budgets: state.budgets,
        settings: state.settings,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  },

  importData: async (data) => {
    const categorySchema = z.object({
      name: z.string().min(1, 'Nome da categoria e obrigatorio').max(100),
      icon: z.string().min(1).max(50).default('Circle'),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor invalida').default('#6366f1'),
      type: z.enum(['income', 'expense']),
      budgetLimit: z.number().positive().optional().nullable(),
    });

    const transactionSchema = z.object({
      title: z.string().min(1, 'Titulo e obrigatorio').max(200),
      amount: z.number().positive('Valor deve ser positivo'),
      type: z.enum(['income', 'expense']),
      status: z.enum(['pending', 'completed']).default('pending'),
      categoryId: z.string().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida'),
      notes: z.string().max(1000).optional().nullable(),
      recurrenceType: z.enum(['none', 'installment', 'subscription']).default('none'),
      notify: z.boolean().default(false),
    });

    const importSchema = z.object({
      categories: z.array(categorySchema).optional(),
      transactions: z.array(transactionSchema).optional(),
      exportedAt: z.string().optional(),
    });

    try {
      const parsed = JSON.parse(data);
      const validationResult = importSchema.safeParse(parsed);

      if (!validationResult.success) {
        console.error('Import validation failed:', validationResult.error.errors);
        toast.error(
          `Dados invalidos: ${validationResult.error.errors[0]?.message || 'Formato incorreto'}`
        );
        return false;
      }

      const validData = validationResult.data;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      if (validData.categories?.length) {
        for (const category of validData.categories) {
          await get().addCategory({
            name: category.name,
            icon: category.icon,
            color: category.color,
            type: category.type,
            budgetLimit: category.budgetLimit ?? undefined,
          });
        }
      }

      if (validData.transactions?.length) {
        for (const transaction of validData.transactions) {
          await get().addTransaction({
            title: transaction.title,
            amount: transaction.amount,
            type: transaction.type,
            status: transaction.status,
            categoryId: transaction.categoryId || '',
            date: transaction.date,
            notes: transaction.notes ?? undefined,
            recurrenceType: transaction.recurrenceType,
            notify: transaction.notify,
          });
        }
      }

      await get().refreshData();
      return true;
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar arquivo de importacao.');
      return false;
    }
  },

  generateInstallments: async (baseTransaction, count) => {
    const parentId = crypto.randomUUID();
    const amountPerInstallment = baseTransaction.amount / count;

    for (let index = 0; index < count; index += 1) {
      const date = addMonths(parseISO(baseTransaction.date), index);

      await get().addTransaction({
        ...baseTransaction,
        amount: amountPerInstallment,
        installmentNumber: index + 1,
        totalInstallments: count,
        parentTransactionId: parentId,
        title: `${baseTransaction.title} (${index + 1}/${count})`,
        date: format(date, 'yyyy-MM-dd'),
      });
    }
  },

  generateRecurringTransactions: async (baseTransaction, count, interval, splitAmount) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    const groupId = crypto.randomUUID();
    const amountPerTransaction = splitAmount ? baseTransaction.amount / count : baseTransaction.amount;
    const baseDate = parseISO(baseTransaction.date);

    const transactionsToInsert = Array.from({ length: count }, (_, index) => {
      const transactionDate = addDateByInterval(baseDate, index, interval);

      return {
        user_id: user.id,
        workspace_id: profile?.current_workspace_id || null,
        title: splitAmount
          ? `${baseTransaction.title} (${index + 1}/${count})`
          : baseTransaction.title,
        amount: amountPerTransaction,
        type: baseTransaction.type,
        status: baseTransaction.status,
        category_id: baseTransaction.categoryId || null,
        date: format(transactionDate, 'yyyy-MM-dd'),
        notes: baseTransaction.notes || null,
        recurrence_type: baseTransaction.recurrenceType,
        installment_number: splitAmount ? index + 1 : null,
        total_installments: splitAmount ? count : null,
        parent_transaction_id: null,
        group_id: groupId,
        recurrence_interval: interval,
        recurrence_end_date: baseTransaction.recurrenceEndDate || null,
        notify: baseTransaction.notify,
      };
    });

    const { error } = await supabase
      .from('transactions')
      .insert(transactionsToInsert);

    if (error) {
      console.error('Failed to insert recurring transactions:', error);
      toast.error('Erro ao salvar transacoes recorrentes.');
      return false;
    }

    await get().refreshData();
    return true;
  },

  replaceTransactionWithRecurringTransactions: async (
    id,
    baseTransaction,
    count,
    interval,
    splitAmount
  ) => {
    const transaction = get().transactions.find((item) => item.id === id);
    if (!transaction) return false;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    const groupId = transaction.groupId || crypto.randomUUID();
    const amountPerTransaction = splitAmount
      ? baseTransaction.amount / count
      : baseTransaction.amount;
    const baseDate = parseISO(baseTransaction.date);

    const buildSeriesRow = (index: number) => ({
      user_id: user.id,
      workspace_id: profile?.current_workspace_id || null,
      title: splitAmount
        ? `${baseTransaction.title} (${index + 1}/${count})`
        : baseTransaction.title,
      amount: amountPerTransaction,
      type: baseTransaction.type,
      status: baseTransaction.status,
      category_id: baseTransaction.categoryId || null,
      date: format(addDateByInterval(baseDate, index, interval), 'yyyy-MM-dd'),
      notes: baseTransaction.notes || null,
      recurrence_type: baseTransaction.recurrenceType,
      installment_number: splitAmount ? index + 1 : null,
      total_installments: splitAmount ? count : null,
      parent_transaction_id: null,
      group_id: groupId,
      recurrence_interval: interval,
      recurrence_end_date: baseTransaction.recurrenceEndDate || null,
      notify: baseTransaction.notify,
    });

    const firstRow = buildSeriesRow(0);
    const remainingRows = Array.from({ length: count - 1 }, (_, index) =>
      buildSeriesRow(index + 1)
    );

    const { data: updatedRows, error: updateError } = await supabase
      .from('transactions')
      .update({
        title: firstRow.title,
        amount: firstRow.amount,
        type: firstRow.type,
        status: firstRow.status,
        category_id: firstRow.category_id,
        date: firstRow.date,
        notes: firstRow.notes,
        recurrence_type: firstRow.recurrence_type,
        installment_number: firstRow.installment_number,
        total_installments: firstRow.total_installments,
        parent_transaction_id: firstRow.parent_transaction_id,
        group_id: firstRow.group_id,
        recurrence_interval: firstRow.recurrence_interval,
        recurrence_end_date: firstRow.recurrence_end_date,
        notify: firstRow.notify,
      })
      .eq('id', id)
      .select('id');

    if (updateError) {
      console.error('Failed to convert transaction into recurring series:', updateError);
      toast.error(getFinanceErrorMessage(updateError, 'Nao foi possivel salvar a recorrencia.'));
      return false;
    }

    const validation = validateAffectedTransactionIds(
      [id],
      (updatedRows || []).map((item) => item.id)
    );

    if (!validation.ok) {
      console.error('Recurring conversion touched an unexpected set of records.', {
        expectedIds: validation.expectedIds,
        updatedIds: validation.affectedIds,
      });
      toast.error('A recorrencia nao foi aplicada com seguranca. Recarregue e tente novamente.');
      return false;
    }

    if (remainingRows.length > 0) {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(remainingRows);

      if (insertError) {
        console.error('Failed to insert remaining recurring transactions:', insertError);
        toast.error(getFinanceErrorMessage(insertError, 'Nao foi possivel criar as proximas parcelas.'));
        return false;
      }
    }

    await get().refreshData();
    return true;
  },
}));

export const useTransactions = () => useFinanceStore((state) => state.transactions);
export const useCategories = () => useFinanceStore((state) => state.categories);
export const useBudgets = () => useFinanceStore((state) => state.budgets);
export const useSettings = () => useFinanceStore((state) => state.settings);
export const useFinanceLoading = () => useFinanceStore((state) => state.loading);

export const useCurrentBalance = () => {
  const transactions = useTransactions();

  return transactions
    .filter((transaction) => transaction.status === 'completed')
    .reduce((total, transaction) => {
      return transaction.type === 'income'
        ? total + transaction.amount
        : total - transaction.amount;
    }, 0);
};

export const useProjectedBalance = () => {
  const transactions = useTransactions();

  return transactions.reduce((total, transaction) => {
    return transaction.type === 'income'
      ? total + transaction.amount
      : total - transaction.amount;
  }, 0);
};

export const useCategoryById = (id: string) => {
  const categories = useCategories();
  return categories.find((category) => category.id === id);
};

export const useBudgetByCategory = (categoryId: string) => {
  const budgets = useBudgets();
  const transactions = useTransactions();
  const budget = budgets.find((item) => item.categoryId === categoryId);

  if (!budget) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const spent = transactions
    .filter(
      (transaction) =>
        transaction.categoryId === categoryId &&
        transaction.status === 'completed' &&
        new Date(transaction.date) >= monthStart
    )
    .reduce((total, transaction) => total + transaction.amount, 0);

  return { ...budget, spent };
};
