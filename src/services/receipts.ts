import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { ReceiptDatabase, ReceiptMetadata } from '@/integrations/supabase/receiptTypes';
export const receiptBucket = 'deu-bom-comprovantes';
export const receiptClient = supabase as unknown as SupabaseClient<ReceiptDatabase>;
export interface ReceiptSource { file: File; storagePath: string }
export async function prepareReceipt(file: File, userId: string): Promise<ReceiptSource> {
  if (file.size > 12 * 1024 * 1024) throw new Error('Escolha uma imagem com até 12 MB ou um PDF com até 3 MB.');
  if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)) throw new Error('Use foto JPG/PNG/WebP ou PDF.');
  if (file.type === 'application/pdf' && await file.slice(0,5).text() !== '%PDF-') throw new Error('O arquivo não é um PDF válido.');
  let prepared = file;
  if (file.type.startsWith('image/')) {
    const image = await createImageBitmap(file).catch(() => { throw new Error('Não foi possível abrir a foto. Use JPG, PNG ou WebP.'); });
    try {
      const scale = Math.min(1, 2560 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a imagem.');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Não foi possível preparar a foto.')), 'image/jpeg', .88));
      prepared = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } finally { image.close(); }
  }
  if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(prepared.type)) throw new Error('Use foto JPG/PNG/WebP ou PDF.');
  if (prepared.size > 3 * 1024 * 1024) throw new Error('O arquivo preparado deve ter até 3 MB. Reduza ou divida o documento.');
  const extension = prepared.type === 'application/pdf' ? 'pdf' : prepared.type.split('/')[1];
  return { file: prepared, storagePath: `${userId}/${crypto.randomUUID()}.${extension}` };
}
export async function uploadReceipt(source: ReceiptSource, client = receiptClient): Promise<ReceiptMetadata> {
  const result = await client.storage.from(receiptBucket).upload(source.storagePath, source.file, { contentType: source.file.type, upsert: false });
  if (result.error) {
    const code = 'statusCode' in result.error ? String(result.error.statusCode) : 'status' in result.error ? String(result.error.status) : '';
    if (code !== '409') throw result.error;
  }
  return { storage_path: source.storagePath, file_name: source.file.name.slice(0,150), content_type: source.file.type, size_bytes: source.file.size };
}
export function receiptDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler o comprovante.')); reader.readAsDataURL(file); });
}
