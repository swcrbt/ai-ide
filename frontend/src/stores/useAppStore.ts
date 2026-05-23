import { create } from 'zustand';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';
import type { AppSettings } from '../types';

// 默认配置
const defaultSettings: AppSettings = {
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
};

interface AppState {
  isLoading: boolean;
  sidebarOpen: boolean;
  activePanel: string | null;
  settings: AppSettings;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: string | null) => void;
  // 设置相关方法
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  isLoading: false,
  sidebarOpen: true,
  activePanel: null,
  settings: { ...defaultSettings },

  setLoading: (loading) => set({ isLoading: loading }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActivePanel: (panel) => set({ activePanel: panel }),

  // 从后端加载配置
  loadSettings: async () => {
    try {
      const settingsJSON = await GetSettings();
      const loadedSettings = JSON.parse(settingsJSON) as AppSettings;
      set({ settings: loadedSettings });
    } catch (err) {
      console.error('加载配置失败:', err);
      // 加载失败时使用默认配置
      set({ settings: { ...defaultSettings } });
    }
  },

  // 保存配置到后端
  saveSettings: async (newSettings) => {
    try {
      await SaveSettings(JSON.stringify(newSettings));
      set({ settings: newSettings });
    } catch (err) {
      console.error('保存配置失败:', err);
    }
  },

  // 更新本地配置（不立即保存到后端）
  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
  },

  // 重置为默认配置
  resetSettings: () => {
    set({ settings: { ...defaultSettings } });
  },
}));
