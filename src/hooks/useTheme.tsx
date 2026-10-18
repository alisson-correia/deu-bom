import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { accentPalettes, isAccentColor, type AccentColor } from '@/utils/appearance';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('app-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch { return 'system'; }
  });

  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    try {
      const stored = localStorage.getItem('app-accent');
      return isAccentColor(stored) ? stored : 'purple';
    } catch { return 'purple'; }
  });
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    root.dataset.accent = accentColor;
    const primary = accentPalettes[accentColor][resolvedTheme];
    const foreground = resolvedTheme === 'dark' ? (accentColor === 'black' ? '0 0% 0%' : '250 30% 12%') : '0 0% 100%';
    for (const token of ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring']) {
      root.style.setProperty(token, primary);
    }
    for (const token of ['--primary-foreground', '--sidebar-primary-foreground']) {
      root.style.setProperty(token, foreground);
    }
    const [hue, saturationText, lightnessText] = primary.split(' ');
    const saturation = Number(saturationText.replace('%',''));
    const lightness = Number(lightnessText.replace('%',''));
    const dark = resolvedTheme === 'dark';
    const surfaces: Record<string,string> = {
      '--background': `${hue} ${Math.min(10,saturation)}% ${dark ? 8 : 98}%`,
      '--card': `${hue} ${Math.min(12,saturation)}% ${dark ? 12 : 100}%`,
      '--popover': `${hue} ${Math.min(12,saturation)}% ${dark ? 12 : 100}%`,
      '--muted': `${hue} ${Math.min(12,saturation)}% ${dark ? 18 : 95}%`,
      '--secondary': `${hue} ${Math.min(12,saturation)}% ${dark ? 20 : 94}%`,
      '--input': `${hue} ${Math.min(12,saturation)}% ${dark ? 18 : 94}%`,
      '--border': `${hue} ${Math.min(16,saturation)}% ${dark ? 26 : 84}%`,
      '--sidebar-background': `${hue} ${Math.min(10,saturation)}% ${dark ? 8 : 98}%`,
      '--sidebar-accent': `${hue} ${Math.min(12,saturation)}% ${dark ? 18 : 94}%`,
      '--sidebar-border': `${hue} ${Math.min(16,saturation)}% ${dark ? 26 : 84}%`,
    };
    for (const [token,value] of Object.entries(surfaces)) {
      if (accentColor === 'black') root.style.removeProperty(token);
      else root.style.setProperty(token,value);
    }
    root.style.setProperty('--gradient-card','linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))');
    root.style.setProperty('--gradient-glass','linear-gradient(135deg,hsl(var(--primary) / 0.07),transparent)');
    const financial = {income: dark ? '145 65% 65%' : '145 70% 28%', expense: dark ? '355 82% 72%' : '355 72% 43%', pending: dark ? '38 85% 66%' : '38 85% 30%'};
    for (const [role,color] of Object.entries(financial)) {root.style.setProperty(`--${role}`,color);root.style.setProperty(`--${role}-foreground`,dark?'0 0% 7%':'0 0% 100%');}
    root.style.setProperty('--success',financial.income);root.style.setProperty('--warning',financial.pending);
    root.style.setProperty('--success-foreground',dark?'0 0% 7%':'0 0% 100%');root.style.setProperty('--warning-foreground',dark?'0 0% 7%':'0 0% 100%');
    root.style.setProperty('--chart-secondary', `${hue} ${saturation}% ${dark ? Math.max(40, lightness - 14) : Math.max(18, lightness - 12)}%`);
    root.style.setProperty('--accent', `${hue} ${Math.min(35,saturation)}% ${dark ? 22 : 93}%`);
    root.style.setProperty('--accent-foreground', `${hue} ${Math.min(12,saturation)}% ${dark ? 96 : 12}%`);
    root.style.setProperty('--foreground', `${hue} ${Math.min(12,saturation)}% ${dark ? 95 : 12}%`);
    root.style.setProperty('--muted-foreground', `${hue} ${Math.min(14,saturation)}% ${dark ? 74 : 38}%`);
    root.style.setProperty('--secondary-foreground', `${hue} ${Math.min(14,saturation)}% ${dark ? 88 : 23}%`);
    root.style.setProperty('--sidebar-foreground', `${hue} ${Math.min(14,saturation)}% ${dark ? 88 : 23}%`);
    for (const name of ['income','expense']) {
      root.style.setProperty(`--gradient-${name}`, `linear-gradient(135deg, hsl(var(--${name})), hsl(var(--${name}) / 0.75))`);
      root.style.setProperty(`--shadow-glow-${name}`, `0 0 20px hsl(var(--${name}) / 0.2)`);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `hsl(${getComputedStyle(root).getPropertyValue('--background').trim()})`);
  }, [resolvedTheme, accentColor]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      setSystemTheme(getSystemTheme());
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try { localStorage.setItem('app-theme', newTheme); } catch { /* Keep the session preference when storage is unavailable. */ }
  };

  const setAccentColor = (color: AccentColor) => {
    if (!isAccentColor(color)) return;
    setAccentColorState(color);
    try { localStorage.setItem('app-accent', color); } catch { /* Keep session preference. */ }
  };

  useEffect(() => {
    const syncPreferences = (event: StorageEvent) => {
      if (event.key === 'app-accent' || event.key === null) {
        setAccentColorState(isAccentColor(event.newValue) ? event.newValue : 'purple');
      }
      if (event.key === 'app-theme' || event.key === null) {
        setThemeState(event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system');
      }
    };
    window.addEventListener('storage', syncPreferences);
    return () => window.removeEventListener('storage', syncPreferences);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
