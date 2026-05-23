import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GitPanel } from './GitPanel';

const mockStageFiles = vi.fn();
const mockUnstageFiles = vi.fn();
const mockLoadStatus = vi.fn();
const mockLoadDiff = vi.fn();
const mockSetSelectedFile = vi.fn();
const mockSetCommitMessage = vi.fn();
const mockCommit = vi.fn();
const mockPush = vi.fn();
const mockPull = vi.fn();

let mockStoreState: Record<string, unknown> = {};

vi.mock('../../stores/useGitStore', () => ({
  useGitStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return mockStoreState;
  }),
}));

function createMockStatus(overrides: Record<string, unknown> = {}) {
  return {
    staged: [] as Array<{ path: string; indexStatus: string; worktreeStatus: string }>,
    modified: [] as Array<{ path: string; indexStatus: string; worktreeStatus: string }>,
    untracked: [] as Array<{ path: string; indexStatus: string; worktreeStatus: string }>,
    deleted: [] as Array<{ path: string; indexStatus: string; worktreeStatus: string }>,
    isClean: false,
    branch: 'main',
    ...overrides,
  };
}

function setMockStore(state: Record<string, unknown>) {
  mockStoreState = {
    status: null,
    summary: null,
    currentBranch: '',
    isLoading: false,
    isCommitting: false,
    isPushing: false,
    isPulling: false,
    commitMessage: '',
    diffContent: '',
    selectedFile: null,
    stageFiles: mockStageFiles,
    unstageFiles: mockUnstageFiles,
    commit: mockCommit,
    push: mockPush,
    pull: mockPull,
    loadStatus: mockLoadStatus,
    loadDiff: mockLoadDiff,
    setCommitMessage: mockSetCommitMessage,
    setSelectedFile: mockSetSelectedFile,
    ...state,
  };
}

