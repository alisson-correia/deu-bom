import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, CircleHelp, Compass, X } from 'lucide-react';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { appTours, fallbackAppTour } from '@/data/appTours';

interface AppTourProps {
  onStart?: () => void;
}

export const AppTour = ({ onStart }: AppTourProps) => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tour = appTours[pathname] ?? fallbackAppTour;
  const step = tour.steps[stepIndex] ?? tour.steps[0];
  const lastStep = stepIndex === tour.steps.length - 1;

  useEffect(() => {
    setOpen(false);
    setStepIndex(0);
  }, [pathname]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open, stepIndex]);

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      onStart?.();
      setStepIndex(0);
    }
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Como usar esta tela" title="Como usar esta tela" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <CircleHelp aria-hidden="true" className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="z-[130]" />
        <DialogPrimitive.Content onOpenAutoFocus={(event) => {
          event.preventDefault();
          headingRef.current?.focus();
        }} onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault();
            setOpen(false);
          }
        }} className="fixed left-1/2 top-1/2 z-[140] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl sm:p-6">
          <div className="pr-10">
            <DialogTitle className="text-lg font-semibold">{tour.title}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">Um guia rápido, sem alterar seus dados.</DialogDescription>
          </div>
          <DialogClose asChild>
            <button type="button" aria-label="Fechar tutorial" className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </DialogClose>
          <div role="status" aria-live="polite" aria-atomic="true" className="text-xs font-medium text-muted-foreground">Passo {stepIndex + 1} de {tour.steps.length}</div>
          <div aria-hidden="true" className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-4 text-center text-primary">
            <Compass className="h-7 w-7" />
            <span className="text-sm font-medium">{step.cue}</span>
          </div>
          <div className="min-w-0">
            <h2 ref={headingRef} tabIndex={-1} className="rounded text-lg font-semibold outline-none">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            {tour.steps.map((item, index) => <span key={item.title} className={`h-1 flex-1 rounded-full ${index <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />Voltar
            </button>
            <button type="button" onClick={() => lastStep ? setOpen(false) : setStepIndex((current) => Math.min(tour.steps.length - 1, current + 1))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
              {lastStep ? 'Concluir' : 'Próximo'}{!lastStep && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};
