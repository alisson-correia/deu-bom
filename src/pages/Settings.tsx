import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CalendarDays,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Sun,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { BottomNav } from '@/components/BottomNav';
import { PageIntro } from '@/components/PageIntro';
import { ProfileEditModal } from '@/components/ProfileEditModal';
import { SurfaceCard } from '@/components/SurfaceCard';
import { WorkspaceInviteModal } from '@/components/WorkspaceInviteModal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFinanceStore, useSettings } from '@/stores/financeStore';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { GoogleIntegrationPanel } from '@/components/GoogleIntegrationPanel';
import { SpreadsheetImportPanel, downloadCsv, csvDocument } from '@/components/SpreadsheetImportPanel';
import { AccentColorPicker } from '@/components/AccentColorPicker';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { toast } from 'sonner';

const themeOptions = [
  { id: 'light' as const, label: 'Claro', icon: Sun },
  { id: 'dark' as const, label: 'Escuro', icon: Moon },
  { id: 'system' as const, label: 'Sistema', icon: Monitor },
];

const Settings: React.FC = () => {
  const settings = useSettings();
  const {
    exportData,
    importData,
    updateSettings,
    initialize,
    initialized,
    refreshData,
  } = useFinanceStore();
  const { user, signOut } = useAuth();
  const {
    currentWorkspace,
    members,
    userRole,
    inviteUser,
    refreshWorkspace,
  } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditingWorkspaceName, setIsEditingWorkspaceName] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState('');
  const [isSavingWorkspaceName, setIsSavingWorkspaceName] = useState(false);
  const [profileData, setProfileData] = useState({ displayName: '', email: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const canManageWorkspace = userRole === 'owner';
  const canDeleteScopeData = !currentWorkspace || userRole === 'owner';
  const deleteScopeLabel = currentWorkspace ? currentWorkspace.name : 'EXCLUIR';

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialize, initialized]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      toast.error('Este navegador nao suporta notificacoes.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Notificacoes ativadas neste dispositivo.');
    } else {
      toast.error('Permissao de notificacao nao concedida.');
    }
  };

  const loadProfile = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setProfileData({
        displayName: data.display_name || '',
        email: data.email || user.email || '',
      });
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const [activeSection, setActiveSection] = useState<'profile' | 'team' | 'appearance' | 'data' | 'agenda'>(() => new URLSearchParams(window.location.search).has('google') ? 'agenda' : 'profile');
  const accessLabel = userRole === 'owner' ? 'Proprietário' : userRole === 'editor' ? 'Editor' : userRole === 'viewer' ? 'Visualizador' : 'Usuário';
  const sections = [
    { id: 'profile' as const, label: 'Perfil', icon: User },
    { id: 'team' as const, label: 'Equipe', icon: Users },
    { id: 'appearance' as const, label: 'Aparência', icon: Sun },
    { id: 'agenda' as const, label: 'Agenda', icon: CalendarDays },
    { id: 'data' as const, label: 'Dados', icon: FileSpreadsheet },
  ];

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Logout realizado com sucesso.');
    } catch {
      toast.error('Erro ao fazer logout.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `financas-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success('Dados exportados com sucesso.');
  };

  const handleExportCSV = () => {
    const state = useFinanceStore.getState();
    const categories = state.categories;
    const headers = ['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor', 'Status'];
    const rows = state.transactions.map((transaction) => {
      const category = categories.find((item) => item.id === transaction.categoryId);
      return [
        transaction.date,
        transaction.title,
        category?.name || '',
        transaction.type === 'income' ? 'Receita' : 'Despesa',
        transaction.amount.toFixed(2).replace('.', ','),
        transaction.status === 'completed' ? 'Concluido' : 'Pendente',
      ];
    });

    downloadCsv(csvDocument([headers, ...rows]), `financas-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('CSV exportado com sucesso.');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const content = loadEvent.target?.result as string;
      const success = await importData(content);
      if (success) {
        toast.success('Dados importados com sucesso.');
      } else {
        toast.error('Erro ao importar dados. Verifique o formato do arquivo.');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartEditWorkspaceName = () => {
    setWorkspaceNameInput(currentWorkspace?.name || '');
    setIsEditingWorkspaceName(true);
  };

  const handleSaveWorkspaceName = async () => {
    if (!currentWorkspace || !workspaceNameInput.trim()) return;

    setIsSavingWorkspaceName(true);
    try {
      const { error } = await supabase.rpc('update_workspace_name', {
        ws_id: currentWorkspace.id,
        new_name: workspaceNameInput.trim(),
      });

      if (error) throw error;

      toast.success('Nome do workspace atualizado.');
      setIsEditingWorkspaceName(false);
      await refreshWorkspace();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erro ao atualizar o nome do workspace.'));
    } finally {
      setIsSavingWorkspaceName(false);
    }
  };

  const handleQuickInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await inviteUser(inviteEmail.trim(), inviteRole);
      toast.success('Convite enviado com sucesso.');
      setInviteEmail('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erro ao enviar convite.'));
    } finally {
      setIsInviting(false);
    }
  };

  const runDeleteStep = async (
    operation: PromiseLike<{ error: { message?: string } | null }>,
    fallbackMessage: string,
    options?: { ignoreMissingTable?: boolean; tableName?: string }
  ) => {
    const { error } = await operation;
    if (error) {
      const errorMessage = error.message || fallbackMessage;
      const missingTableMessage = options?.tableName
        ? `Could not find the table 'public.${options.tableName}' in the schema cache`
        : null;

      if (options?.ignoreMissingTable && missingTableMessage && errorMessage.includes(missingTableMessage)) {
        console.warn(`Skipping optional delete step for missing table: ${options.tableName}`);
        return;
      }

      throw new Error(errorMessage);
    }
  };

  const handleDeleteAllData = async () => {
    if (!user) return;

    if (!canDeleteScopeData) {
      toast.error('Somente o proprietario pode limpar todos os dados do workspace.');
      return;
    }

    if (deleteConfirmation.trim() !== deleteScopeLabel) {
      toast.error(`Digite ${deleteScopeLabel} para confirmar.`);
      return;
    }

    setIsDeletingData(true);

    try {
      if (currentWorkspace?.id) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id')
          .eq('workspace_id', currentWorkspace.id);

        if (eventsError) throw new Error(eventsError.message || 'Erro ao listar eventos.');

        const eventIds = (eventsData || []).map((event) => event.id);

        if (eventIds.length > 0) {
          await runDeleteStep(
            supabase.from('event_items').delete().in('event_id', eventIds),
            'Erro ao limpar itens de eventos.'
          );
          await runDeleteStep(
            supabase.from('event_participants').delete().in('event_id', eventIds),
            'Erro ao limpar participantes de eventos.'
          );
          await runDeleteStep(
            supabase.from('events').delete().in('id', eventIds),
            'Erro ao limpar eventos.'
          );
        }

        await runDeleteStep(
          supabase.from('purchase_goals').delete().eq('workspace_id', currentWorkspace.id),
          'Erro ao limpar metas.',
          { ignoreMissingTable: true, tableName: 'purchase_goals' }
        );
        await runDeleteStep(
          supabase.from('transactions').delete().eq('workspace_id', currentWorkspace.id),
          'Erro ao limpar transacoes.'
        );
        await runDeleteStep(
          supabase.from('budgets').delete().eq('workspace_id', currentWorkspace.id),
          'Erro ao limpar orcamentos.'
        );
        await runDeleteStep(
          supabase.from('categories').delete().eq('workspace_id', currentWorkspace.id),
          'Erro ao limpar categorias.'
        );
      } else {
        await runDeleteStep(
          supabase
            .from('purchase_goals')
            .delete()
            .eq('user_id', user.id)
            .is('workspace_id', null),
          'Erro ao limpar metas pessoais.',
          { ignoreMissingTable: true, tableName: 'purchase_goals' }
        );
        await runDeleteStep(
          supabase
            .from('transactions')
            .delete()
            .eq('user_id', user.id)
            .is('workspace_id', null),
          'Erro ao limpar transacoes pessoais.'
        );
        await runDeleteStep(
          supabase
            .from('budgets')
            .delete()
            .eq('user_id', user.id)
            .is('workspace_id', null),
          'Erro ao limpar orcamentos pessoais.'
        );
        await runDeleteStep(
          supabase
            .from('categories')
            .delete()
            .eq('user_id', user.id)
            .is('workspace_id', null),
          'Erro ao limpar categorias pessoais.'
        );
      }

      await refreshData();
      await refreshWorkspace();

      toast.success(
        currentWorkspace
          ? 'Todos os dados do workspace foram limpos. As categorias padrao serao recriadas automaticamente.'
          : 'Todos os seus dados pessoais foram limpos.'
      );

      setDeleteConfirmation('');
      setShowDeleteDialog(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nao foi possivel limpar os dados.'));
    } finally {
      setIsDeletingData(false);
    }
  };

  return (
    <AppShell>
      <PageIntro
        eyebrow="Sua conta"
        title="Configurações"
        description="Escolha o que deseja ajustar."
      />

      <nav aria-label="Seções das configurações" className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 sm:grid-cols-5">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-pressed={activeSection === section.id}
            aria-controls="settings-active-section"
            onClick={() => setActiveSection(section.id)}
            className={`inline-flex min-h-12 min-w-0 items-center justify-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors last:col-span-2 sm:justify-center sm:last:col-span-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeSection === section.id ? 'border-primary/30 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <section.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {section.label}
          </button>
        ))}
      </nav>

      <div id="settings-active-section" role="region" aria-labelledby="settings-section-title" className="min-w-0">
        {activeSection === 'profile' && (
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <h2 id="settings-section-title" className="text-lg font-semibold">Perfil e conta</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Atualize seu nome ou encerre a sessão neste dispositivo.
              </p>
            </div>

            <div className="space-y-3 p-5">
              <button
                aria-label="Editar meu perfil"
                onClick={() => setShowProfileModal(true)}
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/60 p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-medium text-foreground">
                      {profileData.displayName || 'Sem nome'}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <Edit2 aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-expense/20 bg-expense/10 p-4 text-sm font-semibold text-expense disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Sair da conta
              </button>
            </div>
          </SurfaceCard>
        )}
        {activeSection === 'team' && (
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <h2 id="settings-section-title" className="text-lg font-semibold">Equipe e acesso</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gerencie o espaço compartilhado e quem pode acessar os dados.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Workspace atual
                    </p>
                    {isEditingWorkspaceName ? (
                      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={workspaceNameInput}
                          onChange={(event) => setWorkspaceNameInput(event.target.value)}
                          aria-label="Nome do workspace"
                          className="min-w-0 flex-1 rounded-xl border border-border bg-input px-3 py-3 text-sm text-foreground"
                          autoFocus
                        />
                        <button
                          aria-label="Salvar nome do workspace"
                          onClick={handleSaveWorkspaceName}
                          disabled={isSavingWorkspaceName}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60"
                        >
                          {isSavingWorkspaceName ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          aria-label="Cancelar edição do workspace"
                          onClick={() => setIsEditingWorkspaceName(false)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 break-words text-lg font-semibold text-foreground">
                          {currentWorkspace?.name || 'Sem workspace ativo'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Seu nivel de acesso: {accessLabel}
                        </p>
                      </>
                    )}
                  </div>

                  {canManageWorkspace && !isEditingWorkspaceName ? (
                    <button
                      aria-label="Editar nome do workspace"
                      onClick={handleStartEditWorkspaceName}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Convite rapido</h4>
                  </div>

                  {canManageWorkspace ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          aria-label="Email da pessoa convidada"
                          placeholder="email@exemplo.com"
                          className="w-full rounded-xl border border-border bg-input py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-background/70 p-1">
                        <button
                          aria-pressed={inviteRole === 'viewer'}
                          onClick={() => setInviteRole('viewer')}
                          className={`min-h-11 rounded-lg py-2 text-sm font-medium transition-all ${
                            inviteRole === 'viewer'
                              ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span className="inline-flex flex-col items-center gap-1 sm:flex-row">
                            <Eye className="h-3 w-3" />
                            Visualizador
                          </span>
                        </button>
                        <button
                          aria-pressed={inviteRole === 'editor'}
                          onClick={() => setInviteRole('editor')}
                          className={`min-h-11 rounded-lg py-2 text-sm font-medium transition-all ${
                            inviteRole === 'editor'
                              ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span className="inline-flex flex-col items-center gap-1 sm:flex-row">
                            <Edit2 className="h-3 w-3" />
                            Editor
                          </span>
                        </button>
                      </div>

                      <button
                        onClick={handleQuickInvite}
                        disabled={!inviteEmail || isInviting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {isInviting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        Enviar convite
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Apenas o proprietario pode convidar novos membros.
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Equipe</h4>
                  </div>
                  <p className="text-2xl font-semibold">{members.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    membro{members.length !== 1 ? 's' : ''} com acesso ao workspace atual
                  </p>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="mt-4 w-full rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                  >
                    Gerenciar equipe
                  </button>
                </div>
              </div>
            </div>
          </SurfaceCard>
        )}
        {activeSection === 'appearance' && (
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <h2 id="settings-section-title" className="text-lg font-semibold">Aparência e alertas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste o tema da interface e o comportamento dos lembretes.
              </p>
            </div>

            <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Tema
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/70 p-1">
                  {themeOptions.map((option) => (
                    <button
                      key={option.id}
                      aria-pressed={theme === option.id}
                      onClick={() => setTheme(option.id)}
                      className={`rounded-xl py-3 text-sm font-medium transition-all ${
                        theme === option.id
                          ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <span className="inline-flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
                <AccentColorPicker />
              </div>

              <div className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Lembretes
                    </p>
                    <p className="mt-2 font-medium text-foreground">Notificacoes de pendencias</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ative ou pause alertas para acompanhar movimentacoes abertas.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-label="Notificações de pendências"
                    aria-checked={settings.notificationsEnabled}
                    onClick={() =>
                      updateSettings({
                        notificationsEnabled: !settings.notificationsEnabled,
                      })
                    }
                    className={`relative h-11 w-14 shrink-0 rounded-full border transition-all ${
                      settings.notificationsEnabled
                        ? 'border-primary/30 bg-primary/80'
                        : 'border-border/70 bg-muted/70'
                    }`}
                  >
                    <div
                      className={`absolute top-[13px] h-4 w-4 rounded-full bg-card shadow-sm transition-all ${
                        settings.notificationsEnabled ? 'left-[30px]' : 'left-[7px]'
                      }`}
                    />
                  </button>
                </div>

                {settings.notificationsEnabled && notificationPermission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={notificationPermission === 'unsupported'}
                  >
                    {notificationPermission === 'unsupported'
                      ? 'Notificacoes indisponiveis neste navegador'
                      : 'Permitir notificacoes neste aparelho'}
                  </button>
                ) : null}
              </div>
            </div>
          </SurfaceCard>
        )}
        {activeSection === 'agenda' && (
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <h2 id="settings-section-title" className="text-lg font-semibold">Agenda e tarefas</h2>
              <p className="mt-1 text-sm text-muted-foreground">Conecte o Google para acompanhar seus lançamentos.</p>
            </div>
            <GoogleIntegrationPanel />
          </SurfaceCard>
        )}
        {activeSection === 'data' && (
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <h2 id="settings-section-title" className="text-lg font-semibold">Seus dados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Exporte, importe e limpe dados com mais previsibilidade.
              </p>
            </div>

            <div className="space-y-3 p-5">
              {user && <SpreadsheetImportPanel userId={user.id} workspaceId={currentWorkspace?.id || null} canImport={!currentWorkspace || userRole === 'owner' || userRole === 'editor'} />}
              {[
                {
                  label: 'Exportar JSON',
                  description: 'Baixa um snapshot completo do seu financeiro.',
                  icon: Download,
                  onClick: handleExport,
                },
                {
                  label: 'Exportar CSV',
                  description: 'Leva os lancamentos para planilha em formato tabular.',
                  icon: Download,
                  onClick: handleExportCSV,
                },
                {
                  label: 'Importar backup JSON',
                  description: 'Traz um arquivo JSON ja estruturado para dentro do app.',
                  icon: Upload,
                  onClick: () => fileInputRef.current?.click(),
                },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-background/60 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <action.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{action.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </button>
              ))}

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />

              <div className="rounded-[24px] border border-expense/20 bg-expense/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/70 text-expense">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-expense">Exclusao em massa</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Remove transacoes, categorias, orcamentos, metas e eventos do escopo atual.
                      {currentWorkspace
                        ? ' No workspace, isso afeta todos os membros.'
                        : ' No modo pessoal, afeta apenas seus dados.'}
                    </p>
                    {!canDeleteScopeData ? (
                      <p className="mt-3 text-sm text-expense">
                        Somente o proprietario pode executar essa limpeza no workspace.
                      </p>
                    ) : (
                      <button
                        onClick={() => setShowDeleteDialog(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-expense/30 bg-background/80 px-4 py-3 text-sm font-semibold text-expense transition-colors hover:bg-background"
                      >
                        <Trash2 className="h-4 w-4" />
                        Limpar todos os dados
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>
        )}
      </div>

      <BottomNav />

      <WorkspaceInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      <ProfileEditModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userId={user?.id}
        initialName={profileData.displayName}
        initialEmail={profileData.email}
        isOwnProfile
        onSaved={async () => {
          await loadProfile();
          await refreshWorkspace();
        }}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir dados em massa</DialogTitle>
            <DialogDescription>
              Essa acao limpa o escopo atual de uma vez.
              {currentWorkspace
                ? ` Para confirmar, digite exatamente ${deleteScopeLabel}.`
                : ' Para confirmar, digite exatamente EXCLUIR.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-expense/20 bg-expense/10 p-4 text-sm text-muted-foreground">
              {currentWorkspace
                ? 'O workspace mantera a estrutura e os membros, mas perdera transacoes, categorias, orcamentos, metas e eventos.'
                : 'Seu perfil sera mantido, mas os dados financeiros pessoais serao apagados.'}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Confirmacao
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={`Digite ${deleteScopeLabel}`}
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setDeleteConfirmation('');
                setShowDeleteDialog(false);
              }}
              className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm font-medium text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteAllData}
              disabled={isDeletingData || deleteConfirmation.trim() !== deleteScopeLabel}
              className="rounded-xl bg-expense px-4 py-3 text-sm font-semibold text-expense-foreground disabled:opacity-50"
            >
              {isDeletingData ? 'Limpando...' : 'Excluir tudo'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Settings;
