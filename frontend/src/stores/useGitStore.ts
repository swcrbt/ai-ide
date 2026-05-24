import { create } from 'zustand';
import {
  Status,
  Diff,
  DiffAll,
  Stage,
  Unstage,
  Commit,
  Push,
  Pull,
  Branch,
  Branches,
  Checkout,
  Log,
  Summary,
  GetRoot,
  IsGitRepo,
  SetRepoPath,
  GetRepoPath,
} from '../types/wails';
import type {
  GitStatus,
  GitDiff,
  GitBranch,
  GitCommit,
  GitSummary,
  GitFileStatus,
} from '../types/wails';

// 文件状态对应的颜色映射
const statusColorMap: Record<string, string> = {
  M: '#e5c07b',
  A: '#98c379',
  D: '#e06c75',
  R: '#61afef',
  '?': '#abb2bf',
  U: '#d19a66',
};

// 文件状态对应的标签
const statusLabelMap: Record<string, string> = {
  M: '已修改',
  A: '已添加',
  D: '已删除',
  R: '已重命名',
  '?': '未追踪',
  U: '冲突',
};

interface GitState {
  // Git 状态
  status: GitStatus | null;
  summary: GitSummary | null;
  branches: GitBranch[];
  commits: GitCommit[];
  diffContent: string;
  selectedFile: string | null;
  isGitRepo: boolean;
  repoPath: string;
  currentBranch: string;

  // 加载状态
  isLoading: boolean;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;

  // 提交信息
  commitMessage: string;

  // 文件状态映射（用于文件树显示）
  fileStatusMap: Map<string, string>; // path -> status letter (M, A, D, ?, etc.)

  // 操作方法
  loadStatus: (path?: string) => Promise<void>;
  loadSummary: (path?: string) => Promise<void>;
  loadBranches: () => Promise<void>;
  loadCommits: () => Promise<void>;
  loadDiff: (path: string, staged?: boolean) => Promise<void>;
  loadDiffAll: (staged?: boolean) => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  commit: () => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  checkoutBranch: (branch: string) => Promise<void>;
  setRepoPath: (path: string) => Promise<void>;
  checkIsGitRepo: (path: string) => Promise<boolean>;
  setCommitMessage: (message: string) => void;
  setSelectedFile: (path: string | null) => void;
  getFileStatusColor: (status: string) => string;
  getFileStatusLabel: (status: string) => string;

  // 获取文件状态
  getFileStatus: (path: string) => string | null;
}

