# 项目管理系统实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 AI IDE 文件资源管理器增加项目管理功能，支持添加项目、自动检测 Git 状态、强制初始化未初始化的仓库，并在文件树中显示 Git 状态。

**架构：** 后端创建独立的 `ProjectService` 管理项目 CRUD 和 Git 初始化协调，前端创建 `useProjectStore` 和 `AddProjectDialog` 组件，通过 Wails 桥接通信。项目数据持久化到已有的 SQLite `projects` 表。

**技术栈：** Go + Wails + React + TypeScript + SQLite + Zustand

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `internal/project/service.go` | ProjectService：项目 CRUD、Git 检测与初始化协调 |
| `internal/project/service_test.go` | ProjectService 单元测试 |
| `frontend/src/stores/useProjectStore.ts` | 前端项目状态管理（Zustand） |
| `frontend/src/stores/useProjectStore.test.ts` | useProjectStore 单元测试 |
| `frontend/src/components/Project/AddProjectDialog.tsx` | 添加项目对话框组件 |
| `frontend/src/components/Project/AddProjectDialog.test.tsx` | AddProjectDialog 组件测试 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `app.go` | 注册 ProjectService，注入 GitService 依赖 |
| `frontend/src/stores/useGitStore.ts` | 扩展 `fileStatusMap` 和 `loadFileStatus` 方法 |
| `frontend/src/components/Explorer/FileTree.tsx` | 添加 ProjectSelector 下拉框和 "+" 按钮 |
| `frontend/src/components/Explorer/FileTreeNode.tsx` | 从 useGitStore 获取并显示 Git 状态 |
| `frontend/src/types/wails.ts` | 导出 ProjectService 的 Wails 绑定函数 |

---

## 任务 1：ProjectService 后端实现

**文件：**
- 创建：`internal/project/service.go`
- 测试：`internal/project/service_test.go`
- 修改：`app.go`

### 步骤 1：编写 ProjectService 接口和结构体

创建 `internal/project/service.go`：

```go
package project

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/git"
)

// Project 项目信息
type Project struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ProjectService 项目管理服务
type ProjectService struct {
	gitService *git.GitService
}

// NewProjectService 创建 ProjectService 实例
func NewProjectService(gitService *git.GitService) *ProjectService {
	return &ProjectService{
		gitService: gitService,
	}
}

// ListProjects 获取所有项目列表
func (s *ProjectService) ListProjects() ([]Project, error) {
	rows, err := config.DB.Query(
		"SELECT id, name, path, created_at, updated_at FROM projects ORDER BY updated_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("查询项目列表失败: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Path, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}

	return projects, nil
}

// AddProject 添加新项目
// 返回: (project, needsInit, error)
// needsInit 为 true 表示需要初始化 Git
func (s *ProjectService) AddProject(path string) (*Project, bool, error) {
	// 1. 验证路径存在且为目录
	info, err := os.Stat(path)
	if err != nil {
		return nil, false, fmt.Errorf("路径不存在: %s", path)
	}
	if !info.IsDir() {
		return nil, false, fmt.Errorf("路径不是目录: %s", path)
	}

	// 2. 获取绝对路径
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, false, fmt.Errorf("获取绝对路径失败: %w", err)
	}

	// 3. 检查是否已存在
	var existingID int64
	err = config.DB.QueryRow("SELECT id FROM projects WHERE path = ?", absPath).Scan(&existingID)
	if err == nil {
		// 已存在，返回已有项目
		return s.GetProject(existingID)
	}

	// 4. 检查是否为 Git 仓库
	isGitRepo := s.gitService.IsGitRepo(absPath)
	if !isGitRepo {
		return nil, true, nil
	}

	// 5. 是 Git 仓库，保存到数据库
	name := filepath.Base(absPath)
	result, err := config.DB.Exec(
		"INSERT INTO projects (name, path, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
		name, absPath,
	)
	if err != nil {
		return nil, false, fmt.Errorf("保存项目失败: %w", err)
	}

	id, _ := result.LastInsertId()
	return s.GetProject(id)
}

// InitGitAndSave 初始化 Git 并保存项目
func (s *ProjectService) InitGitAndSave(path string) (*Project, error) {
	// 1. 初始化 Git
	if err := s.gitService.Init(path); err != nil {
		return nil, fmt.Errorf("初始化 Git 仓库失败: %w", err)
	}

	// 2. 获取绝对路径
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("获取绝对路径失败: %w", err)
	}

	// 3. 保存到数据库
	name := filepath.Base(absPath)
	result, err := config.DB.Exec(
		"INSERT INTO projects (name, path, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
		name, absPath,
	)
	if err != nil {
		return nil, fmt.Errorf("保存项目失败: %w", err)
	}

	id, _ := result.LastInsertId()
	return s.GetProject(id)
}

// GetProject 获取单个项目
func (s *ProjectService) GetProject(id int64) (*Project, error) {
	var p Project
	err := config.DB.QueryRow(
		"SELECT id, name, path, created_at, updated_at FROM projects WHERE id = ?",
		id,
	).Scan(&p.ID, &p.Name, &p.Path, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("获取项目失败: %w", err)
	}
	return &p, nil
}

// RemoveProject 删除项目
func (s *ProjectService) RemoveProject(id int64) error {
	_, err := config.DB.Exec("DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("删除项目失败: %w", err)
	}
	return nil
}

// SetCurrentProject 设置当前项目（更新 GitService 的 repoPath）
func (s *ProjectService) SetCurrentProject(path string) error {
	// 验证路径存在
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("路径不存在: %w", err)
	}

	// 获取 Git 根目录（如果是 Git 仓库）
	if s.gitService.IsGitRepo(path) {
		root, err := s.gitService.GetRoot(path)
		if err == nil {
			s.gitService.SetRepoPath(root)
			return nil
		}
	}

	// 不是 Git 仓库，直接设置路径
	s.gitService.SetRepoPath(path)
	return nil
}
```

