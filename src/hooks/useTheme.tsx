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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accentColor === 'black' ? (resolvedTheme === 'dark' ? '#000000' : '#ffffff') : (resolvedTheme === 'dark' ? '#15131b' : '#fafafa'));
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
