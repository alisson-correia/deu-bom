import { useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ReceiptDatabase } from '@/integrations/supabase/receiptTypes';
import { DocumentImportAssistant } from '@/components/DocumentImportAssistant';
import { uploadReceipt, receiptBucket, receiptClient, type ReceiptSource } from '@/services/receipts';
import { useFinanceStore } from '@/stores/financeStore';
import { csvDocument, parseSpreadsheet, prepareSpreadsheet, spreadsheetColumns, spreadsheetTemplate, type PreparedImport } from '@/services/spreadsheetImport';
import { getErrorMessage } from '@/utils/errors';

export function downloadCsv(contents: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export { csvDocument };
const currency = (amount: number) => amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SpreadsheetImportPanel({ userId, workspaceId, canImport }: { userId: string; workspaceId: string | null; canImport: boolean }) {
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const loading = useFinanceStore((state) => state.loading);
  const loadError = useFinanceStore((state) => state.loadError);
  const input = useRef<HTMLInputElement>(null), busy = useRef(false);
  const [text, setText] = useState(''), [error, setError] = useState('');
  const [preview, setPreview] = useState<PreparedImport[]>([]), [selected, setSelected] = useState<Set<string>>(new Set());
  const [receiptSource, setReceiptSource] = useState<ReceiptSource>();
  const [assistantVersion, setAssistantVersion] = useState(0);
  const [saving, setSaving] = useState(false), [page, setPage] = useState(0), [source, setSource] = useState('');
  const disabled = !canImport || loading || Boolean(loadError) || saving;
  const review = (contents: string, name: string, receipt?: ReceiptSource) => {
    if (disabled) return;
    setReceiptSource(receipt);
    setError(''); setPreview([]); setSelected(new Set()); setPage(0);
    try {
      const prepared = prepareSpreadsheet(parseSpreadsheet(contents), categories, transactions);
      setPreview(prepared); setSource(name); setSelected(new Set(prepared.filter((item) => !item.duplicate).map((item) => item.id)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível ler a planilha.'); }
  };
  const selectedRows = preview.filter((row) => selected.has(row.id));
  const duplicates = preview.filter((row) => row.duplicate).length;
  const uncategorized = [...new Set(selectedRows.filter((row) => row.categoryLabel && !row.categoryId).map((row) => row.categoryLabel))];
  const total = selectedRows.reduce((value, row) => value + Math.round(row.amount * 100), 0) / 100;
  const save = async () => {
    if (busy.current || disabled || !selectedRows.length) return;
    busy.current = true; setSaving(true); setError('');
    const generation = useFinanceStore.getState().snapshotGeneration;
    const assertScope = () => { if (useFinanceStore.getState().snapshotGeneration !== generation) throw new Error('A conta ou equipe mudou. Reabra a importação no contexto desejado.'); };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId) throw new Error('Entre novamente na conta para importar.');
      // Freeze the initiating user's JWT so a concurrent account switch cannot change this request's identity.
      const db = createClient<ReceiptDatabase>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: auth, error: authError } = await db.auth.getUser(session.access_token);
      if (authError || auth.user?.id !== userId) throw new Error('Sua sessão expirou. Entre novamente.');
      const { data: profile, error: profileError } = await db.from('profiles').select('current_workspace_id').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      if ((profile?.current_workspace_id || null) !== workspaceId) throw new Error('A equipe mudou. Reabra a importação.');
      assertScope();
      const payload = selectedRows.map((row) => ({
        id: row.id, user_id: userId, workspace_id: workspaceId, title: row.title, amount: row.amount, type: row.type,
        status: row.status, category_id: row.categoryId || null, date: row.date, notes: row.notes || null,
        recurrence_type: row.recurrenceType, installment_number: row.installmentNumber || null,
        total_installments: row.totalInstallments || null, group_id: row.groupId || null, notify: false,
      }));
      // One database statement: all selected rows succeed together. Stable IDs make retrying this preview safe.
      const receipt = receiptSource ? await uploadReceipt(receiptSource, db) : undefined;
      assertScope();
      const result = await db.rpc('import_finance_batch', { batch: payload, target_workspace: workspaceId, receipt: receipt ? { ...receipt } : null });
      if (result.error) throw result.error;
      assertScope();
      setPreview([]); setSelected(new Set()); setText(''); setReceiptSource(undefined); setAssistantVersion((value) => value + 1);
      await useFinanceStore.getState().refreshData();
      toast.success(`${payload.length} lançamento(s) confirmados; ${result.data ?? 0} novos.`);
    } catch (cause) { setError(getErrorMessage(cause, 'A importação não foi confirmada. A prévia foi preservada para tentar novamente.')); }
    finally { busy.current = false; setSaving(false); }
  };
  return <section aria-labelledby="spreadsheet-import-title" className="rounded-2xl border border-border bg-background/60 p-4">
    <h3 id="spreadsheet-import-title" className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4 text-primary" />Importar por planilha</h3>
    <p className="mt-2 text-sm text-muted-foreground">Baixe o modelo, substitua os exemplos e salve como CSV UTF-8 no Excel ou Google Sheets. A importação adiciona lançamentos ao contexto atual, após sua revisão.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => downloadCsv(spreadsheetTemplate(), 'modelo-importacao.csv')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm"><Download className="h-4 w-4" />Baixar modelo CSV</button>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"><Upload className="h-4 w-4" />Selecionar planilha</button>
    </div>
    {!canImport && <p className="mt-2 text-sm text-muted-foreground">Somente proprietários e editores podem importar nesta equipe.</p>}
    <input ref={input} type="file" aria-label="Arquivo CSV para importar" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="hidden" disabled={disabled} onChange={async (event) => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { setError('O arquivo deve ter até 2 MB.'); return; }
      try { review(await file.text(), file.name); } catch { setError('Não foi possível abrir o arquivo.'); }
    }} />
    <details className="mt-3 rounded-xl border border-border px-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Como preencher o modelo</summary>
      <p className="mb-3 text-sm text-muted-foreground">Valor é o total da compra: 3000,00 com 6 parcelas gera 6 lançamentos de R$ 500,00, um por mês. Para situações de pagamento diferentes, informe cada parcela em uma linha com Parcelas = 1. Para dívida em andamento, Parcelas é o total original e ParcelaInicial é a primeira a importar. Ex.: total R$ 3.000, 10 parcelas e início na 5 gera 6 lançamentos de R$ 300 a partir da data informada. Limites: 500 linhas, 1000 lançamentos após dividir parcelas e 2 MB por arquivo.</p>
      <dl className="mb-3 space-y-2 text-sm">{spreadsheetColumns.map(([name, description]) => <div key={name}><dt className="font-medium">{name}</dt><dd className="text-muted-foreground">{description}</dd></div>)}</dl>
    </details>
    <details className="mt-2 rounded-xl border border-border px-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Colar linhas da planilha</summary>
      <label htmlFor="spreadsheet-paste" className="text-sm text-muted-foreground">Cole as colunas com cabeçalho, separadas por ponto e vírgula ou tabulação.</label>
      <textarea id="spreadsheet-paste" value={text} onChange={(event) => setText(event.target.value)} disabled={saving} rows={5} className="my-2 w-full min-w-0 rounded-xl border border-input bg-background p-3 text-sm" placeholder={'Data;Descricao;Tipo;Valor\n2026-11-10;Mercado;Despesa;125,50'} />
      <button type="button" disabled={disabled || !text.trim()} onClick={() => review(text, 'Texto colado')} className="mb-3 min-h-11 rounded-xl border border-border px-3 text-sm disabled:opacity-50">Revisar texto colado</button>
    </details>
    <DocumentImportAssistant key={assistantVersion} userId={userId} disabled={disabled} onReview={review} />
    {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {preview.length > 0 && <div aria-label="Prévia da importação" className="mt-4 space-y-3">
      <div><h4 className="font-medium">Revise antes de importar</h4>{receiptSource && <p className="text-sm text-muted-foreground">Comprovante privado: {receiptSource.file.name}</p>}<p className="break-words text-sm text-muted-foreground">{source} · {preview.length} lançamentos · {duplicates} possíveis duplicados</p></div>
      <p className="text-sm text-muted-foreground">Possíveis duplicados começam desmarcados. A comparação usa descrição, tipo, valor e data; marque somente se for outro lançamento.</p>
      {uncategorized.length > 0 && <p className="rounded-xl border border-warning/30 p-3 text-sm">Categorias não encontradas: {uncategorized.join(', ')}. Esses lançamentos ficarão sem categoria. Para associá-los, use no arquivo o nome de uma categoria existente do mesmo tipo.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => setSelected(new Set(preview.filter((row) => !row.duplicate).map((row) => row.id)))} className="min-h-11 rounded-xl border border-border px-3 text-sm">Selecionar não duplicados</button>
        <button type="button" disabled={saving} onClick={() => setSelected(new Set())} className="min-h-11 rounded-xl border border-border px-3 text-sm">Desmarcar todos</button>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">{preview.slice(page * 25, page * 25 + 25).map((row) => <label key={row.id} className="flex min-h-16 cursor-pointer items-start gap-3 p-3">
        <span className="inline-flex min-h-11 min-w-6 items-center"><input type="checkbox" checked={selected.has(row.id)} disabled={saving} aria-label={`Importar ${row.title} em ${row.date}`} className="h-5 w-5 accent-primary" onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(row.id); else next.delete(row.id); return next; })} /></span>
        <span className="min-w-0 flex-1 text-sm"><span className="block break-words font-medium">{row.title}{row.totalInstallments ? ` · ${row.installmentNumber}/${row.totalInstallments}` : ''}</span><span className="block text-muted-foreground">{row.date.split('-').reverse().join('/')} · {row.type === 'income' ? 'Receita' : 'Despesa'} · {row.status === 'completed' ? 'Concluído' : 'Pendente'}</span><span className="block font-medium">{currency(row.amount)}{row.duplicate ? ' · Possível duplicado' : ''}</span></span>
      </label>)}</div>
      {preview.length > 25 && <div className="flex items-center justify-between gap-2 text-sm"><button type="button" disabled={saving || page === 0} onClick={() => setPage((current) => current - 1)} className="min-h-11 rounded-xl border border-border px-3 disabled:opacity-50">Anterior</button><span>{page + 1} de {Math.ceil(preview.length / 25)}</span><button type="button" disabled={saving || (page + 1) * 25 >= preview.length} onClick={() => setPage((current) => current + 1)} className="min-h-11 rounded-xl border border-border px-3 disabled:opacity-50">Próxima</button></div>}
      <p className="text-sm font-medium">{selectedRows.length} selecionados · Soma dos valores: {currency(total)}</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled || selectedRows.length === 0} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Importar {selectedRows.length} {selectedRows.length === 1 ? 'lançamento' : 'lançamentos'}</button><button type="button" disabled={saving} onClick={() => { if (receiptSource) void receiptClient.storage.from(receiptBucket).remove([receiptSource.storagePath]); setReceiptSource(undefined); setPreview([]); setSelected(new Set()); setError(''); }} className="min-h-11 rounded-xl border border-border px-3 text-sm">Cancelar importação</button></div>
    </div>}
  </section>;
}
