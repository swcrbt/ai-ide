import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore } from './useProjectStore';
import {
  ListProjects,
  AddProject,
  InitGitAndSave,
  RemoveProject,
  SetCurrentProject,
} from '../types/wails';
import { useExplorerStore } from './useExplorerStore';
import { useGitStore } from './useGitStore';

// Mock Wails 绑定
vi.mock('../types/wails', () => ({
  ListProjects: vi.fn(),
  AddProject: vi.fn(),
  InitGitAndSave: vi.fn(),
  RemoveProject: vi.fn(),
  SetCurrentProject: vi.fn(),
}));

const mockLoadTree = vi.fn();
const mockLoadStatus = vi.fn();
const mockLoadSummary = vi.fn();

vi.mock('./useExplorerStore', () => ({
  useExplorerStore: {
    getState: vi.fn(() => ({
      loadTree: mockLoadTree,
    })),
    setState: vi.fn(),
  },
}));

vi.mock('./useGitStore', () => ({
  useGitStore: {
    getState: vi.fn(() => ({
      loadStatus: mockLoadStatus,
      loadSummary: mockLoadSummary,
    })),
  },
}));

describe('useProjectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({
      projects: [],
      currentProject: null,
      isLoading: false,
      isAddDialogOpen: false,
    });
  });

  it('should initialize with empty state', () => {
    const state = useProjectStore.getState();
    expect(state.projects).toEqual([]);
    expect(state.currentProject).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isAddDialogOpen).toBe(false);
  });

  it('should set add dialog open state', () => {
    useProjectStore.getState().setAddDialogOpen(true);
    expect(useProjectStore.getState().isAddDialogOpen).toBe(true);
  });

  describe('loadProjects', () => {
    it('should call ListProjects and update state', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', path: '/path/1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        { id: 2, name: 'Project 2', path: '/path/2', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
      ];
      vi.mocked(ListProjects).mockResolvedValue(mockProjects);

      await useProjectStore.getState().loadProjects();

      expect(ListProjects).toHaveBeenCalledTimes(1);
      expect(useProjectStore.getState().projects).toEqual(mockProjects);
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('should handle error and set empty projects', async () => {
      vi.mocked(ListProjects).mockRejectedValue(new Error('Failed to load'));

      await useProjectStore.getState().loadProjects();

      expect(useProjectStore.getState().projects).toEqual([]);
      expect(useProjectStore.getState().isLoading).toBe(false);
    });
  });

  describe('addProject', () => {
    it('should call AddProject and auto switch if project is not null', async () => {
      const mockProject = { id: 1, name: 'Project 1', path: '/path/1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      vi.mocked(AddProject).mockResolvedValue([mockProject, false] as any);
      vi.mocked(ListProjects).mockResolvedValue([mockProject]);
      vi.mocked(SetCurrentProject).mockResolvedValue(undefined);

      const result = await useProjectStore.getState().addProject('/path/1');

      expect(AddProject).toHaveBeenCalledWith('/path/1');
      expect(result.project).toEqual(mockProject);
      expect(result.needsInit).toBe(false);
      expect(ListProjects).toHaveBeenCalled();
      expect(SetCurrentProject).toHaveBeenCalledWith('/path/1');
    });

    it('should return null project without switching if project is null', async () => {
      vi.mocked(AddProject).mockResolvedValue([null, true] as any);

      const result = await useProjectStore.getState().addProject('/path/1');

      expect(AddProject).toHaveBeenCalledWith('/path/1');
      expect(result.project).toBeNull();
      expect(result.needsInit).toBe(true);
      expect(ListProjects).not.toHaveBeenCalled();
    });
  });

  describe('initGitAndAdd', () => {
    it('should call InitGitAndSave and auto switch', async () => {
      const mockProject = { id: 1, name: 'Project 1', path: '/path/1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      vi.mocked(InitGitAndSave).mockResolvedValue(mockProject);
      vi.mocked(ListProjects).mockResolvedValue([mockProject]);
      vi.mocked(SetCurrentProject).mockResolvedValue(undefined);

      const result = await useProjectStore.getState().initGitAndAdd('/path/1');

      expect(InitGitAndSave).toHaveBeenCalledWith('/path/1');
      expect(result).toEqual(mockProject);
      expect(ListProjects).toHaveBeenCalled();
      expect(SetCurrentProject).toHaveBeenCalledWith('/path/1');
    });
  });

  describe('removeProject', () => {
    it('should call RemoveProject and clear current if deleting current project', async () => {
      const mockProject = { id: 1, name: 'Project 1', path: '/path/1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      useProjectStore.setState({
        currentProject: mockProject,
        projects: [mockProject],
      });
      vi.mocked(RemoveProject).mockResolvedValue(undefined);
      vi.mocked(ListProjects).mockResolvedValue([]);

      await useProjectStore.getState().removeProject(1);

      expect(RemoveProject).toHaveBeenCalledWith(1);
      expect(useProjectStore.getState().currentProject).toBeNull();
      expect(useExplorerStore.setState).toHaveBeenCalledWith({
        treeData: [],
        rootPath: '',
        projectName: '',
      });
      expect(ListProjects).toHaveBeenCalled();
    });

    it('should call RemoveProject without clearing current if deleting other project', async () => {
      const mockProject1 = { id: 1, name: 'Project 1', path: '/path/1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      const mockProject2 = { id: 2, name: 'Project 2', path: '/path/2', createdAt: '2024-01-02', updatedAt: '2024-01-02' };
      useProjectStore.setState({
        currentProject: mockProject1,
        projects: [mockProject1, mockProject2],
      });
      vi.mocked(RemoveProject).mockResolvedValue(undefined);
      vi.mocked(ListProjects).mockResolvedValue([mockProject1]);

      await useProjectStore.getState().removeProject(2);

      expect(RemoveProject).toHaveBeenCalledWith(2);
      expect(useProjectStore.getState().currentProject).toEqual(mockProject1);
      expect(useExplorerStore.setState).not.toHaveBeenCalled();
      expect(ListProjects).toHaveBeenCalled();
    });
  });

  describe('switchProject', () => {
    it('should set current project, call SetCurrentProject, load tree and git status', async () => {
      const mockProject = { id: 1, name: 'Project 1', path: '/path/1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      useProjectStore.setState({
        projects: [mockProject],
      });
      vi.mocked(SetCurrentProject).mockResolvedValue(undefined);

      await useProjectStore.getState().switchProject(1);

      expect(useProjectStore.getState().currentProject).toEqual(mockProject);
      expect(SetCurrentProject).toHaveBeenCalledWith('/path/1');
      expect(mockLoadTree).toHaveBeenCalledWith('/path/1');
      expect(mockLoadStatus).toHaveBeenCalledWith('/path/1');
      expect(mockLoadSummary).toHaveBeenCalledWith('/path/1');
    });

    it('should throw error if project not found', async () => {
      await expect(useProjectStore.getState().switchProject(999)).rejects.toThrow('项目不存在');
    });
  });
});
