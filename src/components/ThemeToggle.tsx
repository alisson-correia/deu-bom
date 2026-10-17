import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { accentColors, accentPalettes, isAccentColor } from '@/utils/appearance';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme, accentColor, setAccentColor } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label="Alterar tema" title="Aparência: modo e cor" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {resolvedTheme === 'dark' ? <Moon aria-hidden="true" className="h-5 w-5" /> : <Sun aria-hidden="true" className="h-5 w-5" />}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-60 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl p-2">
      <DropdownMenuLabel>Modo de exibição</DropdownMenuLabel>
      <DropdownMenuRadioGroup aria-label="Modo de exibição" value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
        <DropdownMenuRadioItem className="min-h-11" value="light"><Sun className="mr-2 h-4 w-4" />Claro</DropdownMenuRadioItem>
        <DropdownMenuRadioItem className="min-h-11" value="dark"><Moon className="mr-2 h-4 w-4" />Escuro</DropdownMenuRadioItem>
        <DropdownMenuRadioItem className="min-h-11" value="system"><Monitor className="mr-2 h-4 w-4" />Sistema</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Cor de destaque</DropdownMenuLabel>
      <DropdownMenuRadioGroup aria-label="Cor de destaque" className="max-h-56 overflow-y-auto overscroll-contain" value={accentColor} onValueChange={(value) => { if (isAccentColor(value)) setAccentColor(value); }}>
        {accentColors.map((color) => <DropdownMenuRadioItem key={color} value={color} className="min-h-11 gap-2 rounded-lg">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${accentPalettes[color][resolvedTheme]})` }} />
          {accentPalettes[color].label}
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
