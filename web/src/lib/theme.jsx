import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeCtx = createContext(null);

function applyTheme(theme) {
  const root = document.documentElement;
  const enabled = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', !!enabled);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; }
  });
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('ui_density') || 'comfort'; } catch { return 'comfort'; }
  });

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onChange = () => { if ((localStorage.getItem('theme') || 'system') === 'system') applyTheme('system'); };
    if (mql) mql.addEventListener('change', onChange);
    return () => { if (mql) mql.removeEventListener('change', onChange); };
  }, []);

  const api = useMemo(
    () => ({
      theme,
      setTheme: (t) => { try { localStorage.setItem('theme', t); } catch {} setTheme(t); },
      density,
      setDensity: (d) => { try { localStorage.setItem('ui_density', d); } catch {} setDensity(d); },
    }),
    [theme, density]
  );
  return <ThemeCtx.Provider value={api}>{children}</ThemeCtx.Provider>;
}

export function useTheme() { return useContext(ThemeCtx) || { theme: 'system', setTheme: () => {}, density: 'comfort', setDensity: () => {} }; }