describe('GitPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {};
  });

  describe('空状态渲染', () => {
    it('当没有 Git 仓库时应显示空状态提示', () => {
      setMockStore({
        status: null,
        isLoading: false,
      });

      render(<GitPanel />);

      expect(screen.getByText('未检测到 Git 仓库')).toBeInTheDocument();
      expect(screen.getByText('打开一个 Git 项目以查看状态')).toBeInTheDocument();
    });

    it('空状态应显示 Git 图标', () => {
      setMockStore({
        status: null,
        isLoading: false,
      });

      render(<GitPanel />);

      const icon = document.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Git 状态数据渲染', () => {
    it('应显示当前分支名称', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'feature/test-branch',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      expect(screen.getByText('feature/test-branch')).toBeInTheDocument();
    });

    it('当分支名称为空时应显示默认 main', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: '',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('应渲染已修改文件列表', () => {
      const modifiedFile = {
        path: 'src/App.tsx',
        indexStatus: 'M',
        worktreeStatus: 'M',
      };

      setMockStore({
        status: createMockStatus({
          modified: [modifiedFile],
          isClean: false,
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
      });

      render(<GitPanel />);

      expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
      expect(screen.getByText('已修改')).toBeInTheDocument();
    });

    it('应渲染已暂存文件列表', () => {
      const stagedFile = {
        path: 'src/components/Button.tsx',
        indexStatus: 'A',
        worktreeStatus: ' ',
      };

      setMockStore({
        status: createMockStatus({
          staged: [stagedFile],
          isClean: false,
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
      });

      render(<GitPanel />);

      expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument();
      expect(screen.getByText('已暂存')).toBeInTheDocument();
    });

    it('应渲染未追踪文件列表', () => {
      const untrackedFile = {
        path: 'src/new-file.ts',
        indexStatus: '?',
        worktreeStatus: '?',
      };

      setMockStore({
        status: createMockStatus({
          untracked: [untrackedFile],
          isClean: false,
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
      });

      render(<GitPanel />);

      expect(screen.getByText('src/new-file.ts')).toBeInTheDocument();
      expect(screen.getByText('未追踪')).toBeInTheDocument();
    });

    it('工作区干净时应显示干净状态', () => {
      setMockStore({
        status: createMockStatus({
          isClean: true,
          staged: [],
          modified: [],
          untracked: [],
          deleted: [],
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      expect(screen.getByText('工作区干净，没有变更')).toBeInTheDocument();
    });

    it('应显示 ahead/behind 指示器', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'main',
        summary: { ahead: 2, behind: 1, totalChanges: 0 },
      });

      render(<GitPanel />);

      expect(screen.getByText('↑2')).toBeInTheDocument();
      expect(screen.getByText('↓1')).toBeInTheDocument();
    });
  });

  describe('交互', () => {
    it('点击暂存按钮应对未暂存文件调用 stageFiles', () => {
      const modifiedFile = {
        path: 'src/App.tsx',
        indexStatus: 'M',
        worktreeStatus: 'M',
      };

      setMockStore({
        status: createMockStatus({
          modified: [modifiedFile],
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
      });

      render(<GitPanel />);

      const stageButtons = screen.getAllByTitle('暂存');
      fireEvent.click(stageButtons[0]);

      expect(mockStageFiles).toHaveBeenCalledWith(['src/App.tsx']);
    });

    it('点击取消暂存按钮应对已暂存文件调用 unstageFiles', () => {
      const stagedFile = {
        path: 'src/components/Button.tsx',
        indexStatus: 'A',
        worktreeStatus: ' ',
      };

      setMockStore({
        status: createMockStatus({
          staged: [stagedFile],
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
      });

      render(<GitPanel />);

      const unstageButtons = screen.getAllByTitle('取消暂存');
      fireEvent.click(unstageButtons[0]);

      expect(mockUnstageFiles).toHaveBeenCalledWith(['src/components/Button.tsx']);
    });

    it('点击刷新按钮应调用 loadStatus', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      const refreshButton = screen.getByTitle('刷新');
      fireEvent.click(refreshButton);

      expect(mockLoadStatus).toHaveBeenCalled();
    });

    it('点击拉取按钮应调用 pull', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      const pullButton = screen.getByTitle('拉取');
      fireEvent.click(pullButton);

      expect(mockPull).toHaveBeenCalled();
    });

    it('点击推送按钮应调用 push', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      const pushButton = screen.getByTitle('推送');
      fireEvent.click(pushButton);

      expect(mockPush).toHaveBeenCalled();
    });

    it('输入提交信息并点击提交应调用 commit', () => {
      setMockStore({
        status: createMockStatus({
          staged: [{
            path: 'src/App.tsx',
            indexStatus: 'M',
            worktreeStatus: 'M',
          }],
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
        commitMessage: '测试提交信息',
      });

      render(<GitPanel />);

      const commitButton = screen.getByText('提交');
      fireEvent.click(commitButton);

      expect(mockCommit).toHaveBeenCalled();
    });

    it('点击文件项应调用 loadDiff 查看差异', () => {
      const modifiedFile = {
        path: 'src/App.tsx',
        indexStatus: 'M',
        worktreeStatus: 'M',
      };

      setMockStore({
        status: createMockStatus({
          modified: [modifiedFile],
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
      });

      render(<GitPanel />);

      const fileItem = screen.getByText('src/App.tsx');
      fireEvent.click(fileItem);

      expect(mockLoadDiff).toHaveBeenCalledWith('src/App.tsx', false);
      expect(mockSetSelectedFile).toHaveBeenCalledWith('src/App.tsx');
    });

    it('提交按钮在没有暂存文件时应被禁用', () => {
      setMockStore({
        status: createMockStatus({
          staged: [],
          modified: [{
            path: 'src/App.tsx',
            indexStatus: 'M',
            worktreeStatus: 'M',
          }],
        }),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 1 },
        commitMessage: '测试提交信息',
      });

      render(<GitPanel />);

      const commitButton = screen.getByText('提交');
      expect(commitButton).toBeDisabled();
    });
  });

  describe('标签页', () => {
    it('应默认显示变更标签页', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      expect(screen.getByText('变更')).toBeInTheDocument();
      expect(screen.getByText('历史')).toBeInTheDocument();
    });

    it('点击历史标签页应切换到历史视图', () => {
      setMockStore({
        status: createMockStatus(),
        currentBranch: 'main',
        summary: { ahead: 0, behind: 0, totalChanges: 0 },
      });

      render(<GitPanel />);

      const historyTab = screen.getByText('历史');
      fireEvent.click(historyTab);

      expect(screen.getByText('提交历史功能即将上线')).toBeInTheDocument();
    });
  });

  describe('分支显示', () => {
    it('应正确显示不同分支名称', () => {
      const branches = ['main', 'develop', 'feature/awesome-feature', 'bugfix/issue-123'];

      for (const branch of branches) {
        setMockStore({
          status: createMockStatus(),
          currentBranch: branch,
          summary: { ahead: 0, behind: 0, totalChanges: 0 },
        });

        const { unmount } = render(<GitPanel />);
        expect(screen.getByText(branch)).toBeInTheDocument();
        unmount();
      }
    });
  });
});
