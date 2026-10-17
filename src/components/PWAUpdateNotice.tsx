import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdateNotice: React.FC = () => {
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null);
  const [versionChanged, setVersionChanged] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, next) { setRegistration(next ?? null); },
  });
  React.useEffect(() => {
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking || !navigator.onLine || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        if (registration?.waiting) setNeedRefresh(true);
        await registration?.update();
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!response.ok) return;
        const next = await response.json();
        if (active && typeof next.version === 'string' && next.version !== __APP_VERSION__) setVersionChanged(true);
      } catch { /* Offline: preserve the current app and any unsaved form. */ }
      finally { checking = false; }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    // Old versions cached authenticated responses. The new worker only caches app assets.
    if ('caches' in window) void caches.delete('supabase-cache').catch(() => undefined);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [registration, setNeedRefresh]);

  if ((!needRefresh && !versionChanged) || dismissed) return null;
  const update = async () => {
    if (!window.confirm('Atualizar o app? Salve seus formulários antes de continuar. Alterações não salvas serão perdidas.')) return;
    if (registration?.waiting || needRefresh) await updateServiceWorker(true);
    else window.location.reload();
  };
  return <aside role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-[90] md:bottom-5">
    <div className="mx-auto flex max-w-lg flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-lg">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Nova versão disponível</p><p className="text-xs text-muted-foreground">Salve suas alterações antes de atualizar.</p></div>
      <button type="button" onClick={() => void update()} className="touch-btn inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm text-primary-foreground"><RefreshCcw className="h-4 w-4" />Atualizar app</button>
      <button type="button" onClick={() => setDismissed(true)} className="touch-btn min-h-11 rounded-xl border border-border px-3 text-sm">Depois</button>
    </div>
  </aside>;
};