### 步骤 2：编写测试

创建 `internal/project/service_test.go`：

```go
package project

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/git"
)

func TestMain(m *testing.M) {
	// 初始化测试数据库
	if err := config.InitDatabase(); err != nil {
		panic(err)
	}
	defer config.CloseDatabase()

	// 清理测试数据
	config.DB.Exec("DELETE FROM projects")

	os.Exit(m.Run())
}

func TestAddProject_WithGitRepo(t *testing.T) {
	// 创建临时目录并初始化 Git
	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	if err := gitService.Init(tmpDir); err != nil {
		t.Fatalf("初始化 Git 失败: %v", err)
	}

	service := NewProjectService(gitService)

	project, needsInit, err := service.AddProject(tmpDir)
	if err != nil {
		t.Fatalf("添加项目失败: %v", err)
	}
	if needsInit {
		t.Error("已有 Git 仓库的项目不应需要初始化")
	}
	if project == nil {
		t.Fatal("项目不应为空")
	}
	if project.Name != filepath.Base(tmpDir) {
		t.Errorf("项目名称不匹配: got %s, want %s", project.Name, filepath.Base(tmpDir))
	}
}

func TestAddProject_WithoutGitRepo(t *testing.T) {
	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	project, needsInit, err := service.AddProject(tmpDir)
	if err != nil {
		t.Fatalf("添加项目失败: %v", err)
	}
	if !needsInit {
		t.Error("无 Git 仓库的项目应需要初始化")
	}
	if project != nil {
		t.Error("未初始化的项目应返回 nil")
	}
}

func TestInitGitAndSave(t *testing.T) {
	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	project, err := service.InitGitAndSave(tmpDir)
	if err != nil {
		t.Fatalf("初始化并保存项目失败: %v", err)
	}
	if project == nil {
		t.Fatal("项目不应为空")
	}

	// 验证 Git 已初始化
	if !gitService.IsGitRepo(tmpDir) {
		t.Error("Git 应已初始化")
	}
}

func TestAddProject_Duplicate(t *testing.T) {
	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir)

	service := NewProjectService(gitService)

	// 第一次添加
	project1, _, _ := service.AddProject(tmpDir)

	// 第二次添加（重复）
	project2, needsInit, err := service.AddProject(tmpDir)
	if err != nil {
		t.Fatalf("添加重复项目不应报错: %v", err)
	}
	if needsInit {
		t.Error("重复项目不应需要初始化")
	}
	if project2.ID != project1.ID {
		t.Error("重复添加应返回同一项目")
	}
}

func TestAddProject_InvalidPath(t *testing.T) {
	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	_, _, err := service.AddProject("/nonexistent/path")
	if err == nil {
		t.Error("无效路径应返回错误")
	}
}

func TestListProjects(t *testing.T) {
	// 清理
	config.DB.Exec("DELETE FROM projects")

	tmpDir1 := t.TempDir()
	tmpDir2 := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir1)
	gitService.Init(tmpDir2)

	service := NewProjectService(gitService)
	service.AddProject(tmpDir1)
	service.AddProject(tmpDir2)

	projects, err := service.ListProjects()
	if err != nil {
		t.Fatalf("获取项目列表失败: %v", err)
	}
	if len(projects) != 2 {
		t.Errorf("项目数量不匹配: got %d, want 2", len(projects))
	}
}

func TestRemoveProject(t *testing.T) {
	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir)

	service := NewProjectService(gitService)
	project, _, _ := service.AddProject(tmpDir)

	err := service.RemoveProject(project.ID)
	if err != nil {
		t.Fatalf("删除项目失败: %v", err)
	}

	// 验证已删除
	_, err = service.GetProject(project.ID)
	if err == nil {
		t.Error("删除后应无法获取项目")
	}
}

func TestSetCurrentProject(t *testing.T) {
	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir)

	service := NewProjectService(gitService)
	service.AddProject(tmpDir)

	err := service.SetCurrentProject(tmpDir)
	if err != nil {
		t.Fatalf("设置当前项目失败: %v", err)
	}

	if gitService.GetRepoPath() == "" {
		t.Error("GitService 的 repoPath 应已设置")
	}
}
```

