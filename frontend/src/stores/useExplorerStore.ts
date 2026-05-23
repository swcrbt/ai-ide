import { create } from 'zustand';

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
 * 生成模拟文件树数据
 */
function generateMockTree(): FileNode[] {
  return [
    {
      name: 'src',
      path: '/project/src',
      isDir: true,
      modTime: '2026-05-23T10:00:00Z',
      size: 0,
      gitStatus: null,
      children: [
        {
          name: 'components',
          path: '/project/src/components',
          isDir: true,
          modTime: '2026-05-23T10:00:00Z',
          size: 0,
          gitStatus: null,
          children: [
            {
              name: 'Editor',
              path: '/project/src/components/Editor',
              isDir: true,
              modTime: '2026-05-23T10:00:00Z',
              size: 0,
              gitStatus: null,
              children: [
                {
                  name: 'Editor.tsx',
                  path: '/project/src/components/Editor/Editor.tsx',
                  isDir: false,
                  modTime: '2026-05-23T10:30:00Z',
                  size: 3456,
                  gitStatus: 'modified',
                },
              ],
            },
            {
              name: 'Explorer',
              path: '/project/src/components/Explorer',
              isDir: true,
              modTime: '2026-05-23T11:00:00Z',
              size: 0,
              gitStatus: 'added',
              children: [
                {
                  name: 'FileTree.tsx',
                  path: '/project/src/components/Explorer/FileTree.tsx',
                  isDir: false,
                  modTime: '2026-05-23T11:00:00Z',
                  size: 2345,
                  gitStatus: 'added',
                },
                {
                  name: 'FileTreeNode.tsx',
                  path: '/project/src/components/Explorer/FileTreeNode.tsx',
                  isDir: false,
                  modTime: '2026-05-23T11:00:00Z',
                  size: 1876,
                  gitStatus: 'added',
                },
                {
                  name: 'ContextMenu.tsx',
                  path: '/project/src/components/Explorer/ContextMenu.tsx',
                  isDir: false,
                  modTime: '2026-05-23T11:00:00Z',
                  size: 1234,
                  gitStatus: 'added',
                },
              ],
            },
            {
              name: 'Button.tsx',
              path: '/project/src/components/Button.tsx',
              isDir: false,
              modTime: '2026-05-20T09:00:00Z',
              size: 890,
              gitStatus: null,
            },
          ],
        },
        {
          name: 'stores',
          path: '/project/src/stores',
          isDir: true,
          modTime: '2026-05-23T10:00:00Z',
          size: 0,
          gitStatus: null,
          children: [
            {
              name: 'useThemeStore.ts',
              path: '/project/src/stores/useThemeStore.ts',
              isDir: false,
              modTime: '2026-05-22T14:00:00Z',
              size: 1234,
              gitStatus: null,
            },
            {
              name: 'useAppStore.ts',
              path: '/project/src/stores/useAppStore.ts',
              isDir: false,
              modTime: '2026-05-22T14:00:00Z',
              size: 1567,
              gitStatus: null,
            },
            {
              name: 'useExplorerStore.ts',
              path: '/project/src/stores/useExplorerStore.ts',
              isDir: false,
              modTime: '2026-05-23T11:30:00Z',
              size: 4567,
              gitStatus: 'added',
            },
          ],
        },
        {
          name: 'App.tsx',
          path: '/project/src/App.tsx',
          isDir: false,
          modTime: '2026-05-23T12:00:00Z',
          size: 2345,
          gitStatus: 'modified',
        },
        {
          name: 'main.tsx',
          path: '/project/src/main.tsx',
          isDir: false,
          modTime: '2026-05-20T09:00:00Z',
          size: 345,
          gitStatus: null,
        },
      ],
    },
    {
      name: 'internal',
      path: '/project/internal',
      isDir: true,
      modTime: '2026-05-20T09:00:00Z',
      size: 0,
      gitStatus: null,
      children: [
        {
          name: 'fs',
          path: '/project/internal/fs',
          isDir: true,
          modTime: '2026-05-23T09:00:00Z',
          size: 0,
          gitStatus: null,
          children: [
            {
              name: 'types.go',
              path: '/project/internal/fs/types.go',
              isDir: false,
              modTime: '2026-05-23T09:00:00Z',
              size: 1234,
              gitStatus: null,
            },
            {
              name: 'service.go',
              path: '/project/internal/fs/service.go',
              isDir: false,
              modTime: '2026-05-23T09:00:00Z',
              size: 5678,
              gitStatus: null,
            },
            {
              name: 'watcher.go',
              path: '/project/internal/fs/watcher.go',
              isDir: false,
              modTime: '2026-05-23T09:00:00Z',
              size: 3456,
              gitStatus: null,
            },
          ],
        },
      ],
    },
    {
      name: 'package.json',
      path: '/project/package.json',
      isDir: false,
      modTime: '2026-05-20T09:00:00Z',
      size: 890,
      gitStatus: null,
    },
    {
      name: 'README.md',
      path: '/project/README.md',
      isDir: false,
      modTime: '2026-05-20T09:00:00Z',
      size: 1234,
      gitStatus: 'deleted',
    },
    {
      name: '.gitignore',
      path: '/project/.gitignore',
      isDir: false,
      modTime: '2026-05-20T09:00:00Z',
      size: 234,
      gitStatus: 'untracked',
    },
  ];
}

/**
 * 文件浏览器状态管理 Store
 *
 * 管理文件树数据、展开/折叠状态、选中状态、可见性等。
 * 当前使用模拟数据，后续接入真实后端 API。
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
      // TODO: 后续接入真实后端调用
      // const data = await GetFileTree(rootPath || get().rootPath);
      // 当前使用模拟数据
      const mockData = generateMockTree();
      set({
        treeData: mockData,
        rootPath: rootPath || get().rootPath,
        projectName: rootPath ? rootPath.split('/').pop() || 'project' : get().projectName,
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

  /** 执行文件操作（当前为模拟实现） */
  performOperation: async (operation: FileOperation, targetPath: string, newName?: string) => {
    console.log(`执行文件操作: ${operation}`, { targetPath, newName });
    // TODO: 后续接入真实后端调用
    // 模拟操作成功后刷新文件树
    await get().refresh();
  },
}));
