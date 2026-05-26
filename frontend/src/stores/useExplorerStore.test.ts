import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useExplorerStore } from './useExplorerStore';

const mockGetFileTree = vi.fn();
const mockCreateFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockRenameFile = vi.fn();

vi.mock('../../wailsjs/go/fs/FileService', () => ({
  GetFileTree: (...args: unknown[]) => mockGetFileTree(...args),
  CreateFile: (...args: unknown[]) => mockCreateFile(...args),
  DeleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  RenameFile: (...args: unknown[]) => mockRenameFile(...args),
}));

describe('useExplorerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExplorerStore.setState({
      treeData: [],
      expandedPaths: new Set(),
      selectedPath: null,
      isLoading: false,
      isVisible: true,
      rootPath: '/project',
      projectName: 'ai-ide',
    });
  });

  it('应有正确的初始状态', () => {
    const state = useExplorerStore.getState();
    expect(state.treeData).toEqual([]);
    expect(state.expandedPaths).toBeInstanceOf(Set);
    expect(state.selectedPath).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isVisible).toBe(true);
    expect(state.rootPath).toBe('/project');
  });

  describe('loadTree', () => {
    it('应加载文件树', async () => {
      const mockTree = {
        name: 'project',
        path: '/project',
        isDir: true,
        children: [
          { name: 'src', path: '/project/src', isDir: true, children: [] },
          { name: 'package.json', path: '/project/package.json', isDir: false },
        ],
      };
      mockGetFileTree.mockResolvedValue(mockTree);

      await useExplorerStore.getState().loadTree('/project');

      const state = useExplorerStore.getState();
      expect(state.treeData).toHaveLength(2);
      expect(state.projectName).toBe('project');
      expect(state.isLoading).toBe(false);
    });

    it('无路径时应清空树', async () => {
      useExplorerStore.setState({ rootPath: '' });

      await useExplorerStore.getState().loadTree();

      expect(useExplorerStore.getState().treeData).toEqual([]);
    });

    it('加载失败时不应崩溃', async () => {
      mockGetFileTree.mockRejectedValue(new Error('读取失败'));

      await useExplorerStore.getState().loadTree('/project');

      expect(useExplorerStore.getState().isLoading).toBe(false);
    });

    it('无子节点时应返回空数组', async () => {
      mockGetFileTree.mockResolvedValue({
        name: 'project',
        path: '/project',
        isDir: true,
      });

      await useExplorerStore.getState().loadTree('/project');

      expect(useExplorerStore.getState().treeData).toEqual([]);
    });
  });

  describe('expandNode / collapseNode / toggleNode', () => {
    it('expandNode 应添加路径到展开集合', () => {
      useExplorerStore.getState().expandNode('/project/src');

      expect(useExplorerStore.getState().expandedPaths.has('/project/src')).toBe(true);
    });

    it('collapseNode 应从展开集合移除路径', () => {
      useExplorerStore.getState().expandNode('/project/src');
      useExplorerStore.getState().collapseNode('/project/src');

      expect(useExplorerStore.getState().expandedPaths.has('/project/src')).toBe(false);
    });

    it('toggleNode 应切换展开状态', () => {
      const store = useExplorerStore.getState();

      store.toggleNode('/project/src');
      expect(useExplorerStore.getState().expandedPaths.has('/project/src')).toBe(true);

      store.toggleNode('/project/src');
      expect(useExplorerStore.getState().expandedPaths.has('/project/src')).toBe(false);
    });
  });

  describe('selectNode', () => {
    it('应设置选中路径', () => {
      useExplorerStore.getState().selectNode('/project/src/App.tsx');

      expect(useExplorerStore.getState().selectedPath).toBe('/project/src/App.tsx');
    });
  });

  describe('toggleVisibility / setVisible', () => {
    it('toggleVisibility 应切换可见性', () => {
      const store = useExplorerStore.getState();

      store.toggleVisibility();
      expect(useExplorerStore.getState().isVisible).toBe(false);

      store.toggleVisibility();
      expect(useExplorerStore.getState().isVisible).toBe(true);
    });

    it('setVisible 应直接设置可见性', () => {
      useExplorerStore.getState().setVisible(false);
      expect(useExplorerStore.getState().isVisible).toBe(false);

      useExplorerStore.getState().setVisible(true);
      expect(useExplorerStore.getState().isVisible).toBe(true);
    });
  });

  describe('refresh', () => {
    it('应重新加载当前路径的树', async () => {
      const mockTree = {
        name: 'project',
        path: '/project',
        isDir: true,
        children: [{ name: 'updated', path: '/project/updated', isDir: false }],
      };
      mockGetFileTree.mockResolvedValue(mockTree);

      await useExplorerStore.getState().refresh();

      expect(mockGetFileTree).toHaveBeenCalledWith('/project');
      expect(useExplorerStore.getState().treeData).toHaveLength(1);
    });
  });

  describe('performOperation', () => {
    beforeEach(() => {
      const mockTree = {
        name: 'project',
        path: '/project',
        isDir: true,
        children: [],
      };
      mockGetFileTree.mockResolvedValue(mockTree);
    });

    it('newFile 应创建文件并刷新', async () => {
      mockCreateFile.mockResolvedValue(undefined);

      await useExplorerStore.getState().performOperation('newFile', '/project/new.ts');

      expect(mockCreateFile).toHaveBeenCalledWith('/project/new.ts', false);
      expect(mockGetFileTree).toHaveBeenCalled();
    });

    it('newFolder 应创建文件夹并刷新', async () => {
      mockCreateFile.mockResolvedValue(undefined);

      await useExplorerStore.getState().performOperation('newFolder', '/project/new-folder');

      expect(mockCreateFile).toHaveBeenCalledWith('/project/new-folder', true);
    });

    it('rename 应重命名文件并刷新', async () => {
      mockRenameFile.mockResolvedValue(undefined);

      await useExplorerStore.getState().performOperation('rename', '/project/old.ts', 'new.ts');

      expect(mockRenameFile).toHaveBeenCalledWith('/project/old.ts', 'new.ts');
    });

    it('rename 无新名称时不应调用', async () => {
      mockRenameFile.mockResolvedValue(undefined);

      await useExplorerStore.getState().performOperation('rename', '/project/old.ts');

      expect(mockRenameFile).not.toHaveBeenCalled();
    });

    it('delete 应删除文件并刷新', async () => {
      mockDeleteFile.mockResolvedValue(undefined);

      await useExplorerStore.getState().performOperation('delete', '/project/old.ts');

      expect(mockDeleteFile).toHaveBeenCalledWith('/project/old.ts');
    });

    it('操作失败时应抛出错误', async () => {
      mockCreateFile.mockRejectedValue(new Error('权限不足'));

      await expect(
        useExplorerStore.getState().performOperation('newFile', '/project/new.ts')
      ).rejects.toThrow('权限不足');
    });
  });
});
