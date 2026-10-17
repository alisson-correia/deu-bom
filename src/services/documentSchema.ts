import { z } from 'zod';
export const documentItemSchema = z.object({
  title: z.string().max(200).nullable(),
  amount: z.number().positive().max(1000000000).nullable(),
  amountKind: z.enum(['total','per_installment','unknown']),
  type: z.enum(['income','expense']).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  installments: z.number().int().min(1).max(360).nullable(),
  installmentNumber: z.number().int().min(1).max(360).nullable(),
  status: z.enum(['pending','completed']).nullable(),
  category: z.string().max(100).nullable(),
  notes: z.string().max(1000).nullable(),
  warnings: z.array(z.string().max(250)).max(10),
}).strict();
export const documentExtractionSchema = z.object({ items: z.array(documentItemSchema).max(50), warnings: z.array(z.string().max(250)).max(20) }).strict();
export type DocumentItem = z.infer<typeof documentItemSchema>;
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;
