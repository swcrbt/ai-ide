import { create } from 'zustand';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';
import { config } from '../../wailsjs/go/models';
import type { AppSettings } from '../types';

// 默认配置（使用 config.Settings.createFrom 创建完整实例）
const defaultSettings = config.Settings.createFrom({
  theme: 'system',
  language: 'zh',
  autoSave: false,
  editor: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
    tabSize: 2,
    wordWrap: true,
    showLineNumbers: true,
    enableMinimap: false,
    formatOnSave: true,
    lineHeight: 22,
    cursorStyle: 'line',
    cursorBlinking: 'smooth',
    renderWhitespace: 'selection',
  },
  terminal: {
    shell: '/bin/zsh',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursorStyle: 'block',
    scrollback: 10000,
  },
  ai: {
    model: 'gpt-4o',
    apiKey: '',
    baseUrl: '',
  },
});

interface AppState {
  isLoading: boolean;
  sidebarOpen: boolean;
  activePanel: string | null;
  settings: config.Settings;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: string | null) => void;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  isLoading: false,
  sidebarOpen: true,
  activePanel: null,
  settings: defaultSettings,

  setLoading: (loading) => set({ isLoading: loading }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActivePanel: (panel) => set({ activePanel: panel }),

  loadSettings: async () => {
    try {
      const loadedSettings = await GetSettings();
      set({ settings: loadedSettings });
    } catch (err) {
      console.error('加载配置失败:', err);
      set({ settings: config.Settings.createFrom(defaultSettings) });
    }
  },

  saveSettings: async (newSettings) => {
    try {
      const settingsToSave = config.Settings.createFrom(newSettings);
      await SaveSettings(settingsToSave);
      set({ settings: settingsToSave });
    } catch (err) {
      console.error('保存配置失败:', err);
    }
  },

  updateSettings: (partial) => {
    set((state) => ({
      settings: config.Settings.createFrom({ ...state.settings, ...partial }),
    }));
  },

  resetSettings: () => {
    set({ settings: config.Settings.createFrom(defaultSettings) });
  },
}));
