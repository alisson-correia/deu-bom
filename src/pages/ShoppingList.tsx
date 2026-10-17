import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { EmptyState } from '@/components/EmptyState';
import { usePageVoice } from '@/components/VoiceProvider';
import { parseVoiceCommand } from '@/services/voiceCommandParser';
import type { ShoppingListItem } from '@/types/shopping';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STORAGE_KEY = 'deu-bom-shopping-list-v1';

type ShoppingVoiceDraft = Omit<ShoppingListItem, 'id' | 'createdAt' | 'updatedAt' | 'checked'>;

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseOptionalPrice = (value: string) => {
  if (!value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

const getItemPrice = (item: ShoppingListItem) => item.estimatedPrice ?? 0;

const getPriceLabel = (price: ShoppingListItem['estimatedPrice']) =>
  price === null ? 'Preco pendente' : `${formatCurrency(price)} cada`;

const loadItems = (): ShoppingListItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as ShoppingListItem[]) : [];

    return parsed.map((item) => ({
      ...item,
      estimatedPrice:
        typeof item.estimatedPrice === 'number' && Number.isFinite(item.estimatedPrice)
          ? item.estimatedPrice
          : null,
    }));
  } catch {
    return [];
  }
};

const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('un');
  const [estimatedPriceInput, setEstimatedPriceInput] = useState('');
  const [voiceDraft, setVoiceDraft] = useState<ShoppingVoiceDraft | null>(null);
  const [voicePrompt, setVoicePrompt] = useState('');

  useEffect(() => {
    setItems(loadItems());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loading]);

  const totals = useMemo(() => {
    const pending = items.filter((item) => !item.checked);
    const total = items.reduce(
      (sum, item) => sum + item.quantity * getItemPrice(item),
      0
    );
    const pendingTotal = pending.reduce(
      (sum, item) => sum + item.quantity * getItemPrice(item),
      0
    );

    return {
      count: items.length,
      checked: items.length - pending.length,
      total,
      pendingTotal,
    };
  }, [items]);

  const addItem = (item: Omit<ShoppingListItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    setItems((current) => [
      {
        ...item,
        id: createId(),
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ]);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) return;

    addItem({
      name: name.trim(),
      quantity: Math.max(1, quantity),
      unit: unit.trim() || 'un',
      estimatedPrice: parseOptionalPrice(estimatedPriceInput),
      checked: false,
    });

    setName('');
    setQuantity(1);
    setUnit('un');
    setEstimatedPriceInput('');
    toast.success('Item adicionado na lista.');
  };

  const handleVoiceTranscript = (transcript: string) => {
    const command = parseVoiceCommand(transcript, { preferredKind: 'shopping' });

    if (!command || command.kind !== 'shopping') {
      setVoiceDraft(null);
      setVoicePrompt('Nao entendi o item. Diga algo como: cinco unidades de detergente por 5 reais.');
      return;
    }

    setVoicePrompt('Confira os dados antes de adicionar na lista.');
    setVoiceDraft({
      name: command.name,
      quantity: command.quantity,
      unit: command.unit,
      estimatedPrice: command.estimatedPrice > 0 ? command.estimatedPrice : null,
    });
  };

  const handleSaveVoiceDraft = () => {
    if (!voiceDraft) return;

    if (!voiceDraft.name.trim()) {
      setVoicePrompt('Ainda falta o nome do item.');
      return;
    }

    addItem({
      name: voiceDraft.name.trim(),
      quantity: Math.max(1, voiceDraft.quantity),
      unit: voiceDraft.unit.trim() || 'un',
      estimatedPrice: voiceDraft.estimatedPrice === null ? null : Math.max(0, voiceDraft.estimatedPrice),
      checked: false,
    });

    setVoiceDraft(null);
    setVoicePrompt('');
  };

  const { isListening, lastTranscript } = usePageVoice({
    onTranscript: handleVoiceTranscript,
  });

  const toggleItem = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, checked: !item.checked, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    toast.success('Item removido.');
  };

  const updateItemPrice = (id: string, value: string) => {
    const estimatedPrice = parseOptionalPrice(value);

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, estimatedPrice, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando lista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--app-bottom-nav-height,0px)+1rem+env(safe-area-inset-bottom,0px))] xl:pl-[var(--app-sidebar-width,88px)]">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl py-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">Lista de compras</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Itens, quantidades e previsão de gasto.
              </p>
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
                  <p className="text-sm font-semibold text-foreground">Revisar item por voz</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {voicePrompt || 'Confira nome, quantidade e preco antes de adicionar.'}
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
                  <label className="block text-xs text-muted-foreground">
                    Item
                    <input
                      type="text"
                      value={voiceDraft.name}
                      onChange={(event) =>
                        setVoiceDraft((current) =>
                          current ? { ...current, name: event.target.value } : current
                        )
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-muted-foreground">
                      Qtd.
                      <input
                        type="number"
                        min="1"
                        value={voiceDraft.quantity}
                        onChange={(event) =>
                          setVoiceDraft((current) =>
                            current ? { ...current, quantity: Number(event.target.value) } : current
                          )
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                      />
                    </label>

                    <label className="text-xs text-muted-foreground">
                      Un.
                      <input
                        type="text"
                        value={voiceDraft.unit}
                        onChange={(event) =>
                          setVoiceDraft((current) =>
                            current ? { ...current, unit: event.target.value } : current
                          )
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                      />
                    </label>

                    <label className="text-xs text-muted-foreground">
                      Preco
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={voiceDraft.estimatedPrice ?? ''}
                        placeholder="Opcional"
                        onChange={(event) =>
                          setVoiceDraft((current) =>
                            current
                              ? { ...current, estimatedPrice: parseOptionalPrice(event.target.value) }
                              : current
                          )
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Total:{' '}
                    {voiceDraft.estimatedPrice === null
                      ? 'preco pendente'
                      : formatCurrency(voiceDraft.quantity * voiceDraft.estimatedPrice)}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveVoiceDraft}
                    className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Confirmar e adicionar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Itens</p>
              <p className="mt-0.5 text-sm font-semibold">{totals.count}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Comprados</p>
              <p className="mt-0.5 text-sm font-semibold">{totals.checked}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Previsto</p>
              <p className="mt-0.5 text-sm font-semibold">{formatCurrency(totals.total)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-sm)]"
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px_96px_120px_auto]">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Item"
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Quantidade"
            />
            <input
              type="text"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Unidade"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={estimatedPriceInput}
              onChange={(event) => setEstimatedPriceInput(event.target.value)}
              placeholder="Preco opcional"
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Valor estimado"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Sua lista esta vazia"
            description="Adicione pelo formulario ou toque no microfone e fale o item."
          />
        ) : (
          <section className="space-y-2">
            {items.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-border bg-card p-3',
                  item.checked && 'bg-muted/40 text-muted-foreground'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                    item.checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground'
                  )}
                  aria-label={item.checked ? 'Desmarcar item' : 'Marcar item comprado'}
                >
                  <Check className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-semibold', item.checked && 'line-through')}>
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.quantity} {item.unit} | {getPriceLabel(item.estimatedPrice)}
                  </p>
                </div>
                <div className="w-28 shrink-0 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.estimatedPrice ?? ''}
                    onChange={(event) => updateItemPrice(item.id, event.target.value)}
                    placeholder="Preco"
                    className="mb-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Atualizar preco de ${item.name}`}
                  />
                  <p className="text-sm font-semibold">
                    {item.estimatedPrice === null
                      ? '--'
                      : formatCurrency(item.quantity * item.estimatedPrice)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-expense"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default ShoppingList;
