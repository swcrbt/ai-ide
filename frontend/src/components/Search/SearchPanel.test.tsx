import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchPanel } from './SearchPanel';

const mockOnFileClick = vi.fn();

let mockExplorerState: Record<string, unknown> = {};

vi.mock('../../stores/useExplorerStore', () => ({
  useExplorerStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockExplorerState);
    }
    return mockExplorerState;
  }),
}));

function setMockExplorerState(state: Record<string, unknown>) {
  mockExplorerState = {
    treeData: [],
    ...state,
  };
}

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExplorerState = {};
  });

  it('应渲染搜索输入框', () => {
    setMockExplorerState({ treeData: [] });
    render(<SearchPanel onFileClick={mockOnFileClick} />);

    expect(screen.getByPlaceholderText('搜索文件...')).toBeInTheDocument();
  });

  it('搜索应过滤文件', () => {
    setMockExplorerState({
      treeData: [
        { name: 'App.tsx', path: '/project/App.tsx', isDir: false, modTime: '', size: 0 },
        { name: 'index.ts', path: '/project/index.ts', isDir: false, modTime: '', size: 0 },
      ],
    });
    render(<SearchPanel onFileClick={mockOnFileClick} />);

    const input = screen.getByPlaceholderText('搜索文件...');
    fireEvent.change(input, { target: { value: 'App' } });

    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
  });

  it('点击文件应调用 onFileClick', () => {
    setMockExplorerState({
      treeData: [
        { name: 'App.tsx', path: '/project/App.tsx', isDir: false, modTime: '', size: 0 },
      ],
    });
    render(<SearchPanel onFileClick={mockOnFileClick} />);

    const input = screen.getByPlaceholderText('搜索文件...');
    fireEvent.change(input, { target: { value: 'App' } });

    const fileButton = screen.getByText('App.tsx');
    fireEvent.click(fileButton);

    expect(mockOnFileClick).toHaveBeenCalledWith('/project/App.tsx');
  });
});
