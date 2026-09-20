import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Migrate legacy "system" (or anything else) to dark default.
  return 'dark';
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = preference;
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreference(theme);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { preference, resolved: preference, setTheme, toggleTheme };
}
