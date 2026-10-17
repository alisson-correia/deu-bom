import { CalendarDays, CheckCircle2, Link2, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { useGoogleIntegration } from '@/hooks/useGoogleIntegration';

export const GoogleIntegrationPanel = () => {
  const { configured, connected, accountEmail, syncAt, loading, busy, pending, connect, disconnect, sync } = useGoogleIntegration();
  const date = syncAt ? new Date(syncAt) : null;
  const syncLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
  const callbackError = new URLSearchParams(window.location.search).get('google') === 'error';
  return <div className="space-y-5 p-4 sm:p-5">
    {callbackError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">A conexão Google não foi concluída. Tente novamente e confira as permissões solicitadas.</p>}
    <div className="flex items-start gap-3">
      <CalendarDays aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
      <div className="min-w-0"><p className="font-medium">Google Agenda e Tarefas</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Acompanhe seus lançamentos no Google e marque as tarefas quando concluir.</p></div>
    </div>
    <div className="rounded-xl border border-border p-4" aria-busy={loading || busy}>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Verificando conexão...</p> : connected ? <>
        <p className="flex items-center gap-2 font-medium"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />Google conectado</p>
        {accountEmail && <p className="mt-1 break-all text-sm text-muted-foreground">{accountEmail}</p>}
        <p className="mt-3 text-sm text-muted-foreground" role="status">{busy ? 'Sincronizando...' : syncLabel ? `Última sincronização: ${syncLabel}` : 'A primeira sincronização será feita com o app aberto.'}</p>
        {pending > 0 && <p className="mt-2 text-sm">{pending} item(ns) aguardando sincronização.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void sync(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Sincronizar agora</button>
          <button type="button" disabled={busy} onClick={() => void disconnect()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"><Unplug aria-hidden="true" className="h-4 w-4" />Desconectar</button>
        </div>
      </> : <>
        <p className="font-medium">{configured ? 'Conecte sua conta Google' : 'Integração aguardando configuração'}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{configured ? 'Você escolhe a conta e autoriza o acesso na próxima tela. Nenhuma conexão é feita sem sua autorização.' : 'O recurso será liberado assim que a configuração do serviço estiver concluída. Você pode continuar usando o app normalmente.'}</p>
        <button type="button" disabled={!configured || busy} onClick={() => void connect()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Link2 aria-hidden="true" className="h-4 w-4" />{busy ? 'Conectando...' : 'Conectar Google'}</button>
      </>}
    </div>
    <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
      <li>Cada lançamento é representado por uma tarefa e um evento de lembrete que não bloqueia sua disponibilidade: despesas em vermelho e receitas em verde.</li>
      <li>Os lembretes são planejados para um dia antes e para o dia do lançamento, às 9h no fuso escolhido ao conectar. A exibição das notificações depende das permissões do Google e do dispositivo.</li>
      <li>Ao concluir uma tarefa no Google, a situação é atualizada no app na próxima sincronização: ao abrir, voltar à tela ou a cada minuto com o app visível.</li>
    </ul>
    <p className="text-xs leading-5 text-muted-foreground">A conexão é da sua conta Google. Ao sincronizar, o app considera o workspace ativo. Desconectar interrompe novas sincronizações.</p>
  </div>;
};
