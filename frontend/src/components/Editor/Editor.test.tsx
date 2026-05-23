import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Editor from './Editor';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language }: { value: string; language: string }) => (
    <div data-testid="monaco-editor" data-value={value} data-language={language}>
      Monaco Editor Mock
    </div>
  ),
}));

vi.mock('./TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar">TabBar Mock</div>,
}));

vi.mock('./DiffViewer', () => ({
  default: () => <div data-testid="diff-viewer">DiffViewer Mock</div>,
}));

vi.mock('./LSPProvider', () => ({
  useLSP: () => ({
    client: null,
    isReady: false,
    diagnostics: [],
    initialize: vi.fn(),
    shutdown: vi.fn(),
    openDocument: vi.fn(),
    closeDocument: vi.fn(),
    changeDocument: vi.fn(),
    registerEditor: vi.fn(),
    cleanup: vi.fn(),
  }),
  LSPProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../stores/useThemeStore', () => ({
  useThemeStore: () => ({
    resolvedTheme: 'dark',
  }),
}));

vi.mock('../../stores/useEditorStore', () => ({
  useEditorStore: () => ({
    tabs: [],
    activeTab: null,
    diff: {
      isOpen: false,
      original: '',
      modified: '',
      language: 'typescript',
    },
    updateContent: vi.fn(),
  }),
}));

describe('Editor Component', () => {
  it('应渲染编辑器容器', () => {
    render(<Editor />);

    const container = screen.getByTestId('editor-container');
    expect(container).toBeInTheDocument();
  });

  it('应渲染TabBar', () => {
    render(<Editor />);

    const tabBar = screen.getByTestId('tab-bar');
    expect(tabBar).toBeInTheDocument();
  });

  it('没有激活标签页时应显示空状态', () => {
    render(<Editor />);

    const emptyState = screen.getByText(/打开文件开始编辑/i);
    expect(emptyState).toBeInTheDocument();
  });
});