### 步骤 3：运行测试验证

```bash
cd <project-root>
go test ./internal/project/ -v
```

预期：所有测试通过

### 步骤 4：修改 app.go 注册 ProjectService

修改 `app.go`：

```go
// App struct
type App struct {
	ctx             context.Context
	FileService     *fs.FileService
	GitService      *git.GitService
	TerminalService *terminal.TerminalService
	ChatManager     *ai.ChatHistoryManager
	ProjectService  *project.ProjectService  // 新增
}

// NewApp creates a new App application struct
func NewApp() *App {
	gitService := git.NewGitService()
	return &App{
		FileService:     fs.NewFileService(),
		GitService:      gitService,
		TerminalService: terminal.NewTerminalService(),
		ChatManager:     ai.NewChatHistoryManager(ai.NewProviderManager()),
		ProjectService:  project.NewProjectService(gitService),  // 新增
	}
}
```

添加 import：

```go
import (
	"github.com/swcrbt/ai-ide/internal/project"  // 新增
)
```

### 步骤 5：Commit

```bash
git add internal/project/ app.go
git commit -m "feat: 添加 ProjectService 后端实现"
```

---

## 任务 2：前端 useProjectStore 实现

**文件：**
- 创建：`frontend/src/stores/useProjectStore.ts`
- 测试：`frontend/src/stores/useProjectStore.test.ts`

### 步骤 1：编写 useProjectStore

创建 `frontend/src/stores/useProjectStore.ts`：

```typescript
import { create } from 'zustand';
import {
  ListProjects,
  AddProject,
  InitGitAndSave,
  RemoveProject,
  SetCurrentProject,
} from '../types/wails';
import { useExplorerStore } from './useExplorerStore';
import { useGitStore } from './useGitStore';

export interface Project {
  id: number;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  isAddDialogOpen: boolean;
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
  addProject: (path: string) => Promise<{ project: Project | null; needsInit: boolean }>;
  initGitAndAdd: (path: string) => Promise<Project>;
  removeProject: (id: number) => Promise<void>;
  switchProject: (id: number) => Promise<void>;
  setAddDialogOpen: (open: boolean) => void;
}

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  isAddDialogOpen: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await ListProjects();
      set({ projects: projects || [], isLoading: false });
    } catch (err) {
      console.error('加载项目列表失败:', err);
      set({ projects: [], isLoading: false });
    }
  },

  addProject: async (path: string) => {
    try {
      const result = await AddProject(path);
      // result 是 [Project, boolean] 数组
      const [project, needsInit] = result as unknown as [Project | null, boolean];
      
      if (project) {
        // 刷新列表
        await get().loadProjects();
        // 自动切换到新项目
        await get().switchProject(project.id);
      }
      
      return { project, needsInit };
    } catch (err) {
      console.error('添加项目失败:', err);
      throw err;
    }
  },

  initGitAndAdd: async (path: string) => {
    try {
      const project = await InitGitAndSave(path);
      // 刷新列表
      await get().loadProjects();
      // 自动切换到新项目
      await get().switchProject(project.id);
      return project;
    } catch (err) {
      console.error('初始化 Git 并添加项目失败:', err);
      throw err;
    }
  },

  removeProject: async (id: number) => {
    try {
      await RemoveProject(id);
      // 如果删除的是当前项目，清空当前项目
      if (get().currentProject?.id === id) {
        set({ currentProject: null });
        // 清空文件树
        useExplorerStore.setState({ treeData: [], rootPath: '', projectName: '' });
      }
      // 刷新列表
      await get().loadProjects();
    } catch (err) {
      console.error('删除项目失败:', err);
      throw err;
    }
  },

  switchProject: async (id: number) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) {
      throw new Error('项目不存在');
    }

    set({ currentProject: project });

    // 设置 Git 仓库路径
    try {
      await SetCurrentProject(project.path);
    } catch (err) {
      console.error('设置当前项目失败:', err);
    }

    // 加载文件树
    try {
      await useExplorerStore.getState().loadTree(project.path);
    } catch (err) {
      console.error('加载文件树失败:', err);
    }

    // 加载 Git 状态
    try {
      await useGitStore.getState().loadStatus(project.path);
      await useGitStore.getState().loadSummary(project.path);
    } catch (err) {
      console.error('加载 Git 状态失败:', err);
    }
  },

  setAddDialogOpen: (open: boolean) => {
    set({ isAddDialogOpen: open });
  },
}));
```

