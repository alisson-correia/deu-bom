import { readFile } from 'node:fs/promises';
import pg from 'pg';

const value = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!value) throw new Error('A conexão administrativa PostgreSQL não está configurada.');
const url = new URL(value);
url.searchParams.delete('sslmode');
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('deu-bom-google-migration'))");
  await client.query(await readFile(new URL('../supabase/migrations/20261017190000_google_calendar_integration.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Estruturas privadas da integração Google preparadas.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migração Google não concluída:', error.code || 'connection_error');
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
