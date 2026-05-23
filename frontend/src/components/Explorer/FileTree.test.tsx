import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree } from './FileTree';
import type { FileNode } from '../../stores/useExplorerStore';

const mockLoadTree = vi.fn();
const mockRefresh = vi.fn();
const mockToggleNode = vi.fn();
const mockSelectNode = vi.fn();
const mockExpandNode = vi.fn();
const mockCollapseNode = vi.fn();
const mockOnFileClick = vi.fn();
const mockOpenFile = vi.fn();
const mockPerformOperation = vi.fn();

let mockExplorerState: Record<string, unknown> = {};
let mockEditorState: Record<string, unknown> = {};

vi.mock('../../stores/useExplorerStore', () => ({
  useExplorerStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockExplorerState);
    }
    return mockExplorerState;
  }),
}));

vi.mock('../../stores/useEditorStore', () => ({
  useEditorStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockEditorState);
    }
    return mockEditorState;
  }),
}));

function createMockFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return {
    name: 'file.txt',
    path: '/project/file.txt',
    isDir: false,
    modTime: '2026-05-23T10:00:00Z',
    size: 1024,
    gitStatus: null,
    ...overrides,
  };
}

function createMockDirNode(name: string, path: string, children: FileNode[] = []): FileNode {
  return {
    name,
    path,
    isDir: true,
    modTime: '2026-05-23T10:00:00Z',
    size: 0,
    gitStatus: null,
    children,
  };
}

function setMockExplorerState(state: Record<string, unknown>) {
  mockExplorerState = {
    treeData: [],
    isLoading: false,
    projectName: 'test-project',
    expandedPaths: new Set<string>(),
    selectedPath: null,
    loadTree: mockLoadTree,
    refresh: mockRefresh,
    toggleNode: mockToggleNode,
    selectNode: mockSelectNode,
    expandNode: mockExpandNode,
    collapseNode: mockCollapseNode,
    performOperation: mockPerformOperation,
    ...state,
  };
}

function setMockEditorState(state: Record<string, unknown> = {}) {
  mockEditorState = {
    openFile: mockOpenFile,
    ...state,
  };
}

describe('FileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExplorerState = {};
    mockEditorState = {};
  });

  describe('加载状态', () => {
    it('加载中时应显示加载提示', () => {
      setMockExplorerState({
        treeData: [],
        isLoading: true,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('挂载时应调用 loadTree', () => {
      setMockExplorerState({
        treeData: [],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(mockLoadTree).toHaveBeenCalledTimes(1);
    });
  });

  describe('空状态', () => {
    it('空目录时应显示空状态提示', () => {
      setMockExplorerState({
        treeData: [],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.getByText('暂无文件')).toBeInTheDocument();
      expect(screen.getByText('项目目录为空或加载失败')).toBeInTheDocument();
    });
  });

  describe('文件树渲染', () => {
    it('应渲染项目根目录名称', () => {
      setMockExplorerState({
        treeData: [createMockFileNode()],
        isLoading: false,
        projectName: 'my-awesome-project',
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.getByText('my-awesome-project')).toBeInTheDocument();
    });

    it('应渲染顶层文件节点', () => {
      setMockExplorerState({
        treeData: [
          createMockFileNode({ name: 'README.md', path: '/project/README.md' }),
          createMockFileNode({ name: 'package.json', path: '/project/package.json' }),
        ],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('应渲染顶层目录节点', () => {
      setMockExplorerState({
        treeData: [
          createMockDirNode('src', '/project/src', [
            createMockFileNode({ name: 'App.tsx', path: '/project/src/App.tsx' }),
          ]),
        ],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.getByText('src')).toBeInTheDocument();
    });

    it('应显示 Git 状态指示器', () => {
      setMockExplorerState({
        treeData: [
          createMockFileNode({
            name: 'modified.ts',
            path: '/project/modified.ts',
            gitStatus: 'modified',
          }),
          createMockFileNode({
            name: 'added.ts',
            path: '/project/added.ts',
            gitStatus: 'added',
          }),
        ],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.getByText('modified.ts')).toBeInTheDocument();
      expect(screen.getByText('added.ts')).toBeInTheDocument();
    });
  });

  describe('点击文件', () => {
    it('点击文件应调用 selectNode 和 onFileClick', () => {
      setMockExplorerState({
        treeData: [
          createMockFileNode({ name: 'App.tsx', path: '/project/src/App.tsx' }),
        ],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      const fileNode = screen.getByText('App.tsx');
      fireEvent.click(fileNode);

      expect(mockSelectNode).toHaveBeenCalledWith('/project/src/App.tsx');
      expect(mockOnFileClick).toHaveBeenCalledWith('/project/src/App.tsx');
    });

    it('点击文件应高亮选中状态', () => {
      setMockExplorerState({
        treeData: [
          createMockFileNode({ name: 'App.tsx', path: '/project/src/App.tsx' }),
        ],
        isLoading: false,
        selectedPath: '/project/src/App.tsx',
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      const fileRow = screen.getByText('App.tsx').closest('div');
      expect(fileRow).toHaveClass('bg-accent');
    });
  });

  describe('展开/折叠目录', () => {
    it('点击目录应调用 toggleNode', () => {
      setMockExplorerState({
        treeData: [
          createMockDirNode('src', '/project/src', [
            createMockFileNode({ name: 'App.tsx', path: '/project/src/App.tsx' }),
          ]),
        ],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      const dirNode = screen.getByText('src');
      fireEvent.click(dirNode);

      expect(mockToggleNode).toHaveBeenCalledWith('/project/src');
    });

    it('点击目录展开按钮应调用 toggleNode', () => {
      setMockExplorerState({
        treeData: [
          createMockDirNode('src', '/project/src', [
            createMockFileNode({ name: 'App.tsx', path: '/project/src/App.tsx' }),
          ]),
        ],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      const expandButton = screen.getByText('src').closest('div')?.querySelector('button');
      expect(expandButton).toBeInTheDocument();
      if (expandButton) {
        fireEvent.click(expandButton);
        expect(mockToggleNode).toHaveBeenCalledWith('/project/src');
      }
    });

    it('折叠的目录不应在 FileTree 中直接渲染子节点', () => {
      setMockExplorerState({
        treeData: [
          createMockDirNode('src', '/project/src', [
            createMockFileNode({ name: 'App.tsx', path: '/project/src/App.tsx' }),
          ]),
        ],
        isLoading: false,
        expandedPaths: new Set(),
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
    });
  });

  describe('刷新', () => {
    it('点击刷新按钮应调用 refresh', () => {
      setMockExplorerState({
        treeData: [createMockFileNode()],
        isLoading: false,
      });
      setMockEditorState();

      render(<FileTree onFileClick={mockOnFileClick} />);

      const refreshButton = screen.getByTitle('刷新');
      fireEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
