import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthSwitcherProps {
  selectedMonth: Date;
  onChange: (direction: number) => void;
  className?: string;
}

export const MonthSwitcher = ({
  selectedMonth,
  onChange,
  className = '',
}: MonthSwitcherProps) => {
  return (
    <div className={`flex items-center justify-between ${className}`.trim()}>
      <button
        onClick={() => onChange(-1)}
        aria-label="Mês anterior"
        className="touch-btn h-11 w-11 rounded-full border border-border/60 bg-card/70 text-foreground"
      >
        <ChevronDown className="h-5 w-5 rotate-90" />
      </button>
      <span className="text-sm font-semibold capitalize tracking-[0.08em] text-muted-foreground">
        {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
      </span>
      <button
        onClick={() => onChange(1)}
        aria-label="Próximo mês"
        className="touch-btn h-11 w-11 rounded-full border border-border/60 bg-card/70 text-foreground"
      >
        <ChevronDown className="h-5 w-5 -rotate-90" />
      </button>
    </div>
  );
};
