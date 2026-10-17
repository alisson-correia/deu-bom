import { useTheme } from '@/hooks/useTheme';
import { accentColors, accentPalettes, isAccentColor } from '@/utils/appearance';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AccentColorPicker() {
  const { accentColor, setAccentColor, resolvedTheme } = useTheme();
  return <fieldset className="mt-5">
    <legend className="text-sm font-medium">Cor de destaque</legend>
    <p id="accent-color-description" className="mt-1 text-xs leading-5 text-muted-foreground">Personalize botões e detalhes. Sua escolha fica salva neste navegador.</p>
    <Select value={accentColor} onValueChange={(value) => { if (isAccentColor(value)) setAccentColor(value); }}>
      <SelectTrigger aria-label="Cor de destaque" aria-describedby="accent-color-description" className="mt-3 h-11 rounded-xl bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-xl" collisionPadding={12}>
        {accentColors.map((color) => <SelectItem key={color} value={color} className="min-h-11 rounded-lg">
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-foreground/10" style={{ backgroundColor: color === 'black' ? '#111111' : `hsl(${accentPalettes[color][resolvedTheme]})` }} />
            {accentPalettes[color].label}
          </span>
        </SelectItem>)}
      </SelectContent>
    </Select>
  </fieldset>;
}
