import React from 'react';
import { BottomNav } from './BottomNav';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background pb-[calc(var(--app-bottom-nav-height,0px)+1.5rem+env(safe-area-inset-bottom,0px))] xl:pl-[var(--app-sidebar-width,88px)]">
      <main className="pb-8 pt-[env(safe-area-inset-top,0px)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};
