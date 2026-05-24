import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';
import { config } from '../../wailsjs/go/models';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isLoaded: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => Promise<void>;
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyThemeToDOM(theme: ResolvedTheme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

async function saveThemeToBackend(theme: ThemeMode) {
  try {
    const settings = await GetSettings();
    settings.theme = theme;
    await SaveSettings(settings);
  } catch (err) {
    console.error('保存主题配置失败:', err);
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: 'light',
      isLoaded: false,

      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        set({ theme, resolvedTheme: resolved });
        applyThemeToDOM(resolved);
        saveThemeToBackend(theme);
      },

      toggleTheme: () => {
        const { resolvedTheme } = get();
        const nextTheme: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
        const resolved = resolveTheme(nextTheme);
        set({ theme: nextTheme, resolvedTheme: resolved });
        applyThemeToDOM(resolved);
        saveThemeToBackend(nextTheme);
      },

      initTheme: async () => {
        try {
          const settings = await GetSettings();
          const loadedTheme: ThemeMode = (settings.theme as ThemeMode) || 'system';
          const resolved = resolveTheme(loadedTheme);
          set({ theme: loadedTheme, resolvedTheme: resolved, isLoaded: true });
          applyThemeToDOM(resolved);
        } catch (err) {
          console.error('从后端加载主题失败:', err);
          const { theme } = get();
          const resolved = resolveTheme(theme);
          set({ resolvedTheme: resolved, isLoaded: true });
          applyThemeToDOM(resolved);
        }
      },
    }),
    {
      name: 'ai-ide-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') {
      const resolved = getSystemTheme();
      useThemeStore.setState({ resolvedTheme: resolved });
      applyThemeToDOM(resolved);
    }
  });
}
