import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './useTheme';
import { parseVoiceTheme } from '@/services/voiceCommandParser';
import { toast } from 'sonner';

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  start: () => void; stop: () => void; abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
export const VOICE_SILENCE_MS = 6000;

export const useVoiceCommand = ({ onTranscript }: { onTranscript: (text: string) => void }) => {
  const { setTheme } = useTheme();
  const callbackRef = useRef(onTranscript); callbackRef.current = onTranscript;
  const themeRef = useRef(setTheme); themeRef.current = setTheme;
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const finishingRef = useRef(false);
  const completedRef = useRef<string[]>([]);
  const currentRef = useRef(new Map<number, string>());
  const silenceRef = useRef<ReturnType<typeof setTimeout>>();
  const restartRef = useRef<ReturnType<typeof setTimeout>>();
  const finishRef = useRef<ReturnType<typeof setTimeout>>();

  const Recognition = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const speech = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    return speech.SpeechRecognition || speech.webkitSpeechRecognition || null;
  }, []);

  const clearTimers = useCallback(() => {
    clearTimeout(silenceRef.current); clearTimeout(restartRef.current); clearTimeout(finishRef.current);
  }, []);
  const detach = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null; recognition.onend = null; recognition.onerror = null;
    if (recognition.abort) recognition.abort(); else recognition.stop();
  }, []);
  const cancelListening = useCallback(() => {
    activeRef.current = false; finishingRef.current = false; clearTimers(); detach();
    completedRef.current = []; currentRef.current.clear();
    setIsListening(false); setLastTranscript('');
  }, [clearTimers, detach]);
  const finalize = useCallback(() => {
    if (!activeRef.current) return;
    const text = [...completedRef.current, ...currentRef.current.values()].join(' ').replace(/\s+/g, ' ').trim();
    activeRef.current = false; finishingRef.current = false; clearTimers(); detach(); setIsListening(false);
    if (!text) { toast.error('Não consegui confirmar a fala. Tente novamente ou preencha manualmente.'); return; }
    setLastTranscript(text);
    const theme = parseVoiceTheme(text);
    if (theme) { themeRef.current(theme); toast.success('Tema atualizado por voz.'); }
    else callbackRef.current(text);
  }, [clearTimers, detach]);
  const stopListening = useCallback(() => {
    if (!activeRef.current || finishingRef.current) return;
    finishingRef.current = true;
    clearTimeout(silenceRef.current); clearTimeout(restartRef.current);
    // stop() can deliver one final result before onend; do not discard the last words.
    finishRef.current = setTimeout(finalize, 1000);
    if (recognitionRef.current) recognitionRef.current.stop(); else finalize();
  }, [finalize]);

  const startListening = useCallback(() => {
    if (activeRef.current) return;
    if (!Recognition) { toast.error('Reconhecimento de voz não está disponível neste navegador.'); return; }
    completedRef.current = []; currentRef.current.clear(); finishingRef.current = false;
    activeRef.current = true; setLastTranscript(''); setIsListening(true);
    // Give permission prompts / the first words more time than a normal pause.
    silenceRef.current = setTimeout(stopListening, 30000);
    const startSegment = () => {
      if (!activeRef.current || finishingRef.current) return;
      const recognition = new Recognition();
      recognition.lang = 'pt-BR'; recognition.interimResults = true; recognition.maxAlternatives = 1; recognition.continuous = true;
      currentRef.current.clear(); recognitionRef.current = recognition;
      recognition.onstart = () => undefined;
      recognition.onresult = (event) => {
        if (!activeRef.current) return;
        const interim: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index], text = result?.[0]?.transcript?.trim();
          if (!text) continue;
          if (result.isFinal) currentRef.current.set(index, text); else interim.push(text);
        }
        setLastTranscript([...completedRef.current, ...currentRef.current.values(), ...interim].join(' '));
        if (!finishingRef.current) {
          clearTimeout(silenceRef.current);
          silenceRef.current = setTimeout(stopListening, VOICE_SILENCE_MS);
        }
      };
      recognition.onerror = (event) => {
        if (!activeRef.current) return;
        if (event.error === 'no-speech' && (completedRef.current.length || currentRef.current.size)) return;
        const messages: Record<string, string> = {
          'audio-capture': 'Nao encontrei um microfone ativo neste aparelho.',
          'not-allowed': 'Permissao do microfone bloqueada. Libere o microfone no navegador.',
          'no-speech': 'Nao detectei fala. Tente tocar no microfone e falar mais perto.',
          network: 'O reconhecimento de voz precisa de conexao com a internet neste navegador.',
        };
        cancelListening();
        if (event.error !== 'aborted') toast.error(messages[event.error] || 'Não consegui ouvir agora. Tente novamente.');
      };
      recognition.onend = () => {
        if (!activeRef.current) return;
        recognitionRef.current = null;
        completedRef.current.push(...currentRef.current.values()); currentRef.current.clear();
        if (finishingRef.current) { finalize(); return; }
        // Some browsers end recognition between phrases even with continuous=true.
        // Keep the draft and the remaining pause timer while reopening the microphone.
        restartRef.current = setTimeout(startSegment, 200);
      };
      try { recognition.start(); }
      catch { cancelListening(); toast.error('Microfone indisponível. Tente novamente ou preencha manualmente.'); }
    };
    startSegment();
  }, [Recognition, stopListening, finalize, cancelListening]);

  useEffect(() => () => { activeRef.current = false; clearTimers(); detach(); }, [clearTimers, detach]);
  return { isListening, isSupported: Boolean(Recognition), lastTranscript, startListening, stopListening, cancelListening };
};
