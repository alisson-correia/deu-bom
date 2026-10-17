import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, UserPlus, Trash2, Users, Eye, Edit, Edit2, User } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/utils/errors';
import { toast } from 'sonner';
import { ProfileEditModal } from './ProfileEditModal';

interface WorkspaceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkspaceInviteModal: React.FC<WorkspaceInviteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentWorkspace,
    members,
    invitations,
    userRole,
    inviteUser,
    removeInvitation,
    removeMember,
    updateMemberRole,
    refreshWorkspace,
  } = useWorkspace();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<{
    id: string;
    userId: string;
    displayName: string;
    email: string;
  } | null>(null);

  const handleInvite = async () => {
    if (!email) return;

    setLoading(true);
    try {
      await inviteUser(email, role);
      toast.success('Convite enviado!');
      setEmail('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Erro ao enviar convite'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveInvitation = async (invitationId: string) => {
    await removeInvitation(invitationId);
    toast.success('Convite removido');
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Tem certeza que deseja remover ${memberName} do espaço?`)) return;
    
    await removeMember(memberId);
    toast.success('Membro removido');
  };

  const handleUpdateRole = async (memberId: string, newRole: 'editor' | 'viewer') => {
    await updateMemberRole(memberId, newRole);
    toast.success('Permissão atualizada');
  };

  const canManageMembers = userRole === 'owner';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="safe-area-bottom absolute bottom-0 left-0 right-0 flex max-h-[80vh] flex-col overflow-hidden rounded-t-3xl bg-card sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[82vh] sm:w-[min(42rem,calc(100vw-1.5rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Gerenciar Equipe</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-5 p-4 sm:p-5">
            {/* Invite Form */}
            {canManageMembers && (
              <section>
                <h3 className="font-medium mb-3">Convidar Usuário</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                    <button
                      onClick={() => setRole('viewer')}
                      className={`py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        role === 'viewer'
                          ? 'bg-card shadow-md text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Visualizador
                    </button>
                    <button
                      onClick={() => setRole('editor')}
                      className={`py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        role === 'editor'
                          ? 'bg-card shadow-md text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Edit className="w-4 h-4" />
                      Editor
                    </button>
                  </div>

                  <button
                    onClick={handleInvite}
                    disabled={!email || loading}
                    className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserPlus className="w-5 h-5" />
                    Enviar Convite
                  </button>
                </div>
              </section>
            )}

            {/* Members List */}
            <section>
              <h3 className="font-medium mb-3">Membros ({members.length})</h3>
              {members.length === 0 ? (
                <div className="bg-muted rounded-xl p-4 text-center">
                  <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum membro encontrado
                  </p>
                </div>
              ) : (
                <div className="bg-muted rounded-xl overflow-hidden divide-y divide-border">
                  {members.map((member) => {
                    const isCurrentUser = member.userId === user?.id;
                    const isOwner = member.role === 'owner';
                    
                    return (
                      <div key={member.id} className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isOwner ? 'bg-primary/20' : 'bg-muted-foreground/10'
                            }`}>
                              <User className={`w-5 h-5 ${isOwner ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {member.displayName || member.email || 'Usuário'}
                                {isCurrentUser && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    Você
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {isOwner
                                  ? 'Proprietário'
                                  : member.role === 'editor'
                                  ? 'Editor'
                                  : 'Visualizador'}
                                {member.email && !isOwner && ` • ${member.email}`}
                              </p>
                            </div>
                          </div>
                          
                          {canManageMembers && !isOwner && (
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              {/* Edit button */}
                              <button
                                onClick={() => setEditingMember({
                                  id: member.id,
                                  userId: member.userId,
                                  displayName: member.displayName || '',
                                  email: member.email || '',
                                })}
                                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                              >
                                <Edit2 className="w-4 h-4 text-primary" />
                              </button>
                              
                              {/* Role selector */}
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleUpdateRole(member.id, e.target.value as 'editor' | 'viewer')
                                }
                                className="px-2 py-1.5 rounded-lg bg-card border border-border text-xs sm:text-sm min-w-0 max-w-[90px] sm:max-w-none"
                              >
                                <option value="viewer">Visualizador</option>
                                <option value="editor">Editor</option>
                              </select>
                              
                              {/* Remove button */}
                              <button
                                onClick={() => handleRemoveMember(member.id, member.displayName || member.email || 'este membro')}
                                className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <section>
                <h3 className="font-medium mb-3">Convites Pendentes ({invitations.length})</h3>
                <div className="bg-warning/10 border border-warning/20 rounded-xl overflow-hidden divide-y divide-warning/20">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {invitation.role === 'editor' ? 'Editor' : 'Visualizador'}
                        </p>
                      </div>
                      {canManageMembers && (
                        <button
                          onClick={() => handleRemoveInvitation(invitation.id)}
                          className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Permissions Info */}
            <section className="bg-muted rounded-xl p-4">
              <h4 className="font-medium mb-2">Níveis de Acesso</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Proprietário:</span> Controle
                  total, pode gerenciar membros e convites
                </p>
                <p>
                  <span className="font-medium text-foreground">Editor:</span> Pode visualizar
                  e editar transações, orçamentos e eventos
                </p>
                <p>
                  <span className="font-medium text-foreground">Visualizador:</span> Apenas
                  visualização, sem permissão para editar
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>

      {/* Edit Member Profile Modal */}
      {editingMember && (
        <ProfileEditModal
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          userId={editingMember.userId}
          initialName={editingMember.displayName}
          initialEmail={editingMember.email}
          isOwnProfile={false}
          onSaved={() => {
            refreshWorkspace();
            setEditingMember(null);
          }}
        />
      )}
    </AnimatePresence>
  );
};