### 步骤 2：导出 Wails 绑定函数

修改 `frontend/src/types/wails.ts`，在文件末尾添加：

```typescript
// ---------------------------------------------------------------------------
// Project 服务函数 / Project Service Functions
// ---------------------------------------------------------------------------

/** 获取项目列表 */
export { ListProjects } from '../../wailsjs/go/project/ProjectService';

/** 添加项目 */
export { AddProject } from '../../wailsjs/go/project/ProjectService';

/** 初始化 Git 并保存项目 */
export { InitGitAndSave } from '../../wailsjs/go/project/ProjectService';

/** 删除项目 */
export { RemoveProject } from '../../wailsjs/go/project/ProjectService';

/** 设置当前项目 */
export { SetCurrentProject } from '../../wailsjs/go/project/ProjectService';
```

### 步骤 3：编写测试

创建 `frontend/src/stores/useProjectStore.test.ts`：

```typescript
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
```

### 步骤 4：运行测试

```bash
cd <project-root>/frontend
npm test -- useProjectStore.test.ts
```

预期：测试通过

### 步骤 5：Commit

```bash
git add frontend/src/stores/useProjectStore.ts frontend/src/stores/useProjectStore.test.ts frontend/src/types/wails.ts
git commit -m "feat: 添加 useProjectStore 前端状态管理"
```

---

## 任务 3：AddProjectDialog 组件实现

**文件：**
- 创建：`frontend/src/components/Project/AddProjectDialog.tsx`
- 测试：`frontend/src/components/Project/AddProjectDialog.test.tsx`

### 步骤 1：编写 AddProjectDialog 组件

创建 `frontend/src/components/Project/AddProjectDialog.tsx`：

