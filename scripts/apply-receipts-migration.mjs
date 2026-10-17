import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { rootCertificates } from 'node:tls';

const value = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!value) throw new Error('A conexão administrativa PostgreSQL não está configurada.');
const url = new URL(value);
url.searchParams.delete('sslmode');
// Supabase's published database CA; keep chain and hostname verification enabled.
const ca = await readFile(new URL('./certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ca: [...rootCertificates, ca] }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('deu-bom-receipts-migration'))");
  await client.query(await readFile(new URL('../supabase/migrations/20261017230000_receipts_and_bulk_import.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Comprovantes privados e importação em lote preparados.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migração de comprovantes não concluída:', error.code || 'connection_error');
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
