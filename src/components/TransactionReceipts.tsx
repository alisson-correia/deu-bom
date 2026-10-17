import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { prepareReceipt, receiptBucket, receiptClient, uploadReceipt } from '@/services/receipts';
import type { ReceiptAttachment } from '@/integrations/supabase/receiptTypes';
import { getErrorMessage } from '@/utils/errors';

export function TransactionReceipts({ transactionId }: { transactionId: string }) {
  const { user } = useAuth(); const { currentWorkspace, userRole } = useWorkspace();
  const canEdit = Boolean(user) && (!currentWorkspace || userRole === 'owner' || userRole === 'editor');
  const [rows,setRows]=useState<(ReceiptAttachment & {url?:string})[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null),epoch=useRef(0);
  const load=useCallback(async()=>{
    const version=++epoch.current;
    const result=await receiptClient.from('transaction_attachments').select('*').eq('transaction_id',transactionId).order('created_at');
    if(version!==epoch.current)return;
    if(result.error){setError('Não foi possível carregar os comprovantes. Tente atualizar a lista.');return;}
    const prepared=await Promise.all((result.data||[]).map(async row=>{const link=await receiptClient.storage.from(receiptBucket).createSignedUrl(row.storage_path,300);return {...row,url:link.data?.signedUrl};}));
    if(version===epoch.current){setRows(prepared);setError('');}
  },[transactionId]);
  useEffect(()=>{void load();return()=>{epoch.current+=1;};},[load]);
  const upload=async(file?:File)=>{
    if(!file||!user||!canEdit||busy)return;setBusy(true);setError('');
    let path:string|undefined;
    try{const source=await prepareReceipt(file,user.id);path=source.storagePath;const metadata=await uploadReceipt(source);const result=await receiptClient.from('transaction_attachments').insert({transaction_id:transactionId,user_id:user.id,...metadata});if(result.error)throw result.error;await load();}
    catch(cause){if(path)void receiptClient.storage.from(receiptBucket).remove([path]);setError(getErrorMessage(cause,'Não foi possível anexar o comprovante.'));}
    finally{setBusy(false);}
  };
  const remove=async(row:ReceiptAttachment)=>{
    if(busy||!canEdit)return;setBusy(true);setError('');
    try{const result=await receiptClient.from('transaction_attachments').delete().eq('id',row.id);if(result.error)throw result.error;const remaining=await receiptClient.from('transaction_attachments').select('id',{count:'exact',head:true}).eq('storage_path',row.storage_path);if(!remaining.error&&remaining.count===0)await receiptClient.storage.from(receiptBucket).remove([row.storage_path]);await load();}
    catch(cause){setError(getErrorMessage(cause,'Não foi possível remover o comprovante.'));}finally{setBusy(false);}
  };
  return <section aria-label="Comprovantes do lançamento" className="mb-6 rounded-xl border border-border p-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="h-4 w-4"/>Comprovantes</h3>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Fotos e PDFs privados, acessíveis a quem pode visualizar este lançamento. Os links de abertura valem por 5 minutos.</p>
    {rows.length>0&&<ul className="mt-2 divide-y divide-border">{rows.map(row=><li key={row.id} className="flex min-w-0 items-center gap-2 py-2"><span className="min-w-0 flex-1 break-all text-sm">{row.url?<a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline">{row.file_name}</a>:row.file_name}</span>{canEdit&&<button type="button" disabled={busy} onClick={()=>void remove(row)} aria-label={`Remover comprovante ${row.file_name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></button>}</li>)}</ul>}
    <div className="mt-2 flex flex-wrap gap-2">{canEdit&&<button type="button" disabled={busy} onClick={()=>fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm disabled:opacity-50"><Upload className="h-4 w-4"/>{busy?'Aguarde...':'Anexar foto ou PDF'}</button>}<button type="button" disabled={busy} onClick={()=>void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4"/>Atualizar links</button></div>
    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Anexar comprovante ao lançamento" className="hidden" onChange={event=>{void upload(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
    {error&&<p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </section>;
}
