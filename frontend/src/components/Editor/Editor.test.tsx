import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Editor from './Editor';

// 模拟Monaco编辑器
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language }: { value: string; language: string }) => (
    <div data-testid="monaco-editor" data-value={value} data-language={language}>
      Monaco Editor Mock
    </div>
  ),
}));

// 模拟TabBar组件
vi.mock('./TabBar', () => ({
  default: () => <div data-testid="tab-bar">TabBar Mock</div>,
}));

// 模拟DiffViewer组件
vi.mock('./DiffViewer', () => ({
  default: () => <div data-testid="diff-viewer">DiffViewer Mock</div>,
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

  it('应渲染Monaco编辑器', () => {
    render(<Editor />);

    const monaco = screen.getByTestId('monaco-editor');
    expect(monaco).toBeInTheDocument();
  });

  it('没有激活标签页时应显示空状态', () => {
    render(<Editor />);

    const emptyState = screen.getByText(/打开文件开始编辑/i);
    expect(emptyState).toBeInTheDocument();
  });
});
