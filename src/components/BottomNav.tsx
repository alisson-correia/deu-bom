import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  KanbanSquare,
  PartyPopper,
  PiggyBank,
  Settings,
  Grid2X2,
  ShoppingCart,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/transactions', icon: KanbanSquare, label: 'Finanças' },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Lista' },
  { to: '/festometro', icon: PartyPopper, label: 'Festômetro' },
  { to: '/budgets', icon: PiggyBank, label: 'Metas' },
  { to: '/analytics', icon: BarChart3, label: 'Análise' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

const mobileNavItems = [
  ...navItems.filter((item) => ['/', '/transactions', '/shopping-list', '/festometro'].includes(item.to)),
  { to: '/more', icon: Grid2X2, label: 'Mais' },
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isPinned, setIsPinned] = React.useState(false);
  const isExpanded = !isMobile && isPinned;

  React.useLayoutEffect(() => {
    document.documentElement.style.setProperty('--app-sidebar-width', isExpanded ? '272px' : '88px');
    return () => { document.documentElement.style.removeProperty('--app-sidebar-width'); };
  }, [isExpanded]);


  return (
    <>
      {isMobile ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-[70] border-t border-border/70 bg-card/95 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl xl:hidden"
          aria-label="Navegação principal"
        >
          <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1">
            {mobileNavItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to === '/more' && ['/budgets', '/analytics', '/settings'].includes(location.pathname));

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={cn(
                    'flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <item.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate leading-none">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[60] hidden flex-col overflow-hidden border-r border-border/70 bg-card/96 pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl transition-[width,box-shadow] duration-200 xl:flex',
          isExpanded ? 'w-[272px] shadow-[var(--shadow-lg)]' : 'w-[88px] shadow-[var(--shadow-md)]'
        )}
      >
        <div className={cn("flex border-b border-border/60 py-3", isExpanded ? "items-center justify-between px-4" : "flex-col items-center gap-2 px-3")}>
          <div
            className={cn(
              'flex items-center gap-3 overflow-hidden transition-all',
              !isExpanded && 'justify-center'
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
              DB
            </div>
            <div className={cn('min-w-0', !isExpanded && 'hidden')}>
              <p className="text-sm font-semibold text-foreground">Deu Bom</p>
              <p className="text-xs text-muted-foreground">Financas sem erro</p>
            </div>
          </div>

          <button
            onClick={() => setIsPinned((current) => !current)}
            aria-expanded={isExpanded}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            aria-label={isPinned ? 'Desafixar sidebar' : 'Fixar sidebar aberta'}
          >
            {isExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav aria-label="Navegação principal desktop" className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  'relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  !isExpanded && 'justify-center px-0'
                )}
                title={!isExpanded ? item.label : undefined}
              >
                {isActive ? (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-2xl bg-primary/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                ) : null}

                <item.icon aria-hidden="true" className="relative z-10 h-5 w-5 shrink-0" />
                <span
                  className={cn(
                    'relative z-10 truncate font-medium',
                    !isExpanded && 'hidden'
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

      </aside>
    </>
  );
};
