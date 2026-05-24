import { create } from 'zustand';
import {
  GetFileTree,
  CreateFile,
  DeleteFile,
  RenameFile,
} from '../../wailsjs/go/fs/FileService';

/**
 * Git 文件状态类型
 */
export type GitStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'ignored' | null;

/**
 * 文件树节点类型（对应后端 FileNode 结构）
 */
export interface FileNode {
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 是否为目录 */
  isDir: boolean;
  /** 子节点（仅目录有） */
  children?: FileNode[];
  /** 修改时间 */
  modTime: string;
  /** 文件大小（字节） */
  size: number;
  /** Git 状态 */
  gitStatus?: GitStatus;
}

/**
 * 文件操作类型
 */
export type FileOperation = 'newFile' | 'newFolder' | 'rename' | 'delete';

/**
 * 文件浏览器状态接口
 */
interface ExplorerState {
  /** 文件树数据 */
  treeData: FileNode[];
  /** 已展开的节点路径集合 */
  expandedPaths: Set<string>;
  /** 当前选中的节点路径 */
  selectedPath: string | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 文件浏览器是否可见 */
  isVisible: boolean;
  /** 当前项目根路径 */
  rootPath: string;
  /** 当前项目名 */
  projectName: string;

  // 操作方法
  /** 加载文件树 */
  loadTree: (rootPath?: string) => Promise<void>;
  /** 展开节点 */
  expandNode: (path: string) => void;
  /** 折叠节点 */
  collapseNode: (path: string) => void;
  /** 切换展开/折叠 */
  toggleNode: (path: string) => void;
  /** 选中节点 */
  selectNode: (path: string) => void;
  /** 切换可见性 */
  toggleVisibility: () => void;
  /** 设置可见性 */
  setVisible: (visible: boolean) => void;
  /** 刷新文件树 */
  refresh: () => Promise<void>;
  /** 执行文件操作 */
  performOperation: (operation: FileOperation, targetPath: string, newName?: string) => Promise<void>;
}

/**
 * 文件浏览器状态管理 Store
 *
 * 管理文件树数据、展开/折叠状态、选中状态、可见性等。
 * 通过 Wails 后端 API 读取真实文件系统。
 */
export const useExplorerStore = create<ExplorerState>()((set, get) => ({
  treeData: [],
  expandedPaths: new Set<string>(),
  selectedPath: null,
  isLoading: false,
  isVisible: true,
  rootPath: '/project',
  projectName: 'ai-ide',

  /** 加载文件树 */
  loadTree: async (rootPath?: string) => {
    set({ isLoading: true });
    try {
      const targetPath = rootPath || get().rootPath;
      if (!targetPath) {
        set({ treeData: [], isLoading: false });
        return;
      }
      const data = await GetFileTree(targetPath);
      set({
        treeData: data.children || [],
        rootPath: targetPath,
        projectName: data.name || targetPath.split('/').pop() || targetPath,
        isLoading: false,
      });
    } catch (err) {
      console.error('加载文件树失败:', err);
      set({ isLoading: false });
    }
  },

  /** 展开节点 */
  expandNode: (path: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPaths);
      newExpanded.add(path);
      return { expandedPaths: newExpanded };
    });
  },

  /** 折叠节点 */
  collapseNode: (path: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPaths);
      newExpanded.delete(path);
      return { expandedPaths: newExpanded };
    });
  },

  /** 切换展开/折叠状态 */
  toggleNode: (path: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedPaths: newExpanded };
    });
  },

  /** 选中节点 */
  selectNode: (path: string) => {
    set({ selectedPath: path });
  },

  /** 切换文件浏览器可见性 */
  toggleVisibility: () => {
    set((state) => ({ isVisible: !state.isVisible }));
  },

  /** 设置可见性 */
  setVisible: (visible: boolean) => {
    set({ isVisible: visible });
  },

  /** 刷新文件树 */
  refresh: async () => {
    const { loadTree, rootPath } = get();
    await loadTree(rootPath);
  },

  /** 执行文件操作 */
  performOperation: async (operation: FileOperation, targetPath: string, newName?: string) => {
    try {
      switch (operation) {
        case 'newFile':
          await CreateFile(targetPath, false);
          break;
        case 'newFolder':
          await CreateFile(targetPath, true);
          break;
        case 'rename':
          if (newName) {
            await RenameFile(targetPath, newName);
          }
          break;
        case 'delete':
          await DeleteFile(targetPath);
          break;
      }
      await get().refresh();
    } catch (err) {
      console.error(`文件操作失败 (${operation}):`, err);
      throw err;
    }
  },
}));
