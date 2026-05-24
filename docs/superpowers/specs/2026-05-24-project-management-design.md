# 项目管理系统设计文档

**日期**: 2026-05-24  
**主题**: 文件资源管理器增加项目支持  
**状态**: 待实现  

---

## 1. 需求概述

### 1.1 目标
为 AI IDE 的文件资源管理器增加项目管理功能，支持：
- 通过文件选择对话框添加项目目录
- 自动检测项目是否已初始化 Git 仓库
- 未初始化 Git 的项目强制要求用户确认后自动初始化
- 已存在 Git 仓库的项目可直接添加
- 项目信息持久化保存到 SQLite
- 在文件树中显示 Git 状态标识

### 1.2 用户故事
1. 作为用户，我可以通过点击 "+" 按钮选择目录添加项目
2. 作为用户，当我添加一个没有 Git 初始化的项目时，系统会弹窗提示并询问是否自动初始化
3. 作为用户，我添加的项目会在重启后仍然保留
4. 作为用户，我可以在文件树中看到文件的 Git 状态（修改、新增、未跟踪等）
5. 作为用户，我可以切换不同的项目

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
├─────────────────────────────────────────────────────┤
│  AddProjectDialog  │  ProjectSelector  │  FileTree  │
│        ↓           │        ↓          │     ↑      │
│   useProjectStore  │  useProjectStore  │useExplorerStore
└─────────────────────────────────────────────────────┘
│                      Wails Bridge                    │
├─────────────────────────────────────────────────────┤
│              ProjectService (Go)                     │
│         ┌──────────────┬──────────────┐             │
│         │  Project CRUD │  Git Check   │             │
│         │   (SQLite)   │   & Init     │             │
│         └──────────────┴──────────────┘             │
└─────────────────────────────────────────────────────┘
```

### 2.2 后端组件

#### 2.2.1 ProjectService (`internal/project/service.go`)

**职责**: 管理项目列表的 CRUD 操作，协调 Git 仓库检测和初始化

**依赖**:
- `config.DB` (SQLite 数据库连接)
- `git.GitService` (Git 操作)

**接口定义**:

```go
type ProjectService struct {
    gitService *git.GitService
}

// NewProjectService 创建 ProjectService 实例
func NewProjectService(gitService *git.GitService) *ProjectService

// ListProjects 获取所有项目列表
func (s *ProjectService) ListProjects() ([]Project, error)

// AddProject 添加新项目
// 返回: (project, needsInit, error)
// needsInit 为 true 表示需要初始化 Git
func (s *ProjectService) AddProject(path string) (*Project, bool, error)

// InitGitAndSave 初始化 Git 并保存项目
func (s *ProjectService) InitGitAndSave(path string) (*Project, error)

// RemoveProject 删除项目
func (s *ProjectService) RemoveProject(id int64) error

// GetProject 获取单个项目
func (s *ProjectService) GetProject(id int64) (*Project, error)

// SetCurrentProject 设置当前项目（更新 GitService 的 repoPath）
func (s *ProjectService) SetCurrentProject(path string) error
```

**Project 结构体**:

```go
type Project struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Path      string    `json:"path"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
```

**AddProject 详细逻辑**:

```
1. 验证 path 存在且为目录
   - 不存在 → 返回错误 "路径不存在"
   - 不是目录 → 返回错误 "路径不是目录"

2. 获取绝对路径

3. 检查 path 是否已在 projects 表中
   - 已存在 → 返回已有项目，needsInit=false

4. 检查是否为 Git 仓库（调用 gitService.IsGitRepo(path)）
   - 是 → 保存到数据库，返回 project, needsInit=false
   - 否 → 返回 nil, needsInit=true, error=nil
```

**InitGitAndSave 详细逻辑**:

```
1. 调用 gitService.Init(path) 初始化 Git
   - 失败 → 返回错误

2. 保存到 projects 表

3. 设置 GitService 的 repoPath

4. 返回 project
```

#### 2.2.2 数据库表（已存在）

