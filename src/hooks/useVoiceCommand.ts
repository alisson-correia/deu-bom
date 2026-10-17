import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './useTheme';
import { parseVoiceTheme } from '@/services/voiceCommandParser';
import { toast } from 'sonner';

type SpeechRecognitionEventResult = {
  transcript: string;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionEventResult> & {
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface VoiceCommandOptions {
  onTranscript: (transcript: string) => void;
}

export const useVoiceCommand = ({ onTranscript }: VoiceCommandOptions) => {
  const { setTheme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dispatchedRef = useRef(false);

  const Recognition = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
  }, []);

  const isSupported = Boolean(Recognition);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) return;
    if (!Recognition) {
      toast.error('Reconhecimento de voz nao esta disponivel neste navegador.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    setLastTranscript('');
    dispatchedRef.current = false;
    recognition.onstart = () => undefined;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() || '';
        if (!transcript) continue;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const transcript = (finalTranscript || interimTranscript).trim();
      if (transcript) {
        setLastTranscript(transcript);
      }

      if (finalTranscript.trim()) {
        if (dispatchedRef.current) return;
        dispatchedRef.current = true;
        const voiceTheme = parseVoiceTheme(finalTranscript);
        if (voiceTheme) { setTheme(voiceTheme); toast.success('Tema atualizado por voz.'); }
        else onTranscript(finalTranscript.trim());
      } else if (!transcript) {
        toast.error('Nao consegui entender o comando.');
      }
    };

    recognition.onerror = (event) => {
      const messageByError: Record<string, string> = {
        'audio-capture': 'Nao encontrei um microfone ativo neste aparelho.',
        'not-allowed': 'Permissao do microfone bloqueada. Libere o microfone no navegador.',
        'no-speech': 'Nao detectei fala. Tente tocar no microfone e falar mais perto.',
        network: 'O reconhecimento de voz precisa de conexao com a internet neste navegador.',
        aborted: 'Escuta cancelada.',
      };

      const message =
        messageByError[event.error] || 'Nao consegui ouvir agora. Tente novamente.';

      if (event.error !== 'aborted') {
        toast.error(message);
      }
      setIsListening(false);
    };

    recognition.onend = () => {

      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    try { recognition.start(); }
    catch { recognitionRef.current = null; setIsListening(false); toast.error('Microfone indisponível. Tente novamente ou preencha manualmente.'); }
  }, [Recognition, onTranscript, setTheme]);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null; recognition.onend = null; recognition.onerror = null;
    if (recognition.abort) recognition.abort(); else recognition.stop();
    recognitionRef.current = null;
  }, []);

  return {
    isListening,
    isSupported,
    lastTranscript,
    startListening,
    stopListening,
  };
};
