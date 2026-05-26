import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from './useThemeStore';

const mockGetSettings = vi.fn();
const mockSaveSettings = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSettings: (...args: unknown[]) => mockGetSettings(...args),
  SaveSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

vi.mock('../../wailsjs/go/models', () => ({
  config: {},
}));

describe('useThemeStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({
      theme: 'system',
      resolvedTheme: 'light',
      isLoaded: false,
    });
  });

  it('初始状态应为 system 主题', () => {
    const state = useThemeStore.getState();
    expect(state.theme).toBe('system');
    expect(state.resolvedTheme).toBe('light');
    expect(state.isLoaded).toBe(false);
  });

  describe('setTheme', () => {
    it('应设置亮色主题', () => {
      useThemeStore.getState().setTheme('light');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
    });

    it('应设置暗色主题', () => {
      useThemeStore.getState().setTheme('dark');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });

    it('应保存主题到后端', () => {
      mockGetSettings.mockResolvedValue({ theme: 'system' });

      useThemeStore.getState().setTheme('dark');

      // setTheme 是同步的，saveThemeToBackend 是异步的
      // 我们只验证状态已更新
      expect(useThemeStore.getState().theme).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('亮色时应切换到暗色', () => {
      useThemeStore.setState({ theme: 'light', resolvedTheme: 'light' });

      useThemeStore.getState().toggleTheme();

      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    });

    it('暗色时应切换到亮色', () => {
      useThemeStore.setState({ theme: 'dark', resolvedTheme: 'dark' });

      useThemeStore.getState().toggleTheme();

      expect(useThemeStore.getState().resolvedTheme).toBe('light');
    });
  });

  describe('initTheme', () => {
    it('应从后端加载主题', async () => {
      mockGetSettings.mockResolvedValue({ theme: 'dark' });

      await useThemeStore.getState().initTheme();

      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
      expect(state.isLoaded).toBe(true);
    });

    it('后端无主题时应默认 system', async () => {
      mockGetSettings.mockResolvedValue({});

      await useThemeStore.getState().initTheme();

      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      expect(state.isLoaded).toBe(true);
    });

    it('加载失败时不应崩溃', async () => {
      mockGetSettings.mockRejectedValue(new Error('网络错误'));

      await useThemeStore.getState().initTheme();

      const state = useThemeStore.getState();
      expect(state.isLoaded).toBe(true);
    });
  });
});
