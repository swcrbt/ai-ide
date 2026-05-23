import { useEffect } from 'react';
import { useThemeStore } from '../stores/useThemeStore';

export function useTheme() {
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return resolvedTheme;
}
