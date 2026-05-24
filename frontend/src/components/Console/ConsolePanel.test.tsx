import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsolePanel } from './ConsolePanel';
import type { ConsoleEntry } from '../../stores/useConsoleStore';

let mockStoreState: {
  entries: ConsoleEntry[];
  filterLevel: Set<string>;
  searchQuery: string;
  autoScroll: boolean;
  errorCount: number;
  warnCount: number;
} = {
  entries: [],
  filterLevel: new Set(['log', 'error', 'warn', 'info', 'debug']),
  searchQuery: '',
  autoScroll: true,
  errorCount: 0,
  warnCount: 0,
};

const mockClear = vi.fn();
const mockSetFilterLevel = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetAutoScroll = vi.fn();

const mockActions = {
  clear: mockClear,
  setFilterLevel: mockSetFilterLevel,
  setSearchQuery: mockSetSearchQuery,
  setAutoScroll: mockSetAutoScroll,
  markAsRead: vi.fn(),
};

vi.mock('../../stores/useConsoleStore', () => ({
  useConsoleStore: vi.fn((selector?: (s: typeof mockStoreState) => unknown) => {
    const fullState = { ...mockStoreState, ...mockActions };
    if (typeof selector === 'function') {
      return selector(fullState);
    }
    return fullState;
  }),
}));

function setStoreState(partial: Partial<typeof mockStoreState>) {
  mockStoreState = { ...mockStoreState, ...partial };
}

describe('ConsolePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      entries: [],
      filterLevel: new Set(['log', 'error', 'warn', 'info', 'debug']),
      searchQuery: '',
      autoScroll: true,
      errorCount: 0,
      warnCount: 0,
    };
  });

  it('应在无消息时显示空状态', () => {
    render(<ConsolePanel />);
    expect(screen.getByText(/暂无输出/)).toBeInTheDocument();
  });

  it('应显示控制台消息', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '初始化完成', timestamp: 1000, source: 'console', args: [] },
        { id: 2, level: 'error', message: '读取失败', timestamp: 2000, source: 'console', args: [] },
      ],
    });

    render(<ConsolePanel />);
    expect(screen.getByText(/初始化完成/)).toBeInTheDocument();
    expect(screen.getByText(/读取失败/)).toBeInTheDocument();
  });

  it('应显示过滤按钮', () => {
    render(<ConsolePanel />);
    expect(screen.getByText('log')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('warn')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('debug')).toBeInTheDocument();
  });

  it('点击过滤按钮应调用 setFilterLevel', () => {
    render(<ConsolePanel />);
    const errorBtn = screen.getByText('error');
    fireEvent.click(errorBtn);
    expect(mockSetFilterLevel).toHaveBeenCalledWith('error', false);
  });

  it('应显示搜索输入框', () => {
    render(<ConsolePanel />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });

  it('搜索输入应调用 setSearchQuery', () => {
    render(<ConsolePanel />);
    const input = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(input, { target: { value: 'error' } });
    expect(mockSetSearchQuery).toHaveBeenCalledWith('error');
  });

  it('点击清空按钮应调用 clear', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '测试', timestamp: 1000, source: 'console', args: [] },
      ],
    });

    render(<ConsolePanel />);
    const clearBtn = screen.getByTitle('清空');
    fireEvent.click(clearBtn);
    expect(mockClear).toHaveBeenCalled();
  });

  it('过滤后应只显示匹配级别的消息', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '普通日志', timestamp: 1000, source: 'console', args: [] },
        { id: 2, level: 'error', message: '错误信息', timestamp: 2000, source: 'console', args: [] },
      ],
      filterLevel: new Set(['error']), // 只显示 error
    });

    render(<ConsolePanel />);
    expect(screen.queryByText('普通日志')).not.toBeInTheDocument();
    expect(screen.getByText('错误信息')).toBeInTheDocument();
  });

  it('搜索应过滤消息', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '初始化完成', timestamp: 1000, source: 'console', args: [] },
        { id: 2, level: 'error', message: '读取文件失败', timestamp: 2000, source: 'console', args: [] },
      ],
      searchQuery: '初始化',
    });

    render(<ConsolePanel />);
    expect(screen.getByText('初始化完成')).toBeInTheDocument();
    expect(screen.queryByText('读取文件失败')).not.toBeInTheDocument();
  });
});