export const useGitStore = create<GitState>()((set, get) => ({
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

  // 加载 Git 状态
  loadStatus: async (path) => {
    set({ isLoading: true });
    try {
      const repoPath = path || get().repoPath;
      if (!repoPath) return;

      const status = await Status(repoPath);

      // 构建文件状态映射
      const fileStatusMap = new Map<string, string>();

      // 添加各类文件状态
      status.modified?.forEach((f: GitFileStatus) => fileStatusMap.set(f.path, 'M'));
      status.added?.forEach((f: GitFileStatus) => fileStatusMap.set(f.path, 'A'));
      status.deleted?.forEach((f: GitFileStatus) => fileStatusMap.set(f.path, 'D'));
      status.untracked?.forEach((f: GitFileStatus) => fileStatusMap.set(f.path, '?'));
      status.renamed?.forEach((f: GitFileStatus) => fileStatusMap.set(f.path, 'R'));
      status.conflicted?.forEach((f: GitFileStatus) => fileStatusMap.set(f.path, 'U'));

      set({
        status,
        currentBranch: status.branch || '',
        isGitRepo: true,
        fileStatusMap,
      });
    } catch (err) {
      console.error('加载 Git 状态失败:', err);
      set({ status: null, isGitRepo: false, fileStatusMap: new Map() });
    } finally {
      set({ isLoading: false });
    }
  },

  // 加载 Git 概要（用于左侧卡片）
  loadSummary: async (path) => {
    try {
      const repoPath = path || get().repoPath;
      if (!repoPath) return;

      const summary = await Summary(repoPath);
      set({ summary });
    } catch (err) {
      console.error('加载 Git 概要失败:', err);
      set({ summary: null });
    }
  },

  // 加载分支列表
  loadBranches: async () => {
    try {
      const branches = await Branches();
      set({ branches });
    } catch (err) {
      console.error('加载分支列表失败:', err);
      set({ branches: [] });
    }
  },

  // 加载提交历史
  loadCommits: async () => {
    try {
      const commits = await Log(20);
      set({ commits });
    } catch (err) {
      console.error('加载提交历史失败:', err);
      set({ commits: [] });
    }
  },

  // 加载单个文件的 Diff
  loadDiff: async (path, staged = false) => {
    try {
      const diff = await Diff(path, staged);
      set({ diffContent: diff.content || '', selectedFile: path });
    } catch (err) {
      console.error('加载 Diff 失败:', err);
      set({ diffContent: '' });
    }
  },

  // 加载所有变更的 Diff
  loadDiffAll: async (staged = false) => {
    try {
      const content = await DiffAll(staged);
      set({ diffContent: content || '' });
    } catch (err) {
      console.error('加载 Diff 失败:', err);
      set({ diffContent: '' });
    }
  },

  // 暂存文件
  stageFiles: async (paths) => {
    try {
      await Stage(paths);
      await get().loadStatus();
      await get().loadSummary();
    } catch (err) {
      console.error('暂存文件失败:', err);
    }
  },

  // 取消暂存文件
  unstageFiles: async (paths) => {
    try {
      await Unstage(paths);
      await get().loadStatus();
      await get().loadSummary();
    } catch (err) {
      console.error('取消暂存失败:', err);
    }
  },

  // 提交
  commit: async () => {
    const { commitMessage } = get();
    if (!commitMessage.trim()) return;

    set({ isCommitting: true });
    try {
      await Commit(commitMessage);
      set({ commitMessage: '' });
      await get().loadStatus();
      await get().loadSummary();
      await get().loadCommits();
    } catch (err) {
      console.error('提交失败:', err);
    } finally {
      set({ isCommitting: false });
    }
  },

  // 推送
  push: async () => {
    set({ isPushing: true });
    try {
      await Push();
      await get().loadStatus();
      await get().loadSummary();
    } catch (err) {
      console.error('推送失败:', err);
    } finally {
      set({ isPushing: false });
    }
  },

  // 拉取
  pull: async () => {
    set({ isPulling: true });
    try {
      await Pull();
      await get().loadStatus();
      await get().loadSummary();
    } catch (err) {
      console.error('拉取失败:', err);
    } finally {
      set({ isPulling: false });
    }
  },

  // 切换分支
  checkoutBranch: async (branch) => {
    try {
      await Checkout(branch);
      await get().loadStatus();
      await get().loadBranches();
      await get().loadCommits();
    } catch (err) {
      console.error('切换分支失败:', err);
    }
  },

  // 设置仓库路径
  setRepoPath: async (path) => {
    try {
      await SetRepoPath(path);
      const root = await GetRoot(path);
      set({ repoPath: root });
      await get().loadStatus(root);
      await get().loadSummary(root);
      await get().loadBranches();
      await get().loadCommits();
    } catch (err) {
      console.error('设置仓库路径失败:', err);
      set({ repoPath: path });
    }
  },

  // 检查是否为 Git 仓库
  checkIsGitRepo: async (path) => {
    try {
      const isRepo = await IsGitRepo(path);
      set({ isGitRepo: isRepo });
      return isRepo;
    } catch (err) {
      console.error('检查 Git 仓库失败:', err);
      set({ isGitRepo: false });
      return false;
    }
  },

  // 设置提交信息
  setCommitMessage: (message) => set({ commitMessage: message }),

  // 设置选中的文件
  setSelectedFile: (path) => set({ selectedFile: path }),

  // 获取文件状态颜色
  getFileStatusColor: (status) => statusColorMap[status] || '#abb2bf',

  // 获取文件状态标签
  getFileStatusLabel: (status) => statusLabelMap[status] || status,

  // 获取文件状态
  getFileStatus: (path: string) => {
    return get().fileStatusMap.get(path) || null;
  },
}));
