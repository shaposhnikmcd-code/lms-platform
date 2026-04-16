'use client';

import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';
export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

const THEME_STORAGE_KEY = 'admin-theme-v1';

export function useAdminTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (saved === 'light' || saved === 'dark') setTheme(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, mounted]);

  return { theme, setTheme, mounted };
}
