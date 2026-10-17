import type { Database, Json } from './types';
export type ReceiptAttachment = {
  id: string; transaction_id: string; user_id: string; storage_path: string; file_name: string;
  content_type: string; size_bytes: number; created_at: string;
};
export type ReceiptMetadata = Pick<ReceiptAttachment, 'storage_path' | 'file_name' | 'content_type' | 'size_bytes'>;
export type ReceiptDatabase = Database & { public: Database['public'] & {
  Tables: Database['public']['Tables'] & { transaction_attachments: {
    Row: ReceiptAttachment;
    Insert: Omit<ReceiptAttachment, 'id' | 'created_at'> & { id?: string; created_at?: string };
    Update: Partial<ReceiptAttachment>;
    Relationships: [];
  } };
  Functions: Database['public']['Functions'] & { import_finance_batch: {
    Args: { batch: Json; target_workspace?: string | null; receipt?: Json | null }; Returns: number;
  } };
} };
