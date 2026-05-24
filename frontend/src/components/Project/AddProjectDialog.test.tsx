import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddProjectDialog } from './AddProjectDialog';

// Mock useProjectStore
const mockSetAddDialogOpen = vi.fn();
const mockAddProject = vi.fn();
const mockInitGitAndAdd = vi.fn();

vi.mock('../../stores/useProjectStore', () => ({
  useProjectStore: () => ({
    isAddDialogOpen: true,
    setAddDialogOpen: mockSetAddDialogOpen,
    addProject: mockAddProject,
    initGitAndAdd: mockInitGitAndAdd,
  }),
}));

// Mock Wails 运行时
const mockOpenDirectoryDialog = vi.fn();
Object.defineProperty(window, 'go', {
  writable: true,
  value: {
    main: {
      App: {
        OpenDirectoryDialog: mockOpenDirectoryDialog,
      },
    },
  },
});

describe('AddProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenDirectoryDialog.mockReset();
  });

  it('should render dialog when open', () => {
    render(<AddProjectDialog />);
    expect(screen.getByRole('heading', { name: '添加项目' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('点击右侧按钮选择目录')).toBeInTheDocument();
  });

  it('should have disabled add button when no path selected', () => {
    render(<AddProjectDialog />);
    // 使用 role 和 name 精确定位按钮
    const addButton = screen.getByRole('button', { name: '添加项目' });
    expect(addButton).toBeDisabled();
  });

  it('should open directory dialog when folder button clicked', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      expect(mockOpenDirectoryDialog).toHaveBeenCalledWith({
        Title: '选择项目目录',
        CanCreateDirectories: false,
      });
    });
  });

  it('should enable add button when path is selected', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
  });

  it('should call addProject when add button clicked', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockResolvedValue({ project: { id: 1, name: 'Test', path: '/test/project' }, needsInit: false });
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(mockAddProject).toHaveBeenCalledWith('/test/project');
    });
  });

  it('should show init confirm when project needs git init', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockResolvedValue({ project: null, needsInit: true });
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('该项目未初始化 Git 仓库。')).toBeInTheDocument();
      expect(screen.getByText('是否自动初始化 Git？')).toBeInTheDocument();
    });
  });

  it('should call initGitAndAdd when confirm init clicked', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockResolvedValue({ project: null, needsInit: true });
    mockInitGitAndAdd.mockResolvedValue({ id: 1, name: 'Test', path: '/test/project' });
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('确认初始化')).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByText('确认初始化');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockInitGitAndAdd).toHaveBeenCalledWith('/test/project');
    });
  });

  it('should close dialog when cancel clicked', () => {
    render(<AddProjectDialog />);
    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);
    expect(mockSetAddDialogOpen).toHaveBeenCalledWith(false);
  });

  it('should close dialog when X button clicked', () => {
    render(<AddProjectDialog />);
    const closeButton = screen.getByRole('button', { name: '关闭' });
    fireEvent.click(closeButton);
    expect(mockSetAddDialogOpen).toHaveBeenCalledWith(false);
  });

  it('should show error when addProject fails', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockRejectedValue(new Error('添加失败'));
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('添加失败')).toBeInTheDocument();
    });
  });

  it('should show loading state during add project', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockImplementation(() => new Promise(() => {})); // 永远不 resolve
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('添加中...')).toBeInTheDocument();
    });
  });

  it('should show loading state during git init', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockResolvedValue({ project: null, needsInit: true });
    mockInitGitAndAdd.mockImplementation(() => new Promise(() => {})); // 永远不 resolve
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('确认初始化')).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByText('确认初始化');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(screen.getByText('初始化中...')).toBeInTheDocument();
    });
  });

  it('should hide init confirm when cancel clicked', async () => {
    mockOpenDirectoryDialog.mockResolvedValue('/test/project');
    mockAddProject.mockResolvedValue({ project: null, needsInit: true });
    
    render(<AddProjectDialog />);
    
    const folderButton = screen.getByRole('button', { name: '选择目录' });
    fireEvent.click(folderButton);
    
    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: '添加项目' });
      expect(addButton).not.toBeDisabled();
    });
    
    const addButton = screen.getByRole('button', { name: '添加项目' });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('确认初始化')).toBeInTheDocument();
    });
    
    const cancelInitButton = screen.getByRole('button', { name: '确认初始化' }).parentElement?.querySelector('button:first-child');
    expect(cancelInitButton).not.toBeNull();
    if (cancelInitButton) {
      fireEvent.click(cancelInitButton);
    }
    
    await waitFor(() => {
      expect(screen.queryByText('确认初始化')).not.toBeInTheDocument();
    });
  });
});
