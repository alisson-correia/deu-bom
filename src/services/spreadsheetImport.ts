import { addMonths, format, parseISO } from 'date-fns';
import type { Category, Transaction, TransactionStatus, TransactionType } from '@/types/finance';

export const spreadsheetColumns = [
  ['Data', 'Vencimento ou recebimento: AAAA-MM-DD ou DD/MM/AAAA. Nas parcelas, é a data da primeira.'],
  ['Descricao', 'Nome do lançamento, até 200 caracteres.'],
  ['Tipo', 'Receita ou Despesa.'],
  ['Valor', 'Valor total, positivo, em reais. Ex.: 3000,00. Não informe o valor de cada parcela.'],
  ['Categoria', 'Opcional. Use o nome de uma categoria existente do mesmo tipo.'],
  ['Status', 'Pendente ou Concluido. Em uma compra parcelada, aplica-se a todas as parcelas.'],
  ['Parcelas', '1 para lançamento único; 2 a 360 para dividir o total em parcelas mensais.'],
  ['ParcelaInicial', 'Opcional: 1 por padrão. Para saldo parcelado em andamento, informe a primeira parcela a importar; Data será o vencimento dela.'],
  ['Observacoes', 'Opcional, até 1000 caracteres.'],
] as const;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const textCell = (value: string) => /^'[=+\-@]/.test(value) ? value.slice(1) : value;
export const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const csvDocument = (rows: unknown[][]) => '\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
export function spreadsheetTemplate(today = new Date()) {
  const month = format(today, 'yyyy-MM');
  return csvDocument([
    spreadsheetColumns.map(([name]) => name),
    [`${month}-05`, 'Salário', 'Receita', '3500,00', 'Salário', 'Concluido', '1', '1', 'Substitua os exemplos pelos seus dados'],
    [`${month}-10`, 'Notebook', 'Despesa', '3000,00', 'Compras', 'Pendente', '6', '1', 'Valor TOTAL: serão 6 parcelas de R$ 500,00'],
    [`${month}-15`, 'Conta de luz', 'Despesa', '180,50', 'Contas', 'Pendente', '1', '1', ''],
  ]);
}
export interface SpreadsheetRow {
  line: number; title: string; date: string; type: TransactionType; status: TransactionStatus;
  cents: number; category: string; notes: string; installments: number; startInstallment: number;
}
export type PreparedImport = Omit<Transaction, 'createdAt' | 'updatedAt'> & { sourceLine: number; categoryLabel: string; duplicate: boolean };

