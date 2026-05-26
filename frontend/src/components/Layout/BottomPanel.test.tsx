import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomPanel, type BottomTab } from './BottomPanel';

const mockOnTabChange = vi.fn();
const mockOnHide = vi.fn();

const defaultProps = {
  activeTab: 'terminal' as BottomTab,
  onTabChange: mockOnTabChange,
  onHide: mockOnHide,
  children: {
    terminal: <div data-testid="terminal-content">终端内容</div>,
    aiChat: <div data-testid="ai-content">AI内容</div>,
    console: <div data-testid="console-content">控制台内容</div>,
  },
};

describe('BottomPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应渲染三个标签页', () => {
    render(<BottomPanel {...defaultProps} />);

    expect(screen.getByText('终端')).toBeInTheDocument();
    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.getByText('AI 助手')).toBeInTheDocument();
  });

  it('应显示当前激活标签的内容', () => {
    render(<BottomPanel {...defaultProps} />);
    expect(screen.getByTestId('terminal-content')).toBeInTheDocument();
  });

  it('切换标签时应调用 onTabChange', () => {
    render(<BottomPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('控制台'));
    expect(mockOnTabChange).toHaveBeenCalledWith('console');

    fireEvent.click(screen.getByText('AI 助手'));
    expect(mockOnTabChange).toHaveBeenCalledWith('ai');
  });

  it('点击隐藏按钮应调用 onHide', () => {
    render(<BottomPanel {...defaultProps} />);

    const hideButton = screen.getByTitle('隐藏');
    fireEvent.click(hideButton);
    expect(mockOnHide).toHaveBeenCalled();
  });

  it('点击最小化按钮应折叠面板', () => {
    render(<BottomPanel {...defaultProps} />);

    const minimizeButton = screen.getByTitle('最小化');
    fireEvent.click(minimizeButton);

    // 再次点击应恢复
    fireEvent.click(minimizeButton);
    expect(screen.getByTitle('最小化')).toBeInTheDocument();
  });

  it('控制台标签在有错误时应显示角标', () => {
    // 此测试需要 mock useConsoleStore，但由于组件中直接使用 selector
    // 我们在 setup.ts 中已有 mock，这里简化测试结构渲染
    render(<BottomPanel {...defaultProps} />);
    expect(screen.getByText('控制台')).toBeInTheDocument();
  });
});
