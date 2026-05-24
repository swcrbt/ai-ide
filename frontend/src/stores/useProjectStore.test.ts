import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore } from './useProjectStore';

// Mock Wails 绑定
vi.mock('../types/wails', () => ({
  ListProjects: vi.fn(),
  AddProject: vi.fn(),
  InitGitAndSave: vi.fn(),
  RemoveProject: vi.fn(),
  SetCurrentProject: vi.fn(),
}));

vi.mock('./useExplorerStore', () => ({
  useExplorerStore: {
    getState: vi.fn(() => ({
      loadTree: vi.fn(),
    })),
    setState: vi.fn(),
  },
}));

vi.mock('./useGitStore', () => ({
  useGitStore: {
    getState: vi.fn(() => ({
      loadStatus: vi.fn(),
      loadSummary: vi.fn(),
    })),
  },
}));

describe('useProjectStore', () => {
  beforeEach(() => {
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
});
