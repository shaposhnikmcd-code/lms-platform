'use client';

import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';
export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

const THEME_STORAGE_KEY = 'admin-theme-v1';

/// Читаємо тему синхронно з `data-admin-theme` на <html>, який виставляє
/// інлайн-скрипт у admin/layout.tsx ДО першого React render-у. На сервері
/// (SSR) document відсутній → дефолт 'light'. Hydration-mismatch перекритий
/// mounted-gate-ом всередині AdminShell.
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const ds = document.documentElement.dataset.adminTheme;
  if (ds === 'dark' || ds === 'light') return ds;
  return 'light';
}

export function useAdminTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  /// `mounted` виставляється лише після гідрації — споживачі, які мають свій
  /// loading-state (Manager dashboard рендериться без AdminShell-обгортки доти,
  /// поки тягнуться дані), використовують його як hydration-safe gate, щоб не
  /// малювати dark-bg loading-screen під SSR-render light-у.
  const [mounted, setMounted] = useState(false);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.adminTheme = t;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, t);
      } catch {
        // ignore (quota / private mode)
      }
    }
  };

  /// Sync на випадок, якщо інлайн-скрипт не встиг (наприклад у dev під hot-reload):
  /// після mount тягнемо з localStorage і вирівнюємо стан + dataset.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if ((saved === 'dark' || saved === 'light') && saved !== theme) {
        setThemeState(saved);
        document.documentElement.dataset.adminTheme = saved;
      }
    } catch {
      // ignore
    }
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { theme, setTheme, mounted };
}
