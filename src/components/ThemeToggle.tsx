import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label="Alterar tema" className="touch-btn inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-foreground">
        {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Tema
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
        <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" />Claro</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" />Escuro</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system"><Monitor className="mr-2 h-4 w-4" />Sistema</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