```tsx
import * as React from 'react';
import { FolderOpen, AlertTriangle, X } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';
import { OpenDirectoryDialog } from '../../wailsjs/go/main/App';

/**
 * 添加项目对话框组件
 *
 * 提供文件选择、Git 初始化确认等功能。
 */
export function AddProjectDialog() {
  const { isAddDialogOpen, setAddDialogOpen, addProject, initGitAndAdd } = useProjectStore();
  const [selectedPath, setSelectedPath] = React.useState('');
  const [needsInit, setNeedsInit] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showInitConfirm, setShowInitConfirm] = React.useState(false);

  const handleOpenDialog = async () => {
    setError('');
    try {
      const path = await OpenDirectoryDialog({
        Title: '选择项目目录',
        CanCreateDirectories: false,
      });
      if (path) {
        setSelectedPath(path);
        setNeedsInit(false);
        setShowInitConfirm(false);
      }
    } catch (err) {
      setError('打开文件选择器失败');
    }
  };

  const handleAddProject = async () => {
    if (!selectedPath) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await addProject(selectedPath);

      if (result.needsInit) {
        setNeedsInit(true);
        setShowInitConfirm(true);
        setIsLoading(false);
        return;
      }

      // 添加成功，关闭对话框
      handleClose();
    } catch (err: any) {
      setError(err.message || '添加项目失败');
      setIsLoading(false);
    }
  };

  const handleInitGit = async () => {
    if (!selectedPath) return;

    setIsLoading(true);
    setError('');

    try {
      await initGitAndAdd(selectedPath);
      handleClose();
    } catch (err: any) {
      setError(err.message || '初始化 Git 失败');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedPath('');
    setNeedsInit(false);
    setShowInitConfirm(false);
    setError('');
    setIsLoading(false);
    setAddDialogOpen(false);
  };

  if (!isAddDialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-[480px] max-w-[90vw]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">添加项目</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-4 py-4 space-y-4">
          {/* 路径选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">项目目录</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedPath}
                readOnly
                placeholder="点击右侧按钮选择目录"
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted/50"
              />
              <button
                onClick={handleOpenDialog}
                disabled={isLoading}
                className="px-3 py-2 border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>

          {/* Git 初始化确认 */}
          {showInitConfirm && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm">
                    该项目未初始化 Git 仓库。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    是否自动初始化 Git？
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowInitConfirm(false)}
                      className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleInitGit}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? '初始化中...' : '确认初始化'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleAddProject}
            disabled={!selectedPath || isLoading || showInitConfirm}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? '添加中...' : '添加项目'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 步骤 2：编写测试

创建 `frontend/src/components/Project/AddProjectDialog.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddProjectDialog } from './AddProjectDialog';

// Mock useProjectStore
vi.mock('../../stores/useProjectStore', () => ({
  useProjectStore: () => ({
    isAddDialogOpen: true,
    setAddDialogOpen: vi.fn(),
    addProject: vi.fn(),
    initGitAndAdd: vi.fn(),
  }),
}));

// Mock Wails
vi.mock('../../wailsjs/go/main/App', () => ({
  OpenDirectoryDialog: vi.fn(() => Promise.resolve('/test/project')),
}));

describe('AddProjectDialog', () => {
  it('should render dialog when open', () => {
    render(<AddProjectDialog />);
    expect(screen.getByText('添加项目')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('点击右侧按钮选择目录')).toBeInTheDocument();
  });

  it('should have disabled add button when no path selected', () => {
    render(<AddProjectDialog />);
    const addButton = screen.getByText('添加项目');
    expect(addButton).toBeDisabled();
  });
});
```

### 步骤 3：运行测试

```bash
cd <project-root>/frontend
npm test -- AddProjectDialog.test.tsx
```

### 步骤 4：Commit

```bash
git add frontend/src/components/Project/
git commit -m "feat: 添加 AddProjectDialog 组件"
```

---

## 任务 4：修改 FileTree 组件添加 ProjectSelector

**文件：**
- 修改：`frontend/src/components/Explorer/FileTree.tsx`

### 步骤 1：修改 FileTree.tsx

修改 `frontend/src/components/Explorer/FileTree.tsx`：

```tsx
import { useEffect, useRef, useMemo, useState } from 'react';
import { FolderTree, RefreshCw, Plus, ChevronDown, Trash2 } from 'lucide-react';
import { VariableSizeList, VariableSizeList as List } from 'react-window';
import { useExplorerStore, type FileNode } from '../../stores/useExplorerStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { FileTreeNodeRow } from './FileTreeNode';
import { AddProjectDialog } from '../Project/AddProjectDialog';

// ... 现有接口定义保持不变 ...