```sql
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**说明**: 表结构已存在于 `internal/config/database.go` 中，无需修改。

### 2.3 前端组件

#### 2.3.1 useProjectStore (`frontend/src/stores/useProjectStore.ts`)

**状态**:

```typescript
interface Project {
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
```

**方法**:

```typescript
interface ProjectActions {
  loadProjects: () => Promise<void>;
  addProject: (path: string) => Promise<{ project: Project; needsInit: boolean }>;
  initGitAndAdd: (path: string) => Promise<Project>;
  removeProject: (id: number) => Promise<void>;
  switchProject: (id: number) => Promise<void>;
  setAddDialogOpen: (open: boolean) => void;
}
```

**switchProject 逻辑**:

```
1. 调用 ProjectService.SetCurrentProject(project.path)
2. 更新 currentProject 状态
3. 调用 useExplorerStore.loadTree(project.path)
4. 调用 useGitStore.loadGitStatus(project.path)
```

#### 2.3.2 AddProjectDialog (`frontend/src/components/Project/AddProjectDialog.tsx`)

**触发方式**: 文件树头部的 "+" 按钮

**流程**:

```
1. 点击 "+" 按钮
2. 调用 Wails runtime.OpenDirectoryDialog 打开文件选择器
3. 用户选择目录后，调用 useProjectStore.addProject(path)
4. 根据返回结果：
   a. needsInit=false → 显示成功提示，自动切换到新项目
   b. needsInit=true → 显示确认对话框：
      "该项目未初始化 Git 仓库\n\n是否自动初始化 Git？"
      [取消] [确认初始化]
   c. 用户点击 [确认初始化] → 调用 useProjectStore.initGitAndAdd(path)
      - 成功 → 显示成功提示，自动切换
      - 失败 → 显示错误提示
```

**UI 设计**:
- 使用现有的对话框样式（参考 `TaskCreateDialog.tsx`）
- 确认对话框使用 AlertDialog 组件
- 显示项目路径和项目名称

#### 2.3.3 ProjectSelector (`frontend/src/components/Explorer/FileTree.tsx` 头部修改)

**修改内容**:

```
文件树头部（当前）:
┌─────────────────────────────────┐
│ [FolderTree] 项目名称    [刷新] │
└─────────────────────────────────┘

文件树头部（修改后）:
┌─────────────────────────────────┐
│ [FolderTree] [项目名称 ▼] [+] [刷新] │
└─────────────────────────────────┘
```

**ProjectSelector 功能**:
- 下拉框显示所有已添加的项目
- 当前项目高亮显示
- 点击项目切换当前项目
- 每个项目右侧显示删除按钮（hover 时显示）
- 底部显示 "添加项目" 选项

#### 2.3.4 Git 状态显示 (`frontend/src/components/Explorer/FileTreeNode.tsx`)

**修改内容**:
- 在文件节点右侧显示 Git 状态标识
- 状态映射：
  - `modified` → 黄色 "M"
  - `added` → 绿色 "A"
  - `deleted` → 红色 "D"
  - `untracked` → 灰色 "?"
- 目录节点显示子文件状态汇总（如果有修改则显示对应颜色点）

**数据来源**: `useGitStore` 提供的文件状态映射

#### 2.3.5 useGitStore 扩展 (`frontend/src/stores/useGitStore.ts`)

**新增状态和方法**:

```typescript
interface GitState {
  // 现有状态...
  fileStatusMap: Map<string, GitStatus>; // 文件路径 -> Git 状态
}

interface GitActions {
  // 现有方法...
  loadGitStatus: (path: string) => Promise<void>;
  getFileStatus: (path: string) => GitStatus;
}
```

**loadGitStatus 逻辑**:

```
1. 调用 GitService.Status(path)
2. 解析返回的 GitStatus，构建 fileStatusMap
3. 更新状态
```

---

## 3. 数据流

### 3.1 添加项目（已有 Git）

```
用户点击 "+" → OpenDirectoryDialog → 返回 path
    ↓
调用 ProjectService.AddProject(path)
    ↓
检查 IsGitRepo(path) → true
    ↓
保存到数据库
    ↓
返回 {project, needsInit: false}
    ↓
前端自动调用 switchProject(project.id)
    ↓
加载文件树 → 加载 Git 状态
```

### 3.2 添加项目（无 Git）

```
用户点击 "+" → OpenDirectoryDialog → 返回 path
    ↓
调用 ProjectService.AddProject(path)
    ↓
检查 IsGitRepo(path) → false
    ↓
返回 {project: nil, needsInit: true}
    ↓
前端显示确认对话框
    ↓
用户点击 [确认初始化]
    ↓
调用 ProjectService.InitGitAndSave(path)
    ↓
执行 git init → 保存到数据库
    ↓
返回 project
    ↓
前端自动调用 switchProject(project.id)
    ↓
加载文件树 → 加载 Git 状态
```

### 3.3 切换项目

```
用户点击 ProjectSelector 中的项目
    ↓
调用 useProjectStore.switchProject(id)
    ↓
调用 ProjectService.SetCurrentProject(project.path)
    ↓
更新 GitService.repoPath
    ↓
调用 useExplorerStore.loadTree(project.path)
    ↓
调用 useGitStore.loadGitStatus(project.path)
    ↓
UI 更新：文件树 + Git 状态
```

---

## 4. 错误处理

| 场景 | 错误信息 | 处理方式 |
|------|---------|---------|
| 路径不存在 | "路径不存在: {path}" | 对话框显示错误 |
| 路径不是目录 | "路径不是目录: {path}" | 对话框显示错误 |
| 项目已存在 | "项目已存在" | 提示并切换到已有项目 |
| Git 初始化失败 | "初始化 Git 仓库失败: {error}" | 对话框显示错误，不保存项目 |
| 加载项目列表失败 | "加载项目列表失败" | Toast 提示，使用空列表 |
| 切换项目失败 | "切换项目失败" | Toast 提示，保持当前项目 |

---

## 5. 测试策略

### 5.1 后端测试 (`internal/project/service_test.go`)

- `TestAddProject_WithGitRepo`: 添加已有 Git 的项目
- `TestAddProject_WithoutGitRepo`: 添加无 Git 的项目，验证 needsInit=true
- `TestInitGitAndSave`: 测试初始化 Git 并保存
- `TestAddProject_Duplicate`: 测试添加重复项目
- `TestAddProject_InvalidPath`: 测试无效路径
- `TestListProjects`: 测试列表查询
- `TestRemoveProject`: 测试删除项目
- `TestSetCurrentProject`: 测试设置当前项目

### 5.2 前端测试

- `useProjectStore.test.ts`:
  - 测试加载项目列表
  - 测试添加项目（有 Git）
  - 测试添加项目（无 Git）
  - 测试切换项目
  - 测试删除项目

- `AddProjectDialog.test.tsx`:
  - 测试打开文件选择器
  - 测试确认对话框显示
  - 测试 Git 初始化流程

---

## 6. 实现顺序

1. **后端**: 创建 `internal/project/service.go` 和测试
2. **后端**: 在 `app.go` 中注册 `ProjectService`
3. **前端**: 创建 `useProjectStore.ts`
4. **前端**: 创建 `AddProjectDialog.tsx`
5. **前端**: 修改 `FileTree.tsx` 添加 ProjectSelector
6. **前端**: 扩展 `useGitStore.ts` 支持文件状态
7. **前端**: 修改 `FileTreeNode.tsx` 显示 Git 状态
8. **集成测试**: 端到端测试添加项目和 Git 初始化流程

---

## 7. 文件变更清单

### 新增文件
- `internal/project/service.go`
- `internal/project/service_test.go`
- `frontend/src/stores/useProjectStore.ts`
- `frontend/src/stores/useProjectStore.test.ts`
- `frontend/src/components/Project/AddProjectDialog.tsx`
- `frontend/src/components/Project/AddProjectDialog.test.tsx`

### 修改文件
- `app.go` - 注册 ProjectService
- `frontend/src/stores/useGitStore.ts` - 扩展文件状态支持
- `frontend/src/components/Explorer/FileTree.tsx` - 添加 ProjectSelector
- `frontend/src/components/Explorer/FileTreeNode.tsx` - 显示 Git 状态

---

## 8. 规格自检

- [x] **占位符扫描**: 无 "TODO"、"待定"、未完成章节
- [x] **内部一致性**: 后端接口与前端 Store 方法一致，数据流清晰
- [x] **范围检查**: 聚焦项目管理核心功能，不涉及重构其他模块
- [x] **模糊性检查**: 所有交互流程、错误处理、状态映射已明确
- [x] **类型一致性**: Go 结构体与 TypeScript 接口字段一致

---

**下一步**: 用户审查通过后，调用 `writing-plans` 技能创建详细实现计划。
