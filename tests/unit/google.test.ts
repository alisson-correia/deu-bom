import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { seal, unseal, constantEqual } from '../../server/googleCrypto';
import { eventId, eventPayload, fingerprint, taskPayload, type FinanceRow } from '../../server/googleMapping';
import { callback, connect, status, sync } from '../../server/google';

const key = 'ab'.repeat(32);
const user = '11111111-1111-4111-8111-111111111111';
const row: FinanceRow = { id: '22222222-2222-4222-8222-222222222222', user_id: user, workspace_id: null, title: 'Aluguel', amount: 123.45, type: 'expense', date: '2026-11-05', status: 'pending', updated_at: '2026-10-17T10:00:00Z' };
const req = (method: string, url = '/', headers = {}, body = {}) => Object.assign({ method, url, headers }, { body }) as IncomingMessage & { body: Record<string, unknown> };
function response() {
  const data = { status: 200, headers: {} as Record<string, unknown>, text: '' };
  const res = { setHeader(name: string, value: unknown) { data.headers[name] = value; }, end(value = '') { data.text = value; }, get statusCode() { return data.status; }, set statusCode(value: number) { data.status = value; } } as unknown as ServerResponse;
  return { data, res };
}

test('tokens e state OAuth têm criptografia autenticada e rejeitam alterações', () => {
  const encrypted = seal('refresh-token-example', key);
  assert.equal(unseal(encrypted, key), 'refresh-token-example');
  assert.notEqual(encrypted, seal('refresh-token-example', key));
  const bytes = Buffer.from(encrypted, 'base64url'); bytes[bytes.length - 1] ^= 1;
  assert.throws(() => unseal(bytes.toString('base64url'), key));
  assert.equal(constantEqual('nonce', 'nonce'), true); assert.equal(constantEqual('nonce', ''), false);
});

test('tarefas preservam a data e eventos têm vermelho/verde sem bloquear a agenda', () => {
  assert.equal(taskPayload(row, 'https://example.test').due, '2026-11-05T00:00:00.000Z');
  const event = eventPayload(row, 'America/Sao_Paulo', 'https://example.test');
  assert.equal(event.transparency, 'transparent'); assert.equal(event.colorId, '11'); assert.equal(event.start.dateTime, '2026-11-05T09:00:00');
  assert.deepEqual(event.reminders.overrides.map((item) => item.minutes), [1440, 0]);
  const paid = eventPayload({ ...row, type: 'income', status: 'completed' }, 'America/Sao_Paulo', 'https://example.test');
  assert.equal(paid.colorId, '10'); assert.deepEqual(paid.reminders.overrides, []);
  assert.notEqual(eventId(user, 'account', row.id), eventId('other-user', 'account', row.id));
});

test('rotas protegidas não aceitam sessão ausente e callback rejeita state sem cookie ou expirado', async () => {
  for (const handler of [status, sync]) {
    const { data, res } = response(); await handler(req(handler === status ? 'GET' : 'POST'), res); assert.equal(data.status, 401);
  }
  const method = response(); await connect(req('GET'), method.res); assert.equal(method.data.status, 405);
  const previous = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY; process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = key;
  try {
    for (const [expires, cookie] of [[Date.now() + 60000, ''], [Date.now() - 1, 'nonce']] as const) {
      const state = seal(JSON.stringify({ user, nonce: 'nonce', verifier: 'example', timeZone: 'America/Sao_Paulo', expires }), key);
      const { data, res } = response(); await callback(req('GET', `/?state=${state}&code=example`, { cookie: `deubom_google_state=${cookie}` }), res);
      assert.equal(data.status, 302); assert.match(String(data.headers.Location), /google=error$/); assert.equal(data.text, '');
    }
  } finally { if (previous === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY; else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previous; }
});

test('conclusão no Google atualiza finanças pela sessão RLS e limpa os lembretes do evento', async () => {
  const originalFetch = globalThis.fetch;
  const env = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_TOKEN_ENCRYPTION_KEY'];
  const before = Object.fromEntries(env.map((name) => [name, process.env[name]]));
  Object.assign(process.env, { SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'server-test-key', VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key', GOOGLE_CLIENT_ID: 'client-test', GOOGLE_CLIENT_SECRET: 'secret-test', GOOGLE_TOKEN_ENCRYPTION_KEY: key });
  let writes = 0; let eventReminders: unknown; const calls: string[] = [];
  const connection = { user_id: user, google_account_sub: 'google-user', account_email: 'test@example.test', access_token: seal('google-token-example', key), refresh_token: seal('refresh-example', key), access_expires_at: new Date(Date.now() + 3600000).toISOString(), connected: true, task_list_id: 'list', calendar_id: 'calendar', time_zone: 'America/Sao_Paulo' };
  const link = { user_id: user, google_account_sub: 'google-user', transaction_id: row.id, task_id: 'task', event_id: eventId(user, 'google-user', row.id), app_fingerprint: fingerprint(row), app_status: 'pending', google_status: 'needsAction', google_updated_at: row.updated_at, last_synced_at: row.updated_at };
  globalThis.fetch = async (input, options) => {
    const request = new Request(input, options); const url = new URL(request.url); calls.push(url.pathname);
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/auth/v1/user') return reply({ id: user, email: 'test@example.test' });
    if (url.pathname.endsWith('/google_calendar_connections')) return reply(request.headers.get('accept')?.includes('vnd.pgrst.object') ? connection : [connection]);
    if (url.pathname.endsWith('/google_calendar_links')) return request.method === 'GET' ? reply([link]) : new Response(null, { status: 201 });
    if (url.pathname.endsWith('/transactions')) {
      if (request.method === 'PATCH') {
        assert.equal(request.headers.get('Authorization'), 'Bearer user-session-example');
        const value = await request.json(); assert.equal(value.status, 'completed'); writes += 1;
        return reply({ ...row, status: 'completed', updated_at: new Date().toISOString() });
      }
      return reply(url.searchParams.get('select') === 'id' ? [{ id: row.id }] : [row]);
    }
    if (url.pathname.includes('/tasks/')) return reply({ id: 'task', status: 'completed', updated: '2026-10-17T11:00:00Z' });
    if (url.pathname.includes('/events/')) { const event = await request.json(); eventReminders = event.reminders.overrides; return reply({ id: link.event_id }); }
    throw new Error(`Unexpected path ${url.pathname}`);
  };
  try {
    const { data, res } = response(); await sync(req('POST', '/', { authorization: 'Bearer user-session-example' }, { workspaceId: null }), res);
    assert.equal(data.status, 200, JSON.stringify({ body: data.text, calls })); assert.equal(writes, 1); assert.deepEqual(eventReminders, []);
    const result = JSON.parse(data.text); assert.equal(result.completed, 1); assert.equal(result.updated, 1); assert.equal(result.errors, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of env) { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; }
  }
});
