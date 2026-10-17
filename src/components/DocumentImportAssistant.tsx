import { useEffect, useRef, useState } from 'react';
import { Camera, FileImage, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { documentExtractionSchema, type DocumentItem } from '@/services/documentSchema';
import { csvDocument, spreadsheetColumns } from '@/services/spreadsheetImport';
import { prepareReceipt, receiptDataUrl, type ReceiptSource } from '@/services/receipts';

interface EditableItem { key: string; title: string; date: string; type: string; amount: string; installments: string; startInstallment: string; status: string; category: string; notes: string; warnings: string[] }
const empty = (): EditableItem => ({ key: crypto.randomUUID(), title:'',date:'',type:'',amount:'',installments:'1',startInstallment:'1',status:'Pendente',category:'',notes:'',warnings:[] });
const editable = (item: DocumentItem): EditableItem => {
  const row = empty(), warnings = [...item.warnings];
  const count = item.installments || 1;
  let total = item.amount;
  if (item.amountKind === 'per_installment' && item.amount !== null && item.installments !== null) { total = Math.round(item.amount * 100) * count / 100; warnings.push('Valor total calculado a partir do valor por parcela. Confira o número de parcelas.'); }
  if (item.amountKind === 'unknown' && count > 1) { total = null; warnings.push('Confirme o valor TOTAL: não ficou claro se o valor lido é total ou por parcela.'); }
  const singlePayment = item.status === 'completed' && item.installmentNumber !== null && count > 1;
  if (singlePayment) {
    if (item.amountKind === 'per_installment') total = item.amount;
    else if (item.amountKind === 'total' && item.amount !== null) total = Math.round(item.amount * 100 / count) / 100;
    else total = null;
    warnings.push(`Comprovante da parcela ${item.installmentNumber}/${count}: somente este pagamento será registrado. As demais parcelas não foram inferidas.`);
  }
  return { ...row,title:item.title || '', date:item.date || '',type:item.type === 'income' ? 'Receita' : item.type === 'expense' ? 'Despesa' : '',
    amount:total === null ? '' : total.toFixed(2).replace('.',','), installments:String(singlePayment ? 1 : count),startInstallment:String(singlePayment ? 1 : item.installmentNumber || 1),status:item.status === 'completed' ? 'Concluido' : 'Pendente',category:item.category || '',notes:item.notes || '',warnings };
};

export function DocumentImportAssistant({ userId, disabled, onReview, onInvalidate }: { userId: string; disabled: boolean; onInvalidate: () => void; onReview: (csv:string, name:string, receipt?:ReceiptSource) => void }) {
  const fileInput=useRef<HTMLInputElement>(null), camera=useRef<HTMLInputElement>(null), request=useRef<AbortController|null>(null);
  const [source,setSource]=useState<ReceiptSource>(),[text,setText]=useState(''),[items,setItems]=useState<EditableItem[]>([]);
  const [reading,setReading]=useState(false),[error,setError]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[attach,setAttach]=useState(true),[url,setUrl]=useState('');
  useEffect(()=>{ if(!source){setUrl('');return;}const next=URL.createObjectURL(source.file);setUrl(next);return()=>URL.revokeObjectURL(next); },[source]);
  useEffect(()=>()=>request.current?.abort(),[]);
  const choose=async(file?:File)=>{if(!file||disabled||reading)return;onInvalidate();setSource(undefined);setError('');setWarnings([]);setItems([]);try{setSource(await prepareReceipt(file,userId));setAttach(true);}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível abrir o comprovante.');}};
  const analyze=async()=>{
    if(disabled||reading||(!source&&!text.trim()))return;
    onInvalidate();setReading(true);setError('');setWarnings([]);request.current?.abort();const controller=new AbortController();request.current=controller;
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session||session.user.id!==userId)throw new Error('Entre novamente para ler comprovantes.');
      const data=source?await receiptDataUrl(source.file):undefined;
      const response=await fetch('/api/import/extract',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({referenceDate:format(new Date(),'yyyy-MM-dd'),text:text.trim()||undefined,file:source?{name:source.file.name.slice(0,150),type:source.file.type,data:data!.split(',')[1]}:undefined})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível ler o comprovante.');
      const parsed=documentExtractionSchema.safeParse(result);if(!parsed.success)throw new Error('A leitura retornou campos inválidos. Preencha manualmente ou tente outra imagem.');
      setItems(parsed.data.items.map(editable));setWarnings(parsed.data.warnings);
      if(!parsed.data.items.length)setError('Não foram encontrados lançamentos legíveis. Você pode preencher manualmente.');
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'A leitura não foi concluída.');}
    finally{if(!controller.signal.aborted)setReading(false);}
  };
  const update=(key:string,field:keyof EditableItem,value:string)=>{onInvalidate();setItems(current=>current.map(item=>item.key===key?{...item,[field]:value}:item));};
  const review=()=>{
    if(!items.length)return;
    const invalid=items.find(item=>!item.title.trim()||!item.date||!item.type||!item.amount.trim());
    if(invalid){setError('Preencha descrição, data, tipo e valor total de todos os itens antes de gerar a prévia.');return;}
    onReview(csvDocument([spreadsheetColumns.map(([name])=>name),...items.map(item=>[item.date,item.title,item.type,item.amount,item.category,item.status,item.installments,item.startInstallment,item.notes])]),source?.file.name||'Texto livre',attach?source:undefined);
  };
  const blocked=disabled||reading;
  return <details className="mt-3 rounded-xl border border-border px-3">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Foto, PDF ou texto livre</summary>
    <p className="text-sm text-muted-foreground">Envie um comprovante, tire uma foto ou descreva seus lançamentos. A leitura prepara campos para revisão; não salva automaticamente. PDFs: até 3 MB e 10 páginas. Fotos são otimizadas para envio.</p>
    <div className="my-3 flex flex-wrap gap-2">
      <button type="button" disabled={blocked} onClick={()=>camera.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm disabled:opacity-50"><Camera className="h-4 w-4"/>Tirar foto</button>
      <button type="button" disabled={blocked} onClick={()=>fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm disabled:opacity-50"><FileImage className="h-4 w-4"/>Selecionar foto ou PDF</button>
    </div>
    <input ref={camera} type="file" aria-label="Fotografar comprovante" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={blocked} onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
    <input ref={fileInput} type="file" aria-label="Comprovante foto ou PDF" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={blocked} onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
    {source&&<div className="mb-3 rounded-xl border border-border p-3 text-sm"><p className="break-all font-medium">{source.file.name}</p>{source.file.type.startsWith('image/')&&url&&<img src={url} alt="Comprovante selecionado" className="mt-2 max-h-48 w-full rounded-lg object-contain"/>}{url&&<a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline">Abrir comprovante</a>}<button type="button" disabled={blocked} onClick={()=>{onInvalidate();setSource(undefined);setItems([]);}} className="ml-3 min-h-11 underline">Remover arquivo</button><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={attach} disabled={blocked} onChange={event=>{onInvalidate();setAttach(event.target.checked);}} className="h-5 w-5 accent-primary"/>Guardar comprovante privado nos lançamentos importados</label></div>}
    <label htmlFor="financial-document-text" className="text-sm font-medium">Texto ou instruções sobre os campos</label>
    <textarea id="financial-document-text" value={text} disabled={blocked} maxLength={12000} onChange={event=>{onInvalidate();setText(event.target.value);}} rows={4} className="my-2 w-full min-w-0 rounded-xl border border-input bg-background p-3 text-sm" placeholder="Ex.: notebook de R$ 3.000 em 6 parcelas; primeira vence em 10/11/2026. Recebi R$ 2.000 de salário em 05/11/2026."/>
    <p className="text-xs leading-5 text-muted-foreground">Ao analisar, o conteúdo é enviado ao provedor de IA para extração. Até 30 leituras por dia. O arquivo só é guardado no app se você confirmar a importação com a opção de anexar marcada.</p>
    <div className="my-3 flex flex-wrap gap-2"><button type="button" disabled={blocked||(!source&&!text.trim())} onClick={()=>void analyze()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">{reading?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}Analisar com IA</button><button type="button" disabled={blocked||items.length>=50} onClick={()=>{onInvalidate();setItems(current=>[...current,empty()]);}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm disabled:opacity-50"><Plus className="h-4 w-4"/>Preencher manualmente</button></div>
    {error&&<p role="alert" className="mb-3 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {warnings.length>0&&<ul className="mb-3 list-inside list-disc text-sm text-muted-foreground">{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}
    <div className="space-y-3">{items.map((item,index)=><fieldset key={item.key} className="rounded-xl border border-border p-3"><legend className="px-1 text-sm font-medium">Item {index+1}</legend><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {([['title','Descrição','text'],['date','Data de vencimento ou recebimento','date'],['amount','Valor total em R$','text'],['installments','Quantidade total de parcelas','number'],['startInstallment','Primeira parcela a importar','number']] as const).map(([field,label,type])=><label key={field} className="min-w-0 text-sm">{label}<input type={type} value={item[field]} disabled={blocked} min={field==='installments'||field==='startInstallment'?1:undefined} max={field==='installments'||field==='startInstallment'?360:undefined} inputMode={field==='amount'?'decimal':undefined} onChange={event=>update(item.key,field,event.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3"/></label>)}
      <label className="min-w-0 text-sm">Tipo<select aria-label="Tipo" value={item.type} disabled={blocked} onChange={event=>update(item.key,'type',event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"><option value="">Escolha</option><option>Despesa</option><option>Receita</option></select></label>
      <label className="min-w-0 text-sm">Situação<select aria-label="Situação" value={item.status} disabled={blocked} onChange={event=>update(item.key,'status',event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"><option value="Pendente">Pendente</option><option value="Concluido">Concluído</option></select></label>
      <label className="min-w-0 text-sm">Categoria (opcional)<input value={item.category} disabled={blocked} onChange={event=>update(item.key,'category',event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"/></label>
      <label className="min-w-0 text-sm">Observações<input value={item.notes} disabled={blocked} maxLength={1000} onChange={event=>update(item.key,'notes',event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"/></label>
    </div>{item.warnings.length>0&&<ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">{item.warnings.map((warning,n)=><li key={n}>{warning}</li>)}</ul>}<button type="button" disabled={blocked} onClick={()=>{onInvalidate();setItems(current=>current.filter(row=>row.key!==item.key));}} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-destructive"><X className="h-4 w-4"/>Remover item {index+1}</button></fieldset>)}</div>
    {items.length>0&&<button type="button" disabled={blocked} onClick={review} className="my-3 min-h-11 rounded-xl bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">Gerar prévia dos lançamentos</button>}
  </details>;
}
