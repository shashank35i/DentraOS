// src/contexts/ThemeContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const THEME_KEY = 'theme';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = mode === 'dark' || (mode === 'system' && prefersDark);
  root.classList.toggle('dark', !!shouldBeDark);
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Boot once
  useEffect(() => {
    const cached = (localStorage.getItem(THEME_KEY) as ThemeMode | null) || 'system';
    const initial: ThemeMode =
      cached === 'light' || cached === 'dark' || cached === 'system'
        ? cached
        : 'system';

    setModeState(initial);
    applyTheme(initial);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      const current = (localStorage.getItem(THEME_KEY) as ThemeMode | null) || initial;
      if (current === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_KEY, newMode);
    applyTheme(newMode);
  };

  const cycleMode = () => {
    setModeState((prev) => {
      const next: ThemeMode =
        prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, cycleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
