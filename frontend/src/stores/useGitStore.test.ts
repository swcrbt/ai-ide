import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGitStore } from './useGitStore';

const mockStatus = vi.fn();
const mockSummary = vi.fn();
const mockBranches = vi.fn();
const mockLog = vi.fn();
const mockDiff = vi.fn();
const mockDiffAll = vi.fn();
const mockStage = vi.fn();
const mockUnstage = vi.fn();
const mockCommit = vi.fn();
const mockPush = vi.fn();
const mockPull = vi.fn();
const mockCheckout = vi.fn();
const mockSetRepoPath = vi.fn();
const mockGetRoot = vi.fn();
const mockIsGitRepo = vi.fn();

vi.mock('../types/wails', () => ({
  Status: (...args: unknown[]) => mockStatus(...args),
  Summary: (...args: unknown[]) => mockSummary(...args),
  Branches: (...args: unknown[]) => mockBranches(...args),
  Log: (...args: unknown[]) => mockLog(...args),
  Diff: (...args: unknown[]) => mockDiff(...args),
  DiffAll: (...args: unknown[]) => mockDiffAll(...args),
  Stage: (...args: unknown[]) => mockStage(...args),
  Unstage: (...args: unknown[]) => mockUnstage(...args),
  Commit: (...args: unknown[]) => mockCommit(...args),
  Push: (...args: unknown[]) => mockPush(...args),
  Pull: (...args: unknown[]) => mockPull(...args),
  Checkout: (...args: unknown[]) => mockCheckout(...args),
  SetRepoPath: (...args: unknown[]) => mockSetRepoPath(...args),
  GetRoot: (...args: unknown[]) => mockGetRoot(...args),
  IsGitRepo: (...args: unknown[]) => mockIsGitRepo(...args),
  GetRepoPath: vi.fn(),
}));

