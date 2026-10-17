import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useFinanceStore } from '@/stores/financeStore';

export const FinanceScopeProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const ready = Boolean(user) && !authLoading && !workspaceLoading;

  useLayoutEffect(() => {
    useFinanceStore.getState().resetScope(ready);
    return () => { useFinanceStore.getState().resetScope(false); };
  }, [user?.id, currentWorkspace?.id, ready]);

  useEffect(() => {
    if (ready) void useFinanceStore.getState().initialize();
  }, [user?.id, currentWorkspace?.id, ready]);

  return children;
};

export const FinanceScopedRoutes = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  return <Routes key={`${user?.id ?? 'signed-out'}:${currentWorkspace?.id ?? 'personal'}`}>{children}</Routes>;
};
