import { useState, useEffect, useLayoutEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getPublicAppUrl } from '@/utils/appUrl';
import { getFunctionErrorMessage } from '@/utils/errors';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  email?: string;
  displayName?: string;
}

interface WorkspaceInvitation {
  id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  expiresAt: string;
  createdAt: string;
}

const getAppUrl = () => {
  return getPublicAppUrl();
};

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  loading: boolean;
  userRole: 'owner' | 'editor' | 'viewer' | null;
  canEdit: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  inviteUser: (email: string, role: 'editor' | 'viewer') => Promise<void>;
  removeInvitation: (invitationId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: 'editor' | 'viewer') => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  
  // Use ref to track if we've already loaded to prevent infinite loops
  const hasLoadedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const userEpochRef = useRef(0);
  const workspaceRequestRef = useRef(0);
  const detailsRequestRef = useRef(0);
  const userId = user?.id;

  useLayoutEffect(() => {
    userEpochRef.current += 1;
    currentUserIdRef.current = userId ?? null;
    hasLoadedRef.current = false;
    setCurrentWorkspace(null);
    setWorkspaces([]);
    setMembers([]);
    setInvitations([]);
    setUserRole(null);
    setLoading(authLoading || Boolean(userId));
    return () => { userEpochRef.current += 1; currentUserIdRef.current = null; };
  }, [userId, authLoading]);

  const loadWorkspaceDetails = useCallback(async (workspaceId: string, workspacesList: Workspace[], userId: string) => {
    const epoch = userEpochRef.current;
    const requestId = ++detailsRequestRef.current;
    const isCurrent = () => currentUserIdRef.current === userId && userEpochRef.current === epoch && detailsRequestRef.current === requestId;
    if (!isCurrent()) return;
    try {
      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (!isCurrent()) return;
      if (membersError) {
        console.error('[Workspace] Error loading members:', membersError);
      }

      // Load profiles for members
      const memberIds = membersData?.map(m => m.user_id) || [];
      let profiles: { id: string; email: string | null; display_name: string | null }[] = [];
      
      if (memberIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, display_name')
          .in('id', memberIds);
        if (!isCurrent()) return;
        profiles = profilesData || [];
      }

      const formattedMembers: WorkspaceMember[] = (membersData || []).map(m => {
        const profile = profiles.find(p => p.id === m.user_id);
        return {
          id: m.id,
          userId: m.user_id,
          role: m.role as 'owner' | 'editor' | 'viewer',
          email: profile?.email || undefined,
          displayName: profile?.display_name || undefined,
        };
      });
      setMembers(formattedMembers);

      // Determine user's role - first check if user is workspace owner
      const workspace = workspacesList.find(w => w.id === workspaceId);
      
      if (workspace?.ownerId === userId) {
        setUserRole('owner');
      } else {
        const userMember = formattedMembers.find(m => m.userId === userId);
        setUserRole(userMember?.role || null);
      }

      // Load invitations
      const { data: invitationsData, error: invError } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (!isCurrent()) return;
      if (invError) {
        console.error('[Workspace] Error loading invitations:', invError);
      }

      const formattedInvitations: WorkspaceInvitation[] = (invitationsData || []).map(i => ({
        id: i.id,
        email: i.email,
        role: i.role as 'owner' | 'editor' | 'viewer',
        expiresAt: i.expires_at,
        createdAt: i.created_at,
      }));

      setInvitations(formattedInvitations);
      setLoading(false);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('[Workspace] Failed to load workspace details:', error);
      setLoading(false);
    }
  }, []);

  const loadWorkspaces = useCallback(async (userId: string) => {
    const epoch = userEpochRef.current;
    const requestId = ++workspaceRequestRef.current;
    const isCurrent = () => currentUserIdRef.current === userId && userEpochRef.current === epoch && workspaceRequestRef.current === requestId;
    if (!isCurrent()) return;
    setLoading(true);
    try {
      // Get user's profile with current workspace
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('current_workspace_id')
        .eq('id', userId)
        .maybeSingle();
      
      if (!isCurrent()) return;
      if (profileError) {
        console.error('[Workspace] Error loading profile:', profileError);
      }

      // Get workspaces where user is owner
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId);
      
      if (!isCurrent()) return;
      if (ownedError) {
        console.error('[Workspace] Error loading owned workspaces:', ownedError);
      }

      // Get workspaces where user is member
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .not('accepted_at', 'is', null);
      
      if (!isCurrent()) return;
      if (memberError) {
        console.error('[Workspace] Error loading member workspaces:', memberError);
      }

      const memberWorkspaceIds = memberWorkspaces?.map(m => m.workspace_id) || [];
      
      let allWorkspaces = ownedWorkspaces || [];
      
      if (memberWorkspaceIds.length > 0) {
        const { data: sharedWorkspaces } = await supabase
          .from('workspaces')
          .select('*')
          .in('id', memberWorkspaceIds)
          .neq('owner_id', userId);
        
        if (!isCurrent()) return;
        if (sharedWorkspaces) {
          allWorkspaces = [...allWorkspaces, ...sharedWorkspaces];
        }
      }

      const formattedWorkspaces: Workspace[] = allWorkspaces.map(w => ({
        id: w.id,
        name: w.name,
        ownerId: w.owner_id,
        createdAt: w.created_at,
      }));
      setWorkspaces(formattedWorkspaces);

      // Set current workspace
      let currentWsId = profile?.current_workspace_id;
      if (!currentWsId && formattedWorkspaces.length > 0) {
        currentWsId = formattedWorkspaces[0].id;
        await supabase
          .from('profiles')
          .update({ current_workspace_id: currentWsId })
          .eq('id', userId);
      }

      if (!isCurrent()) return;
      const current = formattedWorkspaces.find(w => w.id === currentWsId) || formattedWorkspaces[0];
      setCurrentWorkspace(current || null);

      if (current) {
        await loadWorkspaceDetails(current.id, formattedWorkspaces, userId);
      } else {
        setLoading(false);
      }
    } catch (error) {
      if (!isCurrent()) return;
      console.error('[Workspace] Failed to load workspaces:', error);
      setLoading(false);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [loadWorkspaceDetails]);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // If no user, set loading to false and return
    if (!user) return;

    // Only load if user changed or we haven't loaded yet
    if (hasLoadedRef.current && currentUserIdRef.current === user.id) {
      return;
    }

    hasLoadedRef.current = true;
    currentUserIdRef.current = user.id;
    loadWorkspaces(user.id);
  }, [user, authLoading, loadWorkspaces]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    if (!user || currentUserIdRef.current !== user.id) return;
    const epoch = userEpochRef.current;
    const requestId = ++workspaceRequestRef.current;
    detailsRequestRef.current += 1;
    const isCurrent = () => currentUserIdRef.current === user.id && userEpochRef.current === epoch && workspaceRequestRef.current === requestId;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({ current_workspace_id: workspaceId })
      .eq('id', user.id);

    if (!isCurrent()) return;
    if (error) {
      setLoading(false);
      throw error;
    }

    const workspace = workspaces.find(w => w.id === workspaceId);
    setCurrentWorkspace(workspace || null);

    setMembers([]);
    setInvitations([]);
    setUserRole(null);
    if (workspace) {
      await loadWorkspaceDetails(workspaceId, workspaces, user.id);
    } else {
      setLoading(false);
    }
  }, [user, workspaces, loadWorkspaceDetails]);

  const createWorkspace = useCallback(async (name: string) => {
    if (!user) return;

    const { data: newWorkspace, error } = await supabase
      .from('workspaces')
      .insert({ name, owner_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Failed to create workspace:', error);
      return;
    }

    // Add owner as member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: newWorkspace.id,
        user_id: user.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      throw memberError;
    }

    hasLoadedRef.current = false;
    await loadWorkspaces(user.id);
  }, [user, loadWorkspaces]);

  const inviteUser = useCallback(async (email: string, role: 'editor' | 'viewer') => {
    if (!user || !currentWorkspace) return;

    const normalizedEmail = email.trim().toLowerCase();

    // Get current user's display name for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    const inviterName = profile?.display_name || user.email?.split('@')[0] || 'Alguém';

    // Check if invitation already exists and delete it first (allows resending)
    const { data: existingInvitation } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingInvitation) {
      const { error: deleteExistingError } = await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', existingInvitation.id);

      if (deleteExistingError) {
        throw deleteExistingError;
      }
    }

    // Insert new invitation
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: currentWorkspace.id,
        email: normalizedEmail,
        role,
        invited_by: user.id,
      })
      .select('token')
      .single();

    if (error) {
      throw error;
    }

    let emailDeliveryError: unknown = null;

    // Send invite email via edge function
    try {
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: normalizedEmail,
          workspaceName: currentWorkspace.name,
          inviterName,
          token: invitation.token,
          role,
          appUrl: getAppUrl(),
        },
      });

      if (emailError) {
        console.error('Failed to send invite email:', emailError);
        emailDeliveryError = new Error(
          await getFunctionErrorMessage(
            emailError,
            'Convite criado, mas o email nao foi enviado. Verifique a Edge Function e o RESEND_API_KEY.',
          ),
        );
      }
    } catch (emailErr) {
      console.error('Email sending error:', emailErr);
      emailDeliveryError = emailErr;
    }

    await loadWorkspaceDetails(currentWorkspace.id, workspaces, user.id);

    if (emailDeliveryError) {
      throw emailDeliveryError;
    }
  }, [user, currentWorkspace, workspaces, loadWorkspaceDetails]);

  const removeInvitation = useCallback(async (invitationId: string) => {
    if (!user || !currentWorkspace) return;
    
    const { error } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      throw error;
    }

    await loadWorkspaceDetails(currentWorkspace.id, workspaces, user.id);
  }, [user, currentWorkspace, workspaces, loadWorkspaceDetails]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!user || !currentWorkspace) return;
    
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      throw error;
    }

    await loadWorkspaceDetails(currentWorkspace.id, workspaces, user.id);
  }, [user, currentWorkspace, workspaces, loadWorkspaceDetails]);

  const updateMemberRole = useCallback(async (memberId: string, role: 'editor' | 'viewer') => {
    if (!user || !currentWorkspace) return;
    
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId);

    if (error) {
      throw error;
    }

    await loadWorkspaceDetails(currentWorkspace.id, workspaces, user.id);
  }, [user, currentWorkspace, workspaces, loadWorkspaceDetails]);

  const refreshWorkspace = useCallback(async () => {
    if (!user) return;
    hasLoadedRef.current = false;
    await loadWorkspaces(user.id);
  }, [user, loadWorkspaces]);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        members,
        invitations,
        loading,
        userRole,
        canEdit,
        switchWorkspace,
        createWorkspace,
        inviteUser,
        removeInvitation,
        removeMember,
        updateMemberRole,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