export function FileTree({ onFileClick }: FileTreeProps) {
  const {
    treeData,
    isLoading,
    projectName,
    expandedPaths,
    loadTree,
    refresh,
  } = useExplorerStore();

  const {
    projects,
    currentProject,
    loadProjects,
    switchProject,
    removeProject,
    setAddDialogOpen,
  } = useProjectStore();

  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 初始加载文件树（如果有当前项目）
  useEffect(() => {
    if (currentProject) {
      loadTree(currentProject.path);
    }
  }, [currentProject, loadTree]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const flattenedNodes = useMemo(() => {
    return flattenTree(treeData, expandedPaths);
  }, [treeData, expandedPaths]);

  const nodeCount = flattenedNodes.length;
  const enableVirtualization = nodeCount > 100;
  const ITEM_HEIGHT = 32;

  useEffect(() => {
    if (listRef.current && enableVirtualization) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedPaths, enableVirtualization]);

  const displayName = currentProject?.name || projectName;

  return (
    <div className="flex flex-col h-full w-full bg-sidebar text-sidebar-fg">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FolderTree size={16} className="text-muted-foreground flex-shrink-0" />
          
          {/* 项目选择器 */}
          <div className="relative flex-1 min-w-0" ref={menuRef}>
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-1 text-sm font-medium truncate hover:bg-accent/50 rounded px-1 py-0.5 transition-colors w-full"
            >
              <span className="truncate">{displayName}</span>
              <ChevronDown size={14} className="flex-shrink-0" />
            </button>

            {/* 项目下拉菜单 */}
            {showProjectMenu && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-md z-50 py-1">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    暂无项目
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent group ${
                        currentProject?.id === project.id ? 'bg-accent/50' : ''
                      }`}
                      onClick={() => {
                        switchProject(project.id);
                        setShowProjectMenu(false);
                      }}
                    >
                      <span className="truncate flex-1">{project.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProject(project.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity"
                        title="删除项目"
                      >
                        <Trash2 size={12} className="text-destructive" />
                      </button>
                    </div>
                  ))
                )}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => {
                      setAddDialogOpen(true);
                      setShowProjectMenu(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-accent transition-colors"
                  >
                    <Plus size={14} />
                    <span>添加项目</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* 添加项目按钮 */}
          <button
            onClick={() => setAddDialogOpen(true)}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title="添加项目"
          >
            <Plus size={14} className="text-muted-foreground" />
          </button>

          {/* 刷新按钮 */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1 rounded hover:bg-accent/50 transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw
              size={14}
              className={`text-muted-foreground ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* 文件树内容区域 */}
      <div ref={containerRef} className="flex-1 overflow-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center">
            <FolderTree size={24} className="mb-2 opacity-50" />
            <p>暂无文件</p>
            <p className="text-xs mt-1 opacity-70">
              {currentProject ? '项目目录为空或加载失败' : '请添加一个项目'}
            </p>
          </div>
        ) : enableVirtualization ? (
          <List
            ref={listRef}
            itemCount={nodeCount}
            itemSize={() => ITEM_HEIGHT}
            itemData={{ nodes: flattenedNodes, onFileClick }}
            height={containerRef.current?.clientHeight || 600}
            width="100%"
            overscanCount={5}
          >
            {FileTreeRow}
          </List>
        ) : (
          treeData.map((node) => (
            <FileTreeNodeRow key={node.path} node={node} depth={0} onFileClick={onFileClick} />
          ))
        )}
      </div>

      {/* 添加项目对话框 */}
      <AddProjectDialog />
    </div>
  );
}
```

### 步骤 2：Commit

```bash
git add frontend/src/components/Explorer/FileTree.tsx
git commit -m "feat: FileTree 添加 ProjectSelector 和项目切换功能"
```

---

## 任务 5：扩展 GitStore 支持文件状态映射

**文件：**
- 修改：`frontend/src/stores/useGitStore.ts`

### 步骤 1：扩展 useGitStore

修改 `frontend/src/stores/useGitStore.ts`，在接口中添加：

```typescript
interface GitState {
  // ... 现有状态 ...
  
  // 文件状态映射（用于文件树显示）
  fileStatusMap: Map<string, string>; // path -> status letter (M, A, D, ?, etc.)
}

interface GitActions {
  // ... 现有方法 ...
  
  // 获取文件状态
  getFileStatus: (path: string) => string | null;
}
```

在 store 实现中添加：

```typescript
export const useGitStore = create<GitState>()((set, get) => ({
  // ... 现有初始状态 ...
  fileStatusMap: new Map(),

  // 修改 loadStatus 方法，构建 fileStatusMap
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

  // 添加获取文件状态方法
  getFileStatus: (path: string) => {
    return get().fileStatusMap.get(path) || null;
  },

  // ... 其余方法保持不变 ...
}));
```

### 步骤 2：Commit

```bash
git add frontend/src/stores/useGitStore.ts
git commit -m "feat: GitStore 扩展文件状态映射支持"
```

---

## 任务 6：修改 FileTreeNode 显示 Git 状态

**文件：**
- 修改：`frontend/src/components/Explorer/FileTreeNode.tsx`

### 步骤 1：修改 FileTreeNode.tsx

修改 `frontend/src/components/Explorer/FileTreeNode.tsx`，使用 `useGitStore` 获取文件状态：

```tsx
import { useGitStore } from '../../stores/useGitStore';

