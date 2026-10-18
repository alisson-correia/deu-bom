import React from 'react';
import { motion } from 'framer-motion';
import { Check, GripVertical, Trash2 } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useFinanceStore, useCategoryById } from '@/stores/financeStore';
import { formatCurrency } from '@/utils/currency';
import { getRelativeDate } from '@/utils/dates';
import { getCategoryIcon } from '@/utils/categoryIcons';
import type { Transaction } from '@/types/finance';
import {
  TransactionDeleteModal,
  TransactionUpdateModal,
} from '@/components/TransactionDeleteModal';
import { toast } from 'sonner';

interface TransactionCardProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (transaction: Transaction) => void;
  onDragEnd?: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onEdit,
  compact = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}) => {
  const didDragRef = React.useRef(false);
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [statusTarget,setStatusTarget] = React.useState<'pending'|'completed'>('completed');
  const [showStatusScopeModal, setShowStatusScopeModal] = React.useState(false);
  const [isResolvingDelete, setIsResolvingDelete] = React.useState(false);
  const [isResolvingStatus, setIsResolvingStatus] = React.useState(false);
  const category = useCategoryById(transaction.categoryId);
  const { updateTransaction, deleteTransaction } = useFinanceStore();

  const isRecurring = !!(transaction.groupId || transaction.parentTransactionId || (transaction.totalInstallments && transaction.totalInstallments > 1));

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === 'Left') {
        setSwipeOffset(Math.min(80, Math.abs(e.deltaX)));
      }
    },
    onSwipedLeft: () => {
      if (swipeOffset >= 60) {
        setShowDeleteModal(true);
      }
      setSwipeOffset(0);
    },
    onSwipedRight: () => {
      setSwipeOffset(0);
    },
    trackMouse: false,
    trackTouch: true,
  });

  React.useEffect(() => {
    if (isDeleting) {
      const timer = setTimeout(() => {
        // Deletion already handled by modal
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isDeleting]);

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isResolvingStatus) return;
    const target = transaction.status === 'completed' ? 'pending' : 'completed';
    setStatusTarget(target);
    if (isRecurring) {
      setShowStatusScopeModal(true);
      return;
    }

    setIsResolvingStatus(true);
    try { await updateTransaction(transaction.id,{status:target}); } finally { setIsResolvingStatus(false); }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (scope: 'single' | 'future' | 'all') => {
    if (isResolvingDelete) return;

    setIsResolvingDelete(true);
    try {
      const success =
        scope === 'single'
          ? await deleteTransaction(transaction.id, false)
          : scope === 'future'
            ? await deleteTransaction(transaction.id, true)
            : await deleteTransaction(transaction.id, false, true);

      if (!success) return;

      toast.success('Transacao excluida!');
      setShowDeleteModal(false);
      setIsDeleting(true);
    } finally {
      setIsResolvingDelete(false);
    }
  };

  const handleStatusScopeConfirm = async (scope: 'single' | 'future' | 'all') => {
    if (isResolvingStatus) return;

    const nextStatus = statusTarget;

    setIsResolvingStatus(true);
    try {
      const success =
        scope === 'single'
          ? await updateTransaction(transaction.id, { status: nextStatus }, false)
          : scope === 'future'
            ? await updateTransaction(transaction.id, { status: nextStatus }, true)
            : await updateTransaction(transaction.id, { status: nextStatus }, false, true);

      if (!success) return;

      toast.success('Status atualizado!');
      setShowStatusScopeModal(false);
    } finally {
      setIsResolvingStatus(false);
    }
  };

  const IconComponent = getCategoryIcon(category);

  const isIncome = transaction.type === 'income';
  const isPending = transaction.status === 'pending';
  const statusLabel = isIncome
    ? isPending
      ? 'Pendente'
      : 'Recebido'
    : isPending
    ? 'Pendente'
    : 'Pago';
  const toggleLabel = isIncome
    ? isPending
      ? 'Marcar como recebido'
      : 'Marcar como pendente'
    : isPending
    ? 'Marcar como pago'
    : 'Marcar como pendente';

  return (
    <>
      <motion.div
        {...handlers}
        draggable={draggable}
        onDragStart={(event) => {
          didDragRef.current = true;
          if ('dataTransfer' in event) {
            const dragEvent = event as unknown as React.DragEvent<HTMLDivElement>;
            dragEvent.dataTransfer.effectAllowed = 'move';
            dragEvent.dataTransfer.setData('text/plain', transaction.id);
          }
          onDragStart?.(transaction);
        }}
        onDragEnd={() => {
          window.setTimeout(() => {
            didDragRef.current = false;
          }, 0);
          onDragEnd?.();
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: isDeleting ? 0 : isDragging ? 0.55 : 1,
          y: isDeleting ? -20 : 0,
          x: -swipeOffset,
        }}
        transition={{ duration: 0.2 }}
        className="relative overflow-hidden"
      >
        {/* Delete background */}
        <div 
          className="absolute inset-y-0 right-0 bg-destructive flex items-center justify-center rounded-xl"
          aria-hidden="true"
          style={{ width: swipeOffset > 0 ? swipeOffset + 20 : 0, opacity: swipeOffset > 0 ? 1 : 0 }}
        >
          <Trash2 className="w-5 h-5 text-destructive-foreground" />
        </div>

        <div>
          {/* Card content */}
          <div
            onClick={() => {
              if (didDragRef.current) return;
              onEdit(transaction);
            }}
            data-transaction-id={transaction.id}
            className={`
              relative min-w-0 flex-1 bg-card border border-primary/25 rounded-xl ${compact ? 'p-3' : 'p-4'}
              active:scale-[0.98] transition-transform duration-100
              cursor-pointer group ${draggable ? 'select-none' : ''}
            `}
          >
            <div className={compact ? 'flex items-start gap-2.5' : 'flex items-start gap-3'}>
            <div
              className={`mt-0.5 flex items-center justify-center rounded-full flex-shrink-0 ${
                compact ? 'h-8 w-8' : 'h-9 w-9'
              }`}
              style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}
            >
              <IconComponent
                className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                style={{ color: 'hsl(var(--primary))' }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium text-foreground">
                    {transaction.title}
                  </h4>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {category?.name}
                    </span>
                    {transaction.installmentNumber && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {transaction.installmentNumber}/{transaction.totalInstallments}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p
                      className={`
                        font-mono ${compact ? 'text-xs' : 'text-sm'} font-semibold
                        ${isIncome ? 'text-income' : 'text-expense'}

                      `}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getRelativeDate(transaction.date)}
                    </p>
                  </div>

                  <button
                    onClick={handleDeleteClick}
                    className="ml-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10"
                    title="Excluir"
                    aria-label={`Excluir ${transaction.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>

              <div className={`${compact ? 'mt-2' : 'mt-3'} flex items-center justify-between gap-3`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!isPending}
                  aria-label={toggleLabel}
                  disabled={isResolvingStatus}
                  onClick={handleStatusToggle}
                  title={toggleLabel}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isPending ? 'border-pending/35 bg-pending/10 text-pending hover:border-primary/50 hover:bg-primary/10' : 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/20'}`}
                >
                  <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded border ${isPending ? 'border-muted-foreground/60' : 'border-primary bg-primary text-primary-foreground'}`}>
                    {!isPending && <Check className="h-3 w-3" />}
                  </span>
                  {isResolvingStatus ? 'Salvando…' : statusLabel}
                </button>
              </div>

              {draggable ? (
                <div className="mt-2 flex items-center justify-end text-muted-foreground/60">
                  <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </motion.div>

      <TransactionDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (isResolvingDelete) return;
          setShowDeleteModal(false);
        }}
        onConfirm={handleDeleteConfirm}
        isRecurring={isRecurring}
        transactionTitle={transaction.title}
        isSubmitting={isResolvingDelete}
      />

      <TransactionUpdateModal
        isOpen={showStatusScopeModal}
        onClose={() => {
          if (isResolvingStatus) return;
          setShowStatusScopeModal(false);
        }}
        onConfirm={handleStatusScopeConfirm}
        transactionTitle={transaction.title}
        isSubmitting={isResolvingStatus}
      />
    </>
  );
};
