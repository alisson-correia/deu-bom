import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvDocument, parseSpreadsheet, prepareSpreadsheet, spreadsheetTemplate } from '../../src/services/spreadsheetImport';
import type { Transaction } from '../../src/types/finance';

test('modelo baixável é importável e as parcelas preservam centavos e vencimentos de fim de mês', () => {
  const model = prepareSpreadsheet(parseSpreadsheet(spreadsheetTemplate(new Date(2026,0,1))), [], []);
  assert.equal(model.length,8); assert.equal(model.filter(row=>row.title==='Notebook').reduce((sum,row)=>sum+row.amount,0),3000);
  const csv='Data;Descricao;Tipo;Valor;Parcelas\n31/01/2026;Compra;Despesa;100,00;3';
  const rows=prepareSpreadsheet(parseSpreadsheet(csv),[],[]);
  assert.deepEqual(rows.map(row=>row.date),['2026-01-31','2026-02-28','2026-03-31']);
  assert.deepEqual(rows.map(row=>row.amount),[33.34,33.33,33.33]);
  assert.equal(rows.reduce((sum,row)=>sum+Math.round(row.amount*100),0),10000);
  assert.equal(new Set(rows.map(row=>row.groupId)).size,1);
});

test('CSV preserva aspas, quebras e ponto e vírgula e texto de planilha aceita tabulação', () => {
  const csv=csvDocument([['Data','Descricao','Tipo','Valor','Observacoes'],['2026-11-10','Compra; "teste"','Despesa','1.234,56','Linha 1\nLinha 2']]);
  const [row]=parseSpreadsheet(csv);assert.equal(row.title,'Compra; "teste"');assert.equal(row.notes,'Linha 1\nLinha 2');assert.equal(row.cents,123456);
  assert.equal(parseSpreadsheet('Data\tDescricao\tTipo\tValor\n2026-11-10\tSalário\tReceita\t3500.50')[0].cents,350050);
  const safe=csvDocument([['Data','Descricao','Tipo','Valor'],['2026-11-10','=SOMA(A1)','Despesa','10']]);assert.match(safe,/'=SOMA/);assert.equal(parseSpreadsheet(safe)[0].title,'=SOMA(A1)');
});

test('linhas inválidas são identificadas antes de qualquer gravação', () => {
  const head='Data;Descricao;Tipo;Valor;Parcelas\n';
  for(const line of ['2026-02-31;Compra;Despesa;10;1','2026-11-10;Compra;Despesa;-10;1','2026-11-10;Compra;Outro;10;1','2026-11-10;Compra;Despesa;1,234;1','2026-11-10;Compra;Despesa;10;0','2026-11-10;Compra;Despesa;0,01;2']) assert.throws(()=>parseSpreadsheet(head+line),/Linha 2:/);
  assert.throws(()=>parseSpreadsheet('Data;Descricao;Tipo;Valor;ColunaInesperada\n2026-11-10;Compra;Despesa;1;abc'),/colunas desconhecidas/i);
  assert.throws(()=>parseSpreadsheet(head+'2026-11-10;"Não fechada;Despesa;10;1'),/aspas/);
});

test('dívidas em andamento geram somente as parcelas restantes e duplicados começam identificados', () => {
  const csv='Data;Descricao;Tipo;Valor;Parcelas;ParcelaInicial\n2026-11-10;Notebook;Despesa;3000;10;5';
  const parsed=parseSpreadsheet(csv),rows=prepareSpreadsheet(parsed,[],[]);
  assert.equal(rows.length,6);assert.equal(rows[0].installmentNumber,5);assert.equal(rows[0].date,'2026-11-10');assert.equal(rows[0].amount,300);assert.equal(rows.at(-1)?.installmentNumber,10);
  const existing=[{...rows[0],createdAt:'',updatedAt:''}] as Transaction[];
  const again=prepareSpreadsheet([...parsed,...parsed],[],existing);
  assert.equal(again.filter(row=>row.duplicate).length,7);
  assert.throws(()=>parseSpreadsheet(csv.replace(';10;5',';10;11')),/ParcelaInicial/);
});
