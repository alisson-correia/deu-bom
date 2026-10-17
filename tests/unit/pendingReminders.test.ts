import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPendingReminder } from '../../src/utils/pendingReminders';
import type { Transaction } from '../../src/types/finance';
const row = (id: string, date: string, type = 'expense', status = 'pending') => ({ id, date, type, status, amount: 100 } as Transaction);
test('alertas distinguem hoje, próximos vencimentos, atrasos e receitas sem incluir concluídos', () => {
  const now = new Date(2026, 9, 17, 12);
  const result = buildPendingReminder([row('a', '2026-10-17'), row('b', '2026-10-20'), row('c', '2026-10-16'), row('d', '2026-10-17', 'income'), row('e', '2026-10-17', 'expense', 'completed'), row('f', '2026-10-21')], now);
  assert.ok(result); assert.equal(result.title, '1 despesa(s) vencem hoje');
  assert.match(result.description, /1 receita/); assert.match(result.description, /1 lançamento\(s\) em atraso/); assert.match(result.description, /1 vencimento/);
  assert.equal(buildPendingReminder([row('e', '2026-10-17', 'expense', 'completed'), row('f', '2026-10-21')], now), null);
});
