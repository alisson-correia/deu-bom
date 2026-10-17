import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { seal, unseal, constantEqual } from './googleCrypto.js';
import { eventId, eventPayload, fingerprint, taskPayload, type FinanceRow } from './googleMapping.js';

type Request = IncomingMessage & { body?: Record<string, unknown> };
type Handler = (request: Request, response: ServerResponse) => Promise<void>;
type Connection = {
  user_id: string; google_account_sub: string; account_email: string;
  refresh_token: string | null; access_token: string | null; access_expires_at: string | null;
  task_list_id: string | null; calendar_id: string | null; time_zone: string;
  connected: boolean; sync_at: string | null;
};
type Link = {
  user_id: string; google_account_sub: string; transaction_id: string; task_id: string | null;
  event_id: string; app_fingerprint: string | null; app_status: string | null; google_status: string | null;
  google_updated_at: string | null; last_synced_at: string;
};
type GoogleTask = { id: string; title?: string; notes?: string; status: string; updated: string; deleted?: boolean; webViewLink?: string };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const projectUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const encryptionKey = () => process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
const origin = () => process.env.PUBLIC_APP_URL || 'https://deu-bom-financas-sem-erro.vercel.app';
const redirectUri = () => `${origin()}/api/google/callback`;
const configured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && /^[\da-f]{64}$/i.test(encryptionKey()));
const adminClient = () => createClient(projectUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '', { auth: { persistSession: false, autoRefreshToken: false } });
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body));
};
const body = (req: Request) => req.body && typeof req.body === 'object' ? req.body : {};
const requireMethod = (req: Request, method: string) => { if (req.method !== method) throw new ApiError(405, 'Método não permitido.'); };
const check = (error: { message: string } | null) => { if (error) throw new ApiError(503, 'Armazenamento da integração indisponível.'); };

