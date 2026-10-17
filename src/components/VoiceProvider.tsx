import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { parseVoiceCommand, type ParsedVoiceCommand } from '@/services/voiceCommandParser';
import { useFinanceStore } from '@/stores/financeStore';
import { TransactionForm } from '@/components/TransactionForm';

type TranscriptHandler = (text: string) => void;
type VoiceControls = ReturnType<typeof useVoiceCommand>;
const VoiceContext = createContext<(VoiceControls & { register: (handler: TranscriptHandler) => () => void }) | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const target = useRef<TranscriptHandler | null>(null);
  const [draft, setDraft] = useState<Extract<ParsedVoiceCommand, { kind: 'transaction' }> | null>(null);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const controls = useVoiceCommand({ onTranscript: (text) => {
    if (target.current) { target.current(text); return; }
    const command = parseVoiceCommand(text, { preferredKind: 'transaction' });
    if (!command || command.kind !== 'transaction') { toast.error('Diga, por exemplo, “despesa mercado 35,90 reais”.'); return; }
    const store = useFinanceStore.getState();
    if (!store.initialized) void store.initialize();
    setDraft(command);
  } });
  const register = useCallback((handler: TranscriptHandler) => {
    target.current = handler;
    return () => { if (target.current === handler) target.current = null; };
  }, []);
  const { cancelListening } = controls;
  useEffect(() => { cancelListening(); setDraft(null); }, [pathname, cancelListening, user?.id, currentWorkspace?.id]);
  return <VoiceContext.Provider value={{ ...controls, register }}>
    {children}
    <TransactionForm isOpen={!!draft} onClose={() => setDraft(null)} defaultType={draft?.type || 'expense'} initialDraft={draft} />
  </VoiceContext.Provider>;
}

export function useAppVoice() {
  const value = useContext(VoiceContext);
  if (!value) throw new Error('VoiceProvider is required');
  return value;
}

export function usePageVoice({ onTranscript }: { onTranscript: TranscriptHandler }) {
  const controls = useAppVoice();
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const { register } = controls;
  useEffect(() => register((text) => callback.current(text)), [register]);
  return controls;
}
