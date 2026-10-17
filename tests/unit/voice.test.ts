import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand, parseVoiceTheme } from '../../src/services/voiceCommandParser';

test('valor brasileiro, decimal e número de parcelas permanecem distintos', () => {
  for (const [text, amount] of [['despesa mercado 35,90 reais', 35.9], ['recebi salario 12.50 reais', 12.5], ['receita freelance 1.234,56 reais', 1234.56]] as const) {
    const result = parseVoiceCommand(text, { preferredKind: 'transaction' });
    assert.equal(result?.kind, 'transaction');
    if (result?.kind === 'transaction') assert.equal(result.amount, amount);
  }
  const recurring = parseVoiceCommand('despesa celular 3x de 100 reais', { preferredKind: 'transaction' });
  assert.ok(recurring?.kind === 'transaction');
  assert.equal(recurring.amount, 100);
  assert.equal(recurring.installmentCount, 3);
});
test('voz reconhece contexto financeiro e preserva compras', () => {
  assert.equal(parseVoiceCommand('gastei 45 reais no mercado')?.kind, 'transaction');
  const income = parseVoiceCommand('recebi 200 reais de freelance');
  assert.ok(income?.kind === 'transaction'); assert.equal(income.type, 'income');
  const shopping = parseVoiceCommand('cinco unidades de detergente por 5 reais', { preferredKind: 'shopping' });
  assert.ok(shopping?.kind === 'shopping'); assert.equal(shopping.quantity, 5); assert.equal(shopping.estimatedPrice, 5);
});
test('comandos de tema não são confundidos com descrições de despesas', () => {
  assert.equal(parseVoiceTheme('tema escuro'), 'dark');
  assert.equal(parseVoiceTheme('mudar para tema claro'), 'light');
  assert.equal(parseVoiceTheme('modo do sistema'), 'system');
  assert.equal(parseVoiceTheme('despesa com tema claro 20 reais'), null);
});

test('fala completa reconhece valor por extenso, data e repetição sem misturar os números', () => {
  const result = parseVoiceCommand('receita três mil reais salário dia cinco de novembro de 2026 repetir doze vezes', { preferredKind: 'transaction' });
  assert.ok(result?.kind === 'transaction');
  assert.equal(result.amount, 3000); assert.equal(result.title, 'salario');
  assert.equal(result.date, '2026-11-05'); assert.equal(result.recurrenceType, 'installment'); assert.equal(result.installmentCount, 12);
  const numeric = parseVoiceCommand('despesa aluguel 1250 reais dia 05/11/2026', { preferredKind: 'transaction' });
  assert.ok(numeric?.kind === 'transaction'); assert.equal(numeric.date, '2026-11-05'); assert.equal(numeric.amount, 1250);
  assert.equal(parseVoiceCommand('despesa aluguel 1250 reais dia 31 de fevereiro de 2026', { preferredKind: 'transaction' }), null);
});


test('quantidade, embalagem e preço unitário geram total sem confundir peso com unidades', () => {
 const packs = parseVoiceCommand('despesa 10 açúcares, 1 quilo cada, R$50 cada um à vista pago dia 10/11/2026', {preferredKind:'transaction'});
 assert.ok(packs?.kind === 'transaction'); assert.equal(packs.amount,500); assert.equal(packs.itemDetails?.quantity,10); assert.equal(packs.itemDetails?.unit,'un'); assert.equal(packs.itemDetails?.packageSize,'1 kg'); assert.equal(packs.categoryHint,'Alimentação'); assert.equal(packs.status,'completed'); assert.equal(packs.date,'2026-11-10');
 const kilos = parseVoiceCommand('10 quilos de açúcar 50 reais cada', {preferredKind:'shopping'});
 assert.ok(kilos?.kind === 'shopping'); assert.equal(kilos.quantity,10); assert.equal(kilos.unit,'kg'); assert.equal(kilos.estimatedPrice,50);
 const missing = parseVoiceCommand('10 quilos de açúcar', {preferredKind:'shopping'});
 assert.ok(missing?.kind === 'shopping'); assert.equal(missing.estimatedPrice,0);
 const total = parseVoiceCommand('10 unidades de açúcar valor total de 50 reais', {preferredKind:'shopping'});
 assert.ok(total?.kind === 'shopping'); assert.equal(total.estimatedPrice,5);
});
