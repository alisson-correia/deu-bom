import { createHash } from 'node:crypto';

export interface FinanceRow {
  id: string; user_id: string; workspace_id: string | null; title: string;
  amount: number; type: 'income' | 'expense'; date: string;
  status: 'pending' | 'completed'; updated_at: string;
}

export const fingerprint = (row: FinanceRow) => createHash('sha256')
  .update(JSON.stringify([row.title, row.amount, row.type, row.date, row.status])).digest('hex');
export const eventId = (user: string, account: string, transaction: string) =>
  createHash('sha256').update(`${user}:${account}:${transaction}`).digest('hex');

export function taskPayload(row: FinanceRow, appOrigin: string) {
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.amount);
  return {
    title: `${row.type === 'income' ? 'Receber' : 'Pagar'}: ${row.title} · ${amount}`,
    notes: `deu-bom:${row.id}\n${appOrigin}/transactions\nConfira o lançamento no app antes de marcar como concluído.`,
    due: `${row.date}T00:00:00.000Z`,
    status: row.status === 'completed' ? 'completed' : 'needsAction',
  };
}

export function eventPayload(row: FinanceRow, timeZone: string, appOrigin: string, taskUrl?: string) {
  return {
    summary: `${row.status === 'completed' ? '✓ ' : ''}${taskPayload(row, appOrigin).title}`,
    description: `Lembrete vinculado à tarefa Deu Bom. Marque a tarefa como concluída para atualizar o app.\n${taskUrl || `${appOrigin}/transactions`}`,
    colorId: row.type === 'income' ? '10' : '11',
    transparency: 'transparent',
    visibility: 'private',
    start: { dateTime: `${row.date}T09:00:00`, timeZone },
    end: { dateTime: `${row.date}T09:05:00`, timeZone },
    reminders: { useDefault: false, overrides: row.status === 'completed' ? [] : [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 0 }] },
    extendedProperties: { private: { deuBomTransaction: row.id } },
  };
}
