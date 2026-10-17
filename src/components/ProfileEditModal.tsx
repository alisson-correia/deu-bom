import React, { useState, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { X, User, Mail, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { toast } from 'sonner';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  initialName?: string;
  initialEmail?: string;
  isOwnProfile?: boolean;
  onSaved?: () => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  userId,
  initialName = '',
  initialEmail = '',
  isOwnProfile = true,
  onSaved,
}) => {
  const [displayName, setDisplayName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayName(initialName);
    setEmail(initialEmail);
  }, [initialName, initialEmail, isOpen]);

  const handleSave = async () => {
    if (!userId || isSaving) return;
    
    setIsSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          email: email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      toast.success('Perfil atualizado com sucesso!');
      onSaved?.();
      onClose();
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast.error(getErrorMessage(error, 'Erro ao atualizar perfil'));
    } finally {
      setIsSaving(false);
    }
  };

  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
    <DialogPortal>
      <DialogOverlay className="z-[110]" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[120] max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
        <DialogTitle className="pr-10 text-lg font-semibold">{isOwnProfile ? 'Editar meu perfil' : 'Editar membro'}</DialogTitle>
        <DialogDescription className="mt-2 pr-6 text-sm text-muted-foreground">Confira os dados antes de salvar.</DialogDescription>
        <DialogClose asChild><button type="button" disabled={isSaving} aria-label="Fechar edição de perfil" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><X aria-hidden="true" className="h-5 w-5" /></button></DialogClose>
        <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-sm font-medium">Nome</label>
            <div className="relative">
              <User aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="profile-name" type="text" value={displayName} disabled={isSaving} onChange={(event) => setDisplayName(event.target.value)} placeholder="Seu nome" required className="min-h-11 w-full rounded-xl border border-border bg-input py-3 pl-10 pr-3 text-base text-foreground" />
            </div>
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-medium">Email</label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isOwnProfile || isSaving} placeholder="email@exemplo.com" className="min-h-11 w-full rounded-xl border border-border bg-input py-3 pl-10 pr-3 text-base text-foreground disabled:opacity-60" />
            </div>
            {isOwnProfile && <p className="mt-2 text-xs leading-5 text-muted-foreground">O email da conta não pode ser alterado por este formulário.</p>}
          </div>
          <button type="submit" disabled={isSaving || !displayName.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {isSaving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
            {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>;
};
