import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useFinanceStore } from '@/stores/financeStore';

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  accountEmail?: string;
  syncAt?: string;
  cronConfigured?: boolean;
  state?: string;
}

interface SyncProblem { message: string; actionUrl?: string }

interface SyncResult {
  processed: number;
  remaining: number;
  completed: number;
  updated: number;
  errors: number;
  issues?: SyncProblem[];
  syncAt?: string;
}

interface GoogleIntegrationContextValue extends GoogleStatus {
  loading: boolean;
  busy: boolean;
  pending: number;
  problem: SyncProblem | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: (manual?: boolean) => Promise<void>;
}

const GoogleIntegrationContext = createContext<GoogleIntegrationContextValue | undefined>(undefined);
const unavailable: GoogleStatus = { configured: false, connected: false };

class GoogleRequestError extends Error {
  constructor(public status: number, message: string, public actionUrl?: string) { super(message); }
}

interface IntegrationScope {
  key: string;
  userId?: string;
  workspaceId: string | null;
  controller: AbortController;
  busy: boolean;
}

export const GoogleIntegrationProvider = ({ children }: { children: ReactNode }) => {
  const { session, user } = useAuth();
  const userId = user?.id;
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [status, setStatus] = useState<GoogleStatus>(unavailable);
  const [loading, setLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const scopeKey = `${userId ?? 'signed-out'}:${currentWorkspace?.id ?? 'personal'}`;
  const tokenRef = useRef({ userId: session?.user.id, value: session?.access_token });
  tokenRef.current = { userId: session?.user.id, value: session?.access_token };
  const statusRef = useRef(status);
  statusRef.current = status;
  const scopeRef = useRef<IntegrationScope | null>(null);
  const signature = useFinanceStore((state) => JSON.stringify(state.transactions.map((item) => [item.id, item.status, item.updatedAt, item.title, item.amount, item.date]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  const previousSignature = useRef(signature);

  const isCurrent = useCallback((scope: IntegrationScope) => scopeRef.current === scope && !scope.controller.signal.aborted, []);

  useLayoutEffect(() => {
    const scope: IntegrationScope = { key: scopeKey, userId, workspaceId: currentWorkspace?.id ?? null, controller: new AbortController(), busy: false };
    scopeRef.current = scope;
    statusRef.current = unavailable;
    setStatus(unavailable);
    setPending(0);
    setProblem(null);
    setBusy(false);
    setLoading(Boolean(userId));
    previousSignature.current = '';
    return () => {
      scope.controller.abort();
      if (scopeRef.current === scope) scopeRef.current = null;
    };
  }, [scopeKey, userId, currentWorkspace?.id]);

  const request = useCallback(async <T,>(scope: IntegrationScope, endpoint: string, method = 'GET', body?: object): Promise<T> => {
    if (!isCurrent(scope)) throw new DOMException("Integração cancelada", "AbortError");
    const accessToken = tokenRef.current.userId === scope.userId ? tokenRef.current.value : undefined;
    if (!accessToken) throw new GoogleRequestError(401, 'Entre novamente para conectar sua agenda.');
    const response = await fetch(`/api/google/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: scope.controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string; actionUrl?: string };
      throw new GoogleRequestError(response.status, error.error || (response.status === 429 ? 'A sincronização já está em andamento. Tente novamente em instantes.' : 'Não foi possível acessar a integração Google. Tente novamente.'), error.actionUrl);
    }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new GoogleRequestError(503, 'Integração aguardando configuração.');
    const result = await response.json() as T;
    if (!isCurrent(scope)) throw new DOMException("Integração cancelada", "AbortError");
    return result;
  }, [isCurrent]);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || !userId || workspaceLoading) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    request<GoogleStatus>(scope, 'status').then((result) => {
      if (active && isCurrent(scope)) setStatus({ ...result, configured: result.configured === true, connected: result.connected === true });
    }).catch(() => { if (active && isCurrent(scope)) setStatus(unavailable); }).finally(() => { if (active && isCurrent(scope)) setLoading(false); });
    return () => { active = false; };
  }, [request, userId, workspaceLoading, scopeKey, isCurrent]);

  const sync = useCallback(async (manual = false) => {
    const scope = scopeRef.current;
    if (!scope || !isCurrent(scope) || scope.busy || workspaceLoading || !statusRef.current.connected || !userId) return;
    scope.busy = true;
    setBusy(true);
    let changed = 0;
    let errors = 0;
    let remaining = 0;
    let issue: SyncProblem | null = null;
    try {
      for (let batch = 0; batch < 10; batch += 1) {
        const result = await request<SyncResult>(scope, 'sync', 'POST', { workspaceId: scope.workspaceId });
        if (!isCurrent(scope)) return;
        changed += Number(result.completed || 0) + Number(result.updated || 0);
        errors += Number(result.errors || 0);
        issue = result.issues?.[0] || issue;
        remaining = Number(result.remaining || 0);
        setPending(remaining);
        setStatus((previous) => ({ ...previous, syncAt: result.syncAt ?? previous.syncAt }));
        if (remaining <= 0 || Number(result.processed || 0) <= 0 || errors > 0) break;
      }
      if (!isCurrent(scope)) return;
      if (changed > 0) await useFinanceStore.getState().refreshData();
      if (!isCurrent(scope)) return;
      previousSignature.current = JSON.stringify(useFinanceStore.getState().transactions.map((item) => [item.id, item.status, item.updatedAt, item.title, item.amount, item.date]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
      setProblem(errors > 0 ? issue || { message: 'Alguns itens não foram sincronizados. Tente novamente.' } : null);
      if (manual && isCurrent(scope)) {
        if (errors > 0) toast.warning('Alguns itens não foram sincronizados. Tente novamente.');
        else if (remaining > 0) toast.info('Ainda há itens pendentes. Toque em Sincronizar agora para continuar.');
        else toast.success('Agenda sincronizada.');
      }
    } catch (error) {
      if (isCurrent(scope)) {
        const next = { message: error instanceof Error ? error.message : 'Não foi possível sincronizar a agenda.', actionUrl: error instanceof GoogleRequestError ? error.actionUrl : undefined };
        setProblem(next);
        if (manual) toast.error(next.message);
      }
    } finally {
      scope.busy = false;
      if (isCurrent(scope)) setBusy(false);
    }
  }, [request, userId, workspaceLoading, isCurrent]);

  useEffect(() => {
    if (!status.connected || workspaceLoading) return;
    const run = () => { if (document.visibilityState === 'visible') void sync(); };
    run();
    const timer = window.setInterval(run, 60_000);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', run); document.removeEventListener('visibilitychange', run); };
  }, [status.connected, sync, workspaceLoading]);

  useEffect(() => {
    if (signature === previousSignature.current) return;
    previousSignature.current = signature;
    if (!status.connected || scopeRef.current?.busy) return;
    const timer = window.setTimeout(() => { if (document.visibilityState === 'visible') void sync(); }, 2_000);
    return () => window.clearTimeout(timer);
  }, [signature, status.connected, sync]);

  const connect = useCallback(async () => {
    const scope = scopeRef.current;
    if (!scope || !isCurrent(scope) || scope.busy || !statusRef.current.configured) return;
    scope.busy = true;
    setBusy(true);
    try {
      const result = await request<{ url: string }>(scope, 'connect', 'POST', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (!isCurrent(scope)) return;
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('Não foi possível iniciar a autorização Google.');
      window.location.assign(url.href);
    } catch (error) {
      if (isCurrent(scope)) toast.error(error instanceof Error ? error.message : 'Não foi possível conectar o Google.');
    } finally {
      scope.busy = false;
      if (isCurrent(scope)) setBusy(false);
    }
  }, [request, isCurrent]);

  const disconnect = useCallback(async () => {
    const scope = scopeRef.current;
    if (!scope || !isCurrent(scope) || scope.busy) return;
    scope.busy = true;
    setBusy(true);
    try {
      await request(scope, 'disconnect', 'POST');
      if (!isCurrent(scope)) return;
      setStatus((previous) => ({ ...previous, connected: false, accountEmail: undefined, syncAt: undefined }));
      setPending(0);
      toast.success('Conta Google desconectada.');
    } catch (error) {
      if (isCurrent(scope)) toast.error(error instanceof Error ? error.message : 'Não foi possível desconectar.');
    } finally {
      scope.busy = false;
      if (isCurrent(scope)) setBusy(false);
    }
  }, [request, isCurrent]);

  return <GoogleIntegrationContext.Provider value={{ ...status, loading, busy, pending, problem, connect, disconnect, sync }}>{children}</GoogleIntegrationContext.Provider>;
};

export const useGoogleIntegration = () => {
  const context = useContext(GoogleIntegrationContext);
  if (!context) throw new Error('useGoogleIntegration requires GoogleIntegrationProvider');
  return context;
};
