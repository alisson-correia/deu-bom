import { ArrowRight, BarChart3, Home, KanbanSquare, PartyPopper, PiggyBank, Settings, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { BottomNav } from '@/components/BottomNav';

const sections = [
  { to: '/', label: 'Início', description: 'Saldo e movimentos do mês', icon: Home },
  { to: '/transactions', label: 'Finanças', description: 'Receitas, despesas e pendências', icon: KanbanSquare },
  { to: '/shopping-list', label: 'Lista de compras', description: 'Itens, quantidades e estimativa de gasto', icon: ShoppingCart },
  { to: '/festometro', label: 'Festômetro', description: 'Planeje eventos e acompanhe seus custos', icon: PartyPopper },
  { to: '/budgets', label: 'Metas', description: 'Organize suas próximas compras', icon: PiggyBank },
  { to: '/analytics', label: 'Análise', description: 'Gráficos e comparação de períodos', icon: BarChart3 },
  { to: '/settings', label: 'Configurações', description: 'Perfil, equipe, aparência e preferências', icon: Settings },
];

export default function More() {
  return <AppShell mainClassName="max-w-3xl">
    <header><h1 className="text-2xl font-semibold tracking-tight">Mais opções</h1><p className="mt-2 text-sm text-muted-foreground">Todas as áreas do app, em um só lugar.</p></header>
    <nav aria-label="Todas as áreas" className="overflow-hidden rounded-2xl border border-border bg-card">
      {sections.map((item) => <Link key={item.to} to={item.to} className="flex min-h-[76px] items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><item.icon aria-hidden="true" className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>
        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>)}
    </nav>
    <p className="text-xs leading-5 text-muted-foreground">Toque no botão de ajuda (?) no cabeçalho de cada tela para conhecer suas funções.</p>
    <BottomNav />
  </AppShell>;
}