describe('useGitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGitStore.setState({
      status: null,
      summary: null,
      branches: [],
      commits: [],
      diffContent: '',
      selectedFile: null,
      isGitRepo: false,
      repoPath: '',
      currentBranch: '',
      isLoading: false,
      isCommitting: false,
      isPushing: false,
      isPulling: false,
      commitMessage: '',
      fileStatusMap: new Map(),
    });
  });

  it('应有正确的初始状态', () => {
    const state = useGitStore.getState();
    expect(state.status).toBeNull();
    expect(state.branches).toEqual([]);
    expect(state.isGitRepo).toBe(false);
    expect(state.repoPath).toBe('');
    expect(state.commitMessage).toBe('');
  });

  describe('loadStatus', () => {
    it('应加载 Git 状态并构建文件状态映射', async () => {
      mockStatus.mockResolvedValue({
        branch: 'main',
        modified: [{ path: 'file1.ts' }],
        added: [{ path: 'file2.ts' }],
        deleted: [{ path: 'file3.ts' }],
        untracked: [{ path: 'file4.ts' }],
      });

      useGitStore.setState({ repoPath: '/project' });
      await useGitStore.getState().loadStatus();

      const state = useGitStore.getState();
      expect(state.currentBranch).toBe('main');
      expect(state.isGitRepo).toBe(true);
      expect(state.fileStatusMap.get('file1.ts')).toBe('M');
      expect(state.fileStatusMap.get('file2.ts')).toBe('A');
      expect(state.fileStatusMap.get('file3.ts')).toBe('D');
      expect(state.fileStatusMap.get('file4.ts')).toBe('?');
    });

    it('无 repoPath 时应直接返回', async () => {
      await useGitStore.getState().loadStatus();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('加载失败时应设置 isGitRepo 为 false', async () => {
      mockStatus.mockRejectedValue(new Error('Git 错误'));
      useGitStore.setState({ repoPath: '/project' });

      await useGitStore.getState().loadStatus();

      expect(useGitStore.getState().isGitRepo).toBe(false);
      expect(useGitStore.getState().isLoading).toBe(false);
    });
  });

  describe('loadSummary', () => {
    it('应加载 Git 概要', async () => {
      mockSummary.mockResolvedValue({ totalChanges: 5, ahead: 1, behind: 0 });
      useGitStore.setState({ repoPath: '/project' });

      await useGitStore.getState().loadSummary();

      expect(useGitStore.getState().summary).toEqual({ totalChanges: 5, ahead: 1, behind: 0 });
    });
  });

  describe('loadBranches', () => {
    it('应加载分支列表', async () => {
      mockBranches.mockResolvedValue([
        { name: 'main', current: true },
        { name: 'feature/test', current: false },
      ]);

      await useGitStore.getState().loadBranches();

      expect(useGitStore.getState().branches).toHaveLength(2);
    });
  });

  describe('loadCommits', () => {
    it('应加载提交历史', async () => {
      mockLog.mockResolvedValue([
        { hash: 'abc123', message: 'initial commit', author: 'test', date: '2024-01-01' },
      ]);

      await useGitStore.getState().loadCommits();

      expect(useGitStore.getState().commits).toHaveLength(1);
    });
  });

  describe('loadDiff', () => {
    it('应加载文件 diff', async () => {
      mockDiff.mockResolvedValue({ content: '+added line' });

      await useGitStore.getState().loadDiff('file.ts');

      expect(useGitStore.getState().diffContent).toBe('+added line');
      expect(useGitStore.getState().selectedFile).toBe('file.ts');
    });
  });

  describe('stageFiles / unstageFiles', () => {
    it('stageFiles 应暂存文件并刷新状态', async () => {
      mockStage.mockResolvedValue(undefined);
      mockStatus.mockResolvedValue({ branch: 'main' });
      mockSummary.mockResolvedValue({});
      useGitStore.setState({ repoPath: '/project' });

      await useGitStore.getState().stageFiles(['file1.ts']);

      expect(mockStage).toHaveBeenCalledWith(['file1.ts']);
    });

    it('unstageFiles 应取消暂存并刷新状态', async () => {
      mockUnstage.mockResolvedValue(undefined);
      mockStatus.mockResolvedValue({ branch: 'main' });
      mockSummary.mockResolvedValue({});
      useGitStore.setState({ repoPath: '/project' });

      await useGitStore.getState().unstageFiles(['file1.ts']);

      expect(mockUnstage).toHaveBeenCalledWith(['file1.ts']);
    });
  });

  describe('commit', () => {
    it('空提交信息时不应提交', async () => {
      await useGitStore.getState().commit();
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('应提交并刷新状态', async () => {
      mockCommit.mockResolvedValue(undefined);
      mockStatus.mockResolvedValue({ branch: 'main' });
      mockSummary.mockResolvedValue({});
      useGitStore.setState({ repoPath: '/project', commitMessage: 'feat: test' });

      await useGitStore.getState().commit();

      expect(mockCommit).toHaveBeenCalledWith('feat: test');
      expect(useGitStore.getState().commitMessage).toBe('');
      expect(useGitStore.getState().isCommitting).toBe(false);
    });
  });

  describe('push / pull', () => {
    it('push 应调用 Push 并刷新状态', async () => {
      mockPush.mockResolvedValue(undefined);
      mockStatus.mockResolvedValue({ branch: 'main' });
      mockSummary.mockResolvedValue({});
      useGitStore.setState({ repoPath: '/project' });

      await useGitStore.getState().push();

      expect(mockPush).toHaveBeenCalled();
      expect(useGitStore.getState().isPushing).toBe(false);
    });

    it('pull 应调用 Pull 并刷新状态', async () => {
      mockPull.mockResolvedValue(undefined);
      mockStatus.mockResolvedValue({ branch: 'main' });
      mockSummary.mockResolvedValue({});
      useGitStore.setState({ repoPath: '/project' });

      await useGitStore.getState().pull();

      expect(mockPull).toHaveBeenCalled();
      expect(useGitStore.getState().isPulling).toBe(false);
    });
  });

  describe('setCommitMessage / setSelectedFile', () => {
    it('应设置提交信息', () => {
      useGitStore.getState().setCommitMessage('feat: new feature');
      expect(useGitStore.getState().commitMessage).toBe('feat: new feature');
    });

    it('应设置选中文件', () => {
      useGitStore.getState().setSelectedFile('file.ts');
      expect(useGitStore.getState().selectedFile).toBe('file.ts');
    });
  });

  describe('getFileStatusColor / getFileStatusLabel', () => {
    it('应返回正确的状态颜色', () => {
      const store = useGitStore.getState();
      expect(store.getFileStatusColor('M')).toBe('#e5c07b');
      expect(store.getFileStatusColor('A')).toBe('#98c379');
      expect(store.getFileStatusColor('D')).toBe('#e06c75');
      expect(store.getFileStatusColor('unknown')).toBe('#abb2bf');
    });

    it('应返回正确的状态标签', () => {
      const store = useGitStore.getState();
      expect(store.getFileStatusLabel('M')).toBe('已修改');
      expect(store.getFileStatusLabel('A')).toBe('已添加');
      expect(store.getFileStatusLabel('unknown')).toBe('unknown');
    });
  });

  describe('getFileStatus', () => {
    it('应返回文件状态', () => {
      useGitStore.setState({
        fileStatusMap: new Map([['file.ts', 'M']]),
      });
      expect(useGitStore.getState().getFileStatus('file.ts')).toBe('M');
      expect(useGitStore.getState().getFileStatus('other.ts')).toBeNull();
    });
  });
});
