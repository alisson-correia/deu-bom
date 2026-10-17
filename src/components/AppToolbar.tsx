import { Mic, MicOff, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppVoice } from '@/components/VoiceProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppTour } from '@/components/AppTour';

export function AppToolbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { isListening, isSupported, startListening, stopListening, lastTranscript, cancelListening } = useAppVoice();
  return <div className={`app-toolbar sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl ${user ? 'xl:ml-[var(--app-sidebar-width,88px)]' : ''}`}>
    <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-4">
      <Link to={user ? '/' : '/auth'} className="shrink-0 rounded-lg text-sm font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Deu Bom início">DEU BOM</Link>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {user && <button type="button" disabled={!isSupported} aria-label={isListening ? 'Parar microfone' : 'Falar com o app'} aria-pressed={isListening} title={isSupported ? (pathname === '/shopping-list' ? 'Adicionar item por voz' : 'Preparar lançamento por voz') : 'Voz indisponível neste navegador'} onClick={isListening ? stopListening : startListening}
          className={`relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${isListening ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
          {isListening ? <MicOff aria-hidden="true" className="h-5 w-5" /> : <Mic aria-hidden="true" className="h-5 w-5" />}
          {isListening && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-current" />}
        </button>}
        <AppTour onStart={cancelListening} />
        <ThemeToggle />
        {user && <Link to="/more" aria-label="Mais opções e configurações" title="Mais opções e configurações" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"><Settings aria-hidden="true" className="h-5 w-5" /></Link>}
      </div>
    </div>
    {isListening && <div role="status" className="absolute inset-x-0 top-full border-b border-primary/20 bg-card px-4 py-2 text-sm text-primary shadow-sm">{lastTranscript || 'Ouvindo… Toque no microfone para parar.'}</div>}
  </div>;
}
