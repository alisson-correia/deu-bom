import { Check } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { accentColors, accentPalettes } from '@/utils/appearance';

export function AccentColorPicker() {
  const { accentColor, setAccentColor, resolvedTheme } = useTheme();
  return <fieldset className="mt-5">
    <legend className="text-sm font-medium">Cor de destaque</legend>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Personalize botões e detalhes. Sua escolha fica salva neste navegador.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {accentColors.map((color) => <button
        key={color} type="button" aria-pressed={accentColor === color} onClick={() => setAccentColor(color)}
        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${accentColor === color ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
      >
        <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${accentPalettes[color][resolvedTheme]})` }} />
        {accentPalettes[color].label}
        {accentColor === color && <Check aria-hidden="true" className="ml-auto h-4 w-4 text-primary" />}
      </button>)}
    </div>
  </fieldset>;
}