// ... 在 FileTreeNodeRow 组件中 ...

export function FileTreeNodeRow({ node, depth = 0, onFileClick }: FileTreeNodeProps) {
  const { expandedPaths, selectedPath, toggleNode, selectNode, performOperation } =
    useExplorerStore();
  const { openFile } = useEditorStore();
  const { getFileStatus } = useGitStore();  // 新增

  // ... 现有代码 ...

  // 从 GitStore 获取文件状态
  const gitStatusLetter = getFileStatus(node.path);
  const gitStatus = gitStatusLetter ? statusLetterToStatus(gitStatusLetter) : null;
  const gitConfig = gitStatus ? gitStatusConfig[gitStatus] : null;

  // ... 其余代码保持不变 ...
}

// 状态字母转换为状态字符串
function statusLetterToStatus(letter: string): string | null {
  switch (letter) {
    case 'M': return 'modified';
    case 'A': return 'added';
    case 'D': return 'deleted';
    case '?': return 'untracked';
    case 'R': return 'renamed';
    case 'U': return 'conflicted';
    default: return null;
  }
}
```

### 步骤 2：Commit

```bash
git add frontend/src/components/Explorer/FileTreeNode.tsx
git commit -m "feat: FileTreeNode 集成 Git 状态显示"
```

---

## 任务 7：运行 Wails 生成绑定并验证

### 步骤 1：运行 Wails 生成

```bash
cd <project-root>
wails generate module
```

这会生成 `frontend/wailsjs/go/project/ProjectService.d.ts` 和 `.js` 文件。

### 步骤 2：验证 TypeScript 编译

```bash
cd <project-root>/frontend
npm run build
```

预期：无 TypeScript 错误

### 步骤 3：运行前端测试

```bash
cd <project-root>/frontend
npm test
```

预期：所有测试通过

### 步骤 4：运行后端测试

```bash
cd <project-root>
go test ./...
```

预期：所有测试通过

### 步骤 5：Commit

```bash
git add frontend/wailsjs/go/project/
git commit -m "chore: 生成 Wails 绑定文件"
```

---

## 任务 8：集成测试和最终验证

### 步骤 1：运行完整测试套件

```bash
cd <project-root>
go test ./... -v
cd frontend && npm test
```

### 步骤 2：手动验证清单

- [ ] 打开应用，点击 "+" 按钮
- [ ] 选择已有 Git 仓库的目录
- [ ] 验证项目直接添加成功并自动切换
- [ ] 选择没有 Git 的目录
- [ ] 验证显示确认对话框
- [ ] 点击确认初始化
- [ ] 验证 Git 初始化成功并添加项目
- [ ] 验证文件树显示正确
- [ ] 验证 Git 状态在文件树中显示
- [ ] 重启应用
- [ ] 验证项目列表仍然保留
- [ ] 验证可以切换项目
- [ ] 验证可以删除项目

### 步骤 3：最终 Commit

```bash
git commit -m "feat: 完成项目管理系统实现"
```

---

## 自检

### 规格覆盖度检查

| 规格需求 | 实现任务 |
|---------|---------|
| 通过文件选择对话框添加项目 | 任务 3：AddProjectDialog |
| 自动检测 Git 状态 | 任务 1：ProjectService.AddProject |
| 未初始化 Git 强制要求初始化 | 任务 1：AddProject 返回 needsInit，任务 3：确认对话框 |
| 已存在 Git 仓库可直接添加 | 任务 1：AddProject 自动保存 |
| 项目信息持久化到 SQLite | 任务 1：使用已有的 projects 表 |
| 文件树显示 Git 状态 | 任务 5 + 6：GitStore 扩展 + FileTreeNode 修改 |
| 项目切换 | 任务 2：useProjectStore.switchProject |
| 项目列表持久化 | 任务 1：SQLite CRUD |

**无遗漏。**

### 占位符扫描

- [x] 无 "TODO"、"待定"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 每个步骤包含实际代码
- [x] 所有类型和方法在定义后使用

### 类型一致性

- [x] `Project` 结构体前后端一致
- [x] `useProjectStore` 方法名与 Wails 绑定一致
- [x] Git 状态映射使用统一的字母标识（M, A, D, ?, R, U）

---

**计划已完成并保存到 `docs/superpowers/plans/2026-05-24-project-management.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
