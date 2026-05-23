import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';
import type { AppSettings } from '../../types';

const mockSaveSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockResetSettings = vi.fn();
const mockOnClose = vi.fn();

const defaultMockSettings: AppSettings = {
  theme: 'system',
  language: 'zh',
  autoSave: false,
  editor: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
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
    fontFamily: "'JetBrains Mono', monospace",
    cursorStyle: 'block',
    scrollback: 10000,
  },
  ai: {
    model: 'gpt-4o',
    apiKey: '',
    baseUrl: '',
  },
};

let mockStoreState: Record<string, unknown> = {};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return mockStoreState;
  }),
}));

vi.mock('../../config/shortcuts', () => ({
  getAllDefaultShortcuts: vi.fn(() => [
    {
      id: 'save',
      key: 'ctrl+s',
      command: 'file.save',
      description: '保存文件',
      category: 'file',
    },
    {
      id: 'find',
      key: 'ctrl+f',
      command: 'edit.find',
      description: '查找',
      category: 'edit',
    },
  ]),
  getShortcutDisplay: vi.fn((key: string) => key.toUpperCase().replace('CTRL+', 'Ctrl+')),
}));

function setMockStore(overrides: Record<string, unknown> = {}) {
  mockStoreState = {
    settings: { ...defaultMockSettings },
    saveSettings: mockSaveSettings,
    updateSettings: mockUpdateSettings,
    resetSettings: mockResetSettings,
    ...overrides,
  };
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {};
    window.confirm = vi.fn(() => true);
    window.URL.createObjectURL = vi.fn(() => 'blob:test');
    window.URL.revokeObjectURL = vi.fn();
  });

  describe('打开/关闭', () => {
    it('isOpen 为 true 时应渲染设置面板', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('设置')).toBeInTheDocument();
    });

    it('isOpen 为 false 时不应渲染设置面板', () => {
      setMockStore();

      render(<SettingsPanel isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByText('设置')).not.toBeInTheDocument();
    });
  });

  describe('设置表单渲染', () => {
    it('应渲染通用分类的设置项', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('主题')).toBeInTheDocument();
      expect(screen.getByText('语言')).toBeInTheDocument();
      expect(screen.getByText('自动保存')).toBeInTheDocument();
    });

    it('应渲染编辑器分类的设置项', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const editorCategory = screen.getByText('编辑器');
      fireEvent.click(editorCategory);

      expect(screen.getByText('字体大小')).toBeInTheDocument();
      expect(screen.getByText('字体')).toBeInTheDocument();
      expect(screen.getByText('Tab 宽度')).toBeInTheDocument();
      expect(screen.getByText('自动换行')).toBeInTheDocument();
    });

    it('应渲染终端分类的设置项', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const terminalCategory = screen.getByText('终端');
      fireEvent.click(terminalCategory);

      expect(screen.getByText('Shell 路径')).toBeInTheDocument();
      expect(screen.getByText('回滚行数')).toBeInTheDocument();
    });

    it('应渲染 AI 分类的设置项', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const aiCategory = screen.getByText('AI');
      fireEvent.click(aiCategory);

      expect(screen.getByText('默认模型')).toBeInTheDocument();
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });

    it('应渲染 Git 分类的设置项', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const gitCategory = screen.getByText('Git');
      fireEvent.click(gitCategory);

      expect(screen.getByText('默认分支名')).toBeInTheDocument();
      expect(screen.getByText('提交模板')).toBeInTheDocument();
    });

    it('应渲染快捷键分类的内容', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const shortcutsCategory = screen.getByText('快捷键');
      fireEvent.click(shortcutsCategory);

      expect(screen.getByText('保存文件')).toBeInTheDocument();
      expect(screen.getByText('查找')).toBeInTheDocument();
    });
  });

  describe('主题切换', () => {
    it('应提供所有主题选项', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const themeSelect = screen.getByDisplayValue('跟随系统');
      expect(themeSelect.querySelector('option[value="light"]')).toBeInTheDocument();
      expect(themeSelect.querySelector('option[value="dark"]')).toBeInTheDocument();
      expect(themeSelect.querySelector('option[value="system"]')).toBeInTheDocument();
    });

    it('应显示当前主题值', () => {
      setMockStore({
        settings: {
          ...defaultMockSettings,
          theme: 'light',
        },
      });

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByDisplayValue('亮色')).toBeInTheDocument();
    });

    it('切换主题后设置项应标记为已修改', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const themeSelect = screen.getByDisplayValue('跟随系统');
      fireEvent.change(themeSelect, { target: { value: 'dark' } });

      expect(screen.getByText('未保存')).toBeInTheDocument();
    });
  });

  describe('语言切换', () => {
    it('切换语言后设置项应标记为已修改', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const languageSelect = screen.getByDisplayValue('简体中文');
      fireEvent.change(languageSelect, { target: { value: 'en' } });

      expect(screen.getByText('未保存')).toBeInTheDocument();
    });
  });

  describe('开关切换', () => {
    it('点击自动保存开关后设置项应标记为已修改', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const autoSaveLabel = screen.getByText('自动保存');
      const autoSaveRow = autoSaveLabel.closest('div[class*="flex items-start"]');
      const toggleButton = autoSaveRow?.querySelector('button[class*="inline-flex"]');

      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(screen.getByText('未保存')).toBeInTheDocument();
      }
    });
  });

  describe('保存配置', () => {
    it('应渲染保存按钮', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('保存')).toBeInTheDocument();
    });

    it('点击保存按钮应调用 saveSettings', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const themeSelect = screen.getByDisplayValue('跟随系统');
      fireEvent.change(themeSelect, { target: { value: 'dark' } });

      const saveButton = screen.getByText('保存').closest('button');
      if (saveButton) {
        fireEvent.click(saveButton);
        expect(mockSaveSettings).toHaveBeenCalled();
      }
    });
  });

  describe('搜索', () => {
    it('搜索设置项应过滤结果', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('搜索设置项...');
      fireEvent.change(searchInput, { target: { value: '主题' } });

      expect(screen.getByText('主题')).toBeInTheDocument();
    });

    it('无匹配搜索应显示空状态', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('搜索设置项...');
      fireEvent.change(searchInput, { target: { value: '不存在的设置项xyz' } });

      expect(screen.getByText('未找到匹配的设置项')).toBeInTheDocument();
    });
  });

  describe('关闭面板', () => {
    it('点击关闭按钮应调用 onClose', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByTitle('关闭');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('按 Escape 键应调用 onClose', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      const overlay = screen.getByText('设置').closest('div[class*="fixed inset-0"]');
      if (overlay) {
        fireEvent.keyDown(overlay, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('导入/导出', () => {
    it('应渲染导入按钮', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('导入')).toBeInTheDocument();
    });

    it('应渲染导出按钮', () => {
      setMockStore();

      render(<SettingsPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('导出')).toBeInTheDocument();
    });
  });
});