async function authenticate(req: Request) {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) throw new ApiError(401, 'Entre na sua conta para continuar.');
  const token = bearer.slice(7);
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'Sessão expirada. Entre novamente.');
  const db = createClient(projectUrl(), process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '', {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, admin, db };
}
function route(fn: Handler): Handler {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (error) { json(res, error instanceof ApiError ? error.status : 503, { error: error instanceof ApiError ? error.message : 'Integração indisponível. Tente novamente mais tarde.' }); }
  };
}
async function google<T>(token: string, path: string, method = 'GET', input?: unknown): Promise<T> {
  const response = await fetch(`https://www.googleapis.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new ApiError(response.status, response.status === 401 ? 'Reconecte sua conta Google.' : 'O Google não concluiu a sincronização. Tente novamente.');
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
async function exchange(params: URLSearchParams) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new ApiError(401, 'Reconecte sua conta Google.');
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>;
}
async function accessToken(connection: Connection) {
  if (connection.access_token && connection.access_expires_at && Date.parse(connection.access_expires_at) > Date.now() + 60000) return unseal(connection.access_token, encryptionKey());
  if (!connection.refresh_token) throw new ApiError(401, 'Reconecte sua conta Google.');
  const token = await exchange(new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token', refresh_token: unseal(connection.refresh_token, encryptionKey()) }));
  const { error } = await adminClient().from('google_calendar_connections').update({ access_token: seal(token.access_token, encryptionKey()), access_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString() }).eq('user_id', connection.user_id);
  check(error); return token.access_token;
}

export const status = route(async (req, res) => {
  requireMethod(req, 'GET'); const { user, admin } = await authenticate(req);
  if (!configured()) { json(res, 200, { configured: false, connected: false, state: 'needs_configuration' }); return; }
  const { data, error } = await admin.from('google_calendar_connections').select('connected,account_email,sync_at').eq('user_id', user.id).maybeSingle(); check(error);
  json(res, 200, { configured: true, connected: Boolean(data?.connected), accountEmail: data?.account_email, syncAt: data?.sync_at, cronConfigured: false });
});

export const connect = route(async (req, res) => {
  requireMethod(req, 'POST'); const { user } = await authenticate(req);
  if (!configured()) throw new ApiError(503, 'Integração aguardando configuração.');
  const nonce = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
  let timeZone = typeof body(req).timeZone === 'string' ? String(body(req).timeZone) : 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('pt-BR', { timeZone }); } catch { timeZone = 'America/Sao_Paulo'; }
  const state = seal(JSON.stringify({ user: user.id, nonce, verifier, timeZone, expires: Date.now() + 600000 }), encryptionKey());
  res.setHeader('Set-Cookie', `deubom_google_state=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=600`);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: 'code', scope: 'openid email https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar.app.created', access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
  json(res, 200, { url: url.toString() });
});

export const callback = route(async (req, res) => {
  requireMethod(req, 'GET');
  const url = new URL(req.url || '', origin());
  const clearCookie = () => res.setHeader('Set-Cookie', 'deubom_google_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=0');
  try {
    const state = JSON.parse(unseal(url.searchParams.get('state') || '', encryptionKey())) as { user: string; nonce: string; verifier: string; timeZone: string; expires: number };
    const cookie = (req.headers.cookie || '').split(';').map((v) => v.trim()).find((v) => v.startsWith('deubom_google_state='))?.split('=')[1] || '';
    if (!constantEqual(cookie, state.nonce) || state.expires < Date.now() || state.expires > Date.now() + 600000 || !/^[\da-f-]{36}$/i.test(state.user)) throw new Error('Invalid state');
    clearCookie();
    if (url.searchParams.has('error')) throw new Error('Consent not granted');
    const code = url.searchParams.get('code'); if (!code) throw new Error('Missing code');
    const token = await exchange(new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'authorization_code', code, code_verifier: state.verifier, redirect_uri: redirectUri() }));
    const requiredScopes = ['https://www.googleapis.com/auth/tasks', 'https://www.googleapis.com/auth/calendar.app.created'];
    if (!requiredScopes.every((scope) => (token.scope || '').split(' ').includes(scope))) throw new Error('Missing scopes');
    const account = await google<{ sub: string; email: string }>(token.access_token, '/oauth2/v3/userinfo');
    const admin = adminClient();
    const { data: previous, error: readError } = await admin.from('google_calendar_connections').select('*').eq('user_id', state.user).maybeSingle(); check(readError);
    const sameAccount = previous?.google_account_sub === account.sub;
    const refreshToken = token.refresh_token ? seal(token.refresh_token, encryptionKey()) : sameAccount ? previous.refresh_token : null;
    if (!refreshToken) throw new Error('Missing refresh token');
    const { error } = await admin.from('google_calendar_connections').upsert({ user_id: state.user, google_account_sub: account.sub, account_email: account.email, refresh_token: refreshToken, access_token: seal(token.access_token, encryptionKey()), access_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), connected: true, time_zone: state.timeZone, task_list_id: sameAccount ? previous.task_list_id : null, calendar_id: sameAccount ? previous.calendar_id : null, sync_locked_until: null, updated_at: new Date().toISOString() }); check(error);
    res.statusCode = 302; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Location', `${origin()}/settings?google=connected`); res.end();
  } catch { clearCookie(); res.statusCode = 302; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Location', `${origin()}/settings?google=error`); res.end(); }
});

export const disconnect = route(async (req, res) => {
  requireMethod(req, 'POST'); const { user, admin } = await authenticate(req);
  const { data, error } = await admin.from('google_calendar_connections').select('*').eq('user_id', user.id).maybeSingle(); check(error);
  if (data?.refresh_token && encryptionKey()) {
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: unseal(data.refresh_token, encryptionKey()) }), signal: AbortSignal.timeout(15000) });
    if (!response.ok && response.status !== 400) throw new ApiError(502, 'O Google não confirmou a desconexão. Tente novamente.');
  }
  const { error: updateError } = await admin.from('google_calendar_connections').update({ connected: false, access_token: null, refresh_token: null, access_expires_at: null, sync_locked_until: null }).eq('user_id', user.id); check(updateError);
  json(res, 200, { connected: false });
});

export const sync = route(async (req, res) => {
  requireMethod(req, 'POST'); const { user, admin, db } = await authenticate(req);
  if (!configured()) throw new ApiError(503, 'Integração aguardando configuração.');
  const { data, error } = await admin.from('google_calendar_connections').update({ sync_locked_until: new Date(Date.now() + 60000).toISOString() }).eq('user_id', user.id).eq('connected', true).or(`sync_locked_until.is.null,sync_locked_until.lt.${new Date().toISOString()}`).select('*').maybeSingle(); check(error);
  if (!data) throw new ApiError(429, 'Sincronização em andamento ou conexão indisponível.');
  const connection = data as Connection;
  let processed = 0, completed = 0, updated = 0, errors = 0;
  try {
    const token = await accessToken(connection);
    if (!connection.task_list_id) {
      const list = await google<{ id: string }>(token, '/tasks/v1/users/@me/lists', 'POST', { title: 'Deu Bom · Finanças' }); connection.task_list_id = list.id;
      const result = await admin.from('google_calendar_connections').update({ task_list_id: list.id }).eq('user_id', user.id); check(result.error);
    }
    if (!connection.calendar_id) {
      const calendar = await google<{ id: string }>(token, '/calendar/v3/calendars', 'POST', { summary: 'Deu Bom · Lembretes', description: 'Lembretes financeiros vinculados às tarefas Deu Bom. Não bloqueiam horários.', timeZone: connection.time_zone }); connection.calendar_id = calendar.id;
      const result = await admin.from('google_calendar_connections').update({ calendar_id: calendar.id }).eq('user_id', user.id); check(result.error);
    }
    const workspace = body(req).workspaceId;
    if (workspace !== null && workspace !== undefined && (typeof workspace !== 'string' || !/^[\da-f-]{36}$/i.test(workspace))) throw new ApiError(400, 'Workspace inválido.');
    // The authenticated user's RLS client scopes both reads and financial updates.
    const transactions: FinanceRow[] = [];
    for (let page = 0; ; page += 1) {
      let query = db.from('transactions').select('id,user_id,workspace_id,title,amount,type,date,status,updated_at').order('date', { ascending: false }).order('id').range(page * 1000, page * 1000 + 999);
      query = workspace ? query.eq('workspace_id', workspace) : query.is('workspace_id', null).eq('user_id', user.id);
      const rows = await query; check(rows.error);
      const items = (rows.data || []) as FinanceRow[]; transactions.push(...items);
      if (items.length < 1000) break;
    }
    const linkRows: Link[] = [];
    for (let page = 0; ; page += 1) {
      const result = await admin.from('google_calendar_links').select('*').eq('user_id', user.id).eq('google_account_sub', connection.google_account_sub).order('transaction_id').range(page * 1000, page * 1000 + 999); check(result.error);
      const items = (result.data || []) as Link[]; linkRows.push(...items);
      if (items.length < 1000) break;
    }
    const links = new Map(linkRows.map((item) => [item.transaction_id, item]));
    // Read only existence metadata with the server role to distinguish deletion
    // from a record that is merely outside the current workspace/RLS scope.
    const linkedIds = [...links.keys()];
    const existingIds = new Set<string>();
    for (let offset = 0; offset < linkedIds.length; offset += 100) {
      const existence = await admin.from('transactions').select('id').in('id', linkedIds.slice(offset, offset + 100)); check(existence.error);
      for (const item of existence.data || []) existingIds.add(item.id);
    }
    for (const link of [...links.values()].filter((item) => !existingIds.has(item.transaction_id)).slice(0, 8)) {
      try {
        for (const path of [link.task_id ? `/tasks/v1/lists/${encodeURIComponent(connection.task_list_id)}/tasks/${encodeURIComponent(link.task_id)}` : null, `/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events/${link.event_id}`]) {
          if (!path) continue;
          try { await google(token, path, 'DELETE'); } catch (e) { if (!(e instanceof ApiError) || ![404, 410].includes(e.status)) throw e; }
        }
        const removed = await admin.from('google_calendar_links').delete().eq('user_id', user.id).eq('google_account_sub', connection.google_account_sub).eq('transaction_id', link.transaction_id); check(removed.error);
        links.delete(link.transaction_id);
      } catch { errors += 1; }
    }
    const ordered = transactions.sort((a, b) => {
      const first = links.get(a.id), second = links.get(b.id);
      const aChanged = !first || first.app_fingerprint !== fingerprint(a), bChanged = !second || second.app_fingerprint !== fingerprint(b);
      return Number(bChanged) - Number(aChanged) || Date.parse(first?.last_synced_at || '1970-01-01') - Date.parse(second?.last_synced_at || '1970-01-01');
    });
    const batch = ordered.slice(0, 8);
    for (const original of batch) {
      let row = original;
      const link = links.get(row.id);
      try {
        let task: GoogleTask | null = null;
        if (link?.task_id) {
          try { task = await google<GoogleTask>(token, `/tasks/v1/lists/${encodeURIComponent(connection.task_list_id)}/tasks/${encodeURIComponent(link.task_id)}`); }
          catch (e) { if (!(e instanceof ApiError) || ![404, 410].includes(e.status)) throw e; }
        }
        if (task?.deleted) task = null;
        if (task && link) {
          const remoteChanged = task.status !== link.google_status && task.updated !== link.google_updated_at;
          const appChanged = fingerprint(row) !== link.app_fingerprint;
          if (remoteChanged && (!appChanged || Date.parse(task.updated) > Date.parse(row.updated_at))) {
            const nextStatus = task.status === 'completed' ? 'completed' : 'pending';
            if (row.status !== nextStatus) {
              const result = await db.from('transactions').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', row.id).eq('updated_at', row.updated_at).select('id,user_id,workspace_id,title,amount,type,date,status,updated_at').maybeSingle();
              check(result.error); if (!result.data) throw new ApiError(409, 'O lançamento mudou. Tente novamente.');
              row = result.data as FinanceRow; Object.assign(original, row); updated += 1; if (nextStatus === 'completed') completed += 1;
            }
          }
        }
        if (!task) {
          // Recover a task created just before an interrupted link write.
          let pageToken = '';
          for (let page = 0; page < 10; page += 1) {
            const list = await google<{ items?: GoogleTask[]; nextPageToken?: string }>(token, `/tasks/v1/lists/${encodeURIComponent(connection.task_list_id)}/tasks?showCompleted=true&showHidden=true&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
            task = list.items?.find((item) => !item.deleted && item.notes?.split('\n')[0] === `deu-bom:${row.id}`) || null;
            if (task || !list.nextPageToken) break;
            pageToken = list.nextPageToken;
          }
          if (!task) task = await google<GoogleTask>(token, `/tasks/v1/lists/${encodeURIComponent(connection.task_list_id)}/tasks`, 'POST', taskPayload(row, origin()));
          const saved = await admin.from('google_calendar_links').upsert({ user_id: user.id, google_account_sub: connection.google_account_sub, transaction_id: row.id, task_id: task.id, event_id: eventId(user.id, connection.google_account_sub, row.id) }); check(saved.error);
        }
        if (task.status !== (row.status === 'completed' ? 'completed' : 'needsAction') || !link || fingerprint(row) !== link.app_fingerprint) {
          task = await google<GoogleTask>(token, `/tasks/v1/lists/${encodeURIComponent(connection.task_list_id)}/tasks/${encodeURIComponent(task.id)}`, 'PATCH', taskPayload(row, origin()));
        }
        const id = eventId(user.id, connection.google_account_sub, row.id);
        if (!link || fingerprint(row) !== link.app_fingerprint) {
          const payload = eventPayload(row, connection.time_zone, origin(), task.webViewLink);
          try { await google(token, `/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events/${id}`, 'PUT', { id, ...payload }); }
          catch (e) { if (!(e instanceof ApiError) || ![404, 410].includes(e.status)) throw e; await google(token, `/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`, 'POST', { id, ...payload }); }
        }
        const result = await admin.from('google_calendar_links').upsert({ user_id: user.id, google_account_sub: connection.google_account_sub, transaction_id: row.id, task_id: task.id, event_id: id, app_fingerprint: fingerprint(row), app_status: row.status, google_status: task.status, google_updated_at: task.updated, last_synced_at: new Date().toISOString() }); check(result.error);
        links.set(row.id, { user_id: user.id, google_account_sub: connection.google_account_sub, transaction_id: row.id, task_id: task.id, event_id: id, app_fingerprint: fingerprint(row), app_status: row.status, google_status: task.status, google_updated_at: task.updated, last_synced_at: new Date().toISOString() });
        processed += 1;
      } catch { errors += 1; }
    }
    const syncAt = new Date().toISOString();
    const result = await admin.from('google_calendar_connections').update({ sync_at: syncAt }).eq('user_id', user.id); check(result.error);
    const remaining = transactions.filter((row) => !links.has(row.id) || links.get(row.id)!.app_fingerprint !== fingerprint(row)).length;
    json(res, 200, { processed, completed, updated, remaining, errors, syncAt });
  } finally { await admin.from('google_calendar_connections').update({ sync_locked_until: null }).eq('user_id', user.id); }
});