function csvRecords(input: string) {
  if (new TextEncoder().encode(input).byteLength > 2 * 1024 * 1024) throw new Error('O arquivo deve ter até 2 MB.');
  const text = input.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const header = text.split('\n').find((line) => line.trim()) || '';
  const delimiter = [';', '\t', ','].sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, start = 1;
  const finishCell = () => { cells.push(field.trim()); field = ''; closed = false; };
  const finishRecord = () => { finishCell(); if (cells.some(Boolean)) records.push({ line: start, cells }); cells = []; start = line + 1; };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; closed = true; } }
      else field += char;
      if (char === '\n') line += 1;
    } else if (char === delimiter) finishCell();
    else if (char === '\n') { finishRecord(); line += 1; }
    else if (char === '"' && !field.trim() && !closed) { quoted = true; field = ''; }
    else { if (char === '"' || (closed && char.trim())) throw new Error(`Linha ${line}: aspas inválidas. Salve novamente como CSV.`); field += char; }
  }
  if (quoted) throw new Error(`Linha ${start}: campo com aspas não foi fechado.`);
  finishRecord();
  return records;
}
function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) || /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)?.map((part, i, all) => i === 1 ? all[3] : i === 3 ? all[1] : part);
  if (!match) throw new Error('Data deve ser AAAA-MM-DD ou DD/MM/AAAA.');
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime()) || format(date, 'yyyy-MM-dd') !== iso) throw new Error('Data inexistente.');
  return iso;
}
function moneyCents(value: string) {
  const text = value.replace(/^R\$\s*/i, '').replace(/\s/g, '');
  let decimal: string;
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) decimal = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(?:\.\d{1,2})?$/.test(text)) decimal = text;
  else throw new Error('Valor inválido. Use um valor positivo, como 1250,50.');
  const [units, fraction = ''] = decimal.split('.');
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Valor deve ser positivo e estar dentro do limite numérico.');
  return cents;
}
export function parseSpreadsheet(input: string): SpreadsheetRow[] {
  const records = csvRecords(input);
  if (records.length < 2) throw new Error('Inclua o cabeçalho e ao menos um lançamento.');
  if (records.length > 501) throw new Error('Importe até 500 linhas por arquivo.');
  const headers = records[0].cells.map(normalize);
  while (headers.at(-1) === '') headers.pop();
  const accepted = spreadsheetColumns.map(([name]) => normalize(name));
  if (headers.some((name) => !accepted.includes(name)) || new Set(headers).size !== headers.length) throw new Error('Há colunas desconhecidas ou repetidas. Use o modelo disponível para download.');
  for (const required of ['data', 'descricao', 'tipo', 'valor']) if (!headers.includes(required)) throw new Error(`Coluna obrigatória ausente: ${required}.`);
  let expanded = 0;
  return records.slice(1).map(({ line, cells }) => {
    try {
      if (cells.slice(headers.length).some(Boolean)) throw new Error('A linha tem mais valores que o cabeçalho.');
      const cell = (name: string) => textCell(cells[headers.indexOf(name)] || '');
      const title = cell('descricao'), category = cell('categoria'), notes = cell('observacoes');
      if (!title || title.length > 200) throw new Error('Descrição deve ter de 1 a 200 caracteres.');
      if (category.length > 100 || notes.length > 1000) throw new Error('Categoria ou observações excedem o limite de caracteres.');
      const type = { receita: 'income', despesa: 'expense', income: 'income', expense: 'expense' }[normalize(cell('tipo'))] as TransactionType | undefined;
      const status = { pendente: 'pending', pending: 'pending', concluido: 'completed', completed: 'completed', pago: 'completed', recebido: 'completed' }[normalize(cell('status') || 'Pendente')] as TransactionStatus | undefined;
      if (!type) throw new Error('Tipo deve ser Receita ou Despesa.');
      if (!status) throw new Error('Status deve ser Pendente ou Concluido.');
      const count = cell('parcelas') || '1';
      if (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 360) throw new Error('Parcelas deve ser um inteiro entre 1 e 360.');
      const installments = Number(count), cents = moneyCents(cell('valor'));
      if (cents < installments) throw new Error('O total é insuficiente para dividir em parcelas de ao menos R$ 0,01.');
      const initial = cell('parcelainicial') || '1';
      if (!/^\d+$/.test(initial) || Number(initial) < 1 || Number(initial) > installments) throw new Error('ParcelaInicial deve estar entre 1 e o total de parcelas.');
      const startInstallment = Number(initial);
      expanded += installments - startInstallment + 1;
      if (expanded > 1000) throw new Error('O arquivo gera mais de 1000 lançamentos. Divida-o em arquivos menores.');
      return { line, title, category, notes, type, status, cents, installments, startInstallment, date: validDate(cell('data')) };
    } catch (error) { throw new Error(`Linha ${line}: ${error instanceof Error ? error.message : 'Dados inválidos.'}`); }
  });
}
const identity = (row: Pick<Transaction, 'title' | 'date' | 'amount' | 'type'>) => JSON.stringify([normalize(row.title), row.date, Math.round(row.amount * 100), row.type]);
export function prepareSpreadsheet(rows: SpreadsheetRow[], categories: Category[], existing: Transaction[]): PreparedImport[] {
  const seen = new Set(existing.map(identity));
  return rows.flatMap((row) => {
    const groupId = row.installments > 1 ? crypto.randomUUID() : undefined;
    const category = categories.find((item) => item.type === row.type && normalize(item.name) === normalize(row.category));
    const base = Math.floor(row.cents / row.installments), remainder = row.cents % row.installments;
    return Array.from({ length: row.installments - row.startInstallment + 1 }, (_, offset) => {
      const index = row.startInstallment - 1 + offset;
      const item = {
        id: crypto.randomUUID(), title: row.title, amount: (base + (index < remainder ? 1 : 0)) / 100, type: row.type, status: row.status,
        date: format(addMonths(parseISO(row.date), offset), 'yyyy-MM-dd'), categoryId: category?.id || '', categoryLabel: row.category,
        notes: row.notes || undefined, recurrenceType: row.installments > 1 ? 'installment' as const : 'none' as const,
        installmentNumber: groupId ? index + 1 : undefined, totalInstallments: groupId ? row.installments : undefined, groupId,
        notify: false, sourceLine: row.line,
      };
      const key = identity(item), duplicate = seen.has(key); seen.add(key);
      return { ...item, duplicate };
    });
  });
}
