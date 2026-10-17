import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}

export const AppShell = ({ children, className, mainClassName }: AppShellProps) => {
  return (
    <div
      className={cn(
        'min-h-screen min-h-[100dvh] bg-background pb-[calc(var(--app-bottom-nav-height,0px)+1.5rem+env(safe-area-inset-bottom,0px))] xl:pl-[var(--app-sidebar-width,88px)]',
        className
      )}
    >
      <main
        className={cn(
          'app-content flex min-w-0 flex-col gap-5 py-5 sm:gap-6 sm:py-6',
          mainClassName
        )}
      >
        {children}
      </main>
    </div>
  );
};
