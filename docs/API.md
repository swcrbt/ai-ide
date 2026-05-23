# API 文档

本文档描述 AI IDE 的前后端接口，包括 Wails 绑定方法、后端服务接口、AI Agent 接口和 MCP 工具接口。

## 目录

- [Wails 绑定接口](#wails-绑定接口)
- [文件服务接口](#文件服务接口)
- [Git 服务接口](#git-服务接口)
- [终端服务接口](#终端服务接口)
- [LSP 服务接口](#lsp-服务接口)
- [AI Agent 接口](#ai-agent-接口)
- [MCP 工具接口](#mcp-工具接口)
- [事件系统](#事件系统)

---

## Wails 绑定接口

Wails 通过反射自动将 Go 结构体的方法暴露给前端。在 `main.go` 中，以下服务被绑定到前端：

```go
Bind: []interface{}{
    app,              // App 自身方法
    app.FileService,  // 文件服务
    app.GitService,   // Git 服务
},
```

前端通过 `wailsjs/go/main/App` 和对应服务的绑定文件调用这些方法。

### App 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Greet` | `Greet(name string) string` | 问候方法（示例） |
| `GetSettings` | `GetSettings() (string, error)` | 获取应用配置（JSON 字符串） |
| `SaveSettings` | `SaveSettings(settingsJSON string) error` | 保存应用配置 |
| `ResetSettings` | `ResetSettings() error` | 重置配置为默认值 |

---

## 文件服务接口

**结构体**：`fs.FileService`

**路径**：`internal/fs/service.go`

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `ReadFile` | `ReadFile(path string) ([]byte, error)` | 读取文件内容，包含路径安全检查 |
| `WriteFile` | `WriteFile(path string, content []byte) error` | 写入文件，自动创建父目录 |
| `CreateFile` | `CreateFile(path string, isDir bool) error` | 创建文件或目录 |
| `DeleteFile` | `DeleteFile(path string) error` | 删除文件或目录 |
| `RenameFile` | `RenameFile(oldPath, newPath string) error` | 重命名/移动文件 |
| `GetFileTree` | `GetFileTree(root string) (*FileNode, error)` | 递归获取目录树结构 |
| `Watch` | `Watch(path string) error` | 开始监听路径的文件变更 |
| `Unwatch` | `Unwatch(path string) error` | 停止监听路径 |
| `GetEventChannel` | `GetEventChannel() <-chan FileEvent` | 获取文件变更事件通道 |
| `Close` | `Close() error` | 关闭文件服务，释放资源 |

### 类型定义

```go
// FileNode 文件树节点
type FileNode struct {
    Name     string      // 文件名
    Path     string      // 完整路径
    IsDir    bool        // 是否为目录
    ModTime  time.Time   // 修改时间
    Size     int64       // 文件大小（仅文件）
    Children []*FileNode // 子节点（仅目录）
}

// FileEvent 文件变更事件
type FileEvent struct {
    Path   string // 文件路径
    Op     string // 操作类型：create/write/remove/rename/chmod
    IsDir  bool   // 是否为目录
}
```

### 安全机制

所有文件操作都经过路径安全检查：
- 禁止包含 `..` 的路径（防止目录遍历）
- `GetFileTree` 验证目标路径存在且为目录
- `WriteFile` 自动创建不存在的父目录

---

## Git 服务接口

**结构体**：`git.GitService`

**路径**：`internal/git/service.go`

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `SetRepoPath` | `SetRepoPath(path string)` | 设置当前仓库路径 |
| `GetRepoPath` | `GetRepoPath() string` | 获取当前仓库路径 |
| `IsGitRepo` | `IsGitRepo(path string) bool` | 检查路径是否为 Git 仓库 |
| `Status` | `Status(path string) (*GitStatus, error)` | 获取仓库完整状态 |
| `Summary` | `Summary(path string) (*GitSummary, error)` | 获取状态摘要（用于面板） |
| `Diff` | `Diff(path string, staged bool) (*GitDiff, error)` | 获取单个文件的 Diff |
| `DiffAll` | `DiffAll(staged bool) (string, error)` | 获取所有变更的 Diff |
| `Stage` | `Stage(paths []string) error` | 暂存指定文件 |
| `Unstage` | `Unstage(paths []string) error` | 取消暂存指定文件 |
| `Commit` | `Commit(message string) error` | 提交暂存区的变更 |
| `Push` | `Push() error` | 推送到远程 |
| `Pull` | `Pull() error` | 从远程拉取 |
| `Branch` | `Branch() (string, error)` | 获取当前分支名称 |
| `Branches` | `Branches() ([]GitBranch, error)` | 获取所有分支列表 |
| `Checkout` | `Checkout(branch string) error` | 切换到指定分支 |
| `Log` | `Log(limit int) ([]GitCommit, error)` | 获取提交历史 |
| `Init` | `Init(path string) error` | 初始化 Git 仓库 |
| `DiscardChanges` | `DiscardChanges(paths []string) error` | 放弃工作区修改 |
| `Stash` | `Stash(message string) error` | 暂存当前工作区 |
| `StashPop` | `StashPop() error` | 恢复最近一次 stash |
| `GetRoot` | `GetRoot(path string) (string, error)` | 获取仓库根目录 |

### 类型定义

```go
// GitStatus Git 仓库状态
type GitStatus struct {
    Branch      string          // 当前分支
    Ahead       int             // 领先远程提交数
    Behind      int             // 落后远程提交数
    Modified    []GitFileStatus // 已修改文件
    Added       []GitFileStatus // 已添加文件
    Deleted     []GitFileStatus // 已删除文件
    Renamed     []GitFileStatus // 重命名文件
    Untracked   []GitFileStatus // 未追踪文件
    Conflicted  []GitFileStatus // 冲突文件
    Staged      []GitFileStatus // 已暂存文件
    IsClean     bool            // 工作区是否干净
}

// GitFileStatus 文件状态
type GitFileStatus struct {
    Path           string     // 文件路径
    IndexStatus    FileStatus // 暂存区状态
    WorktreeStatus FileStatus // 工作区状态
    Staged         bool       // 是否已暂存
}

// GitDiff Diff 信息
type GitDiff struct {
    Path      string // 文件路径
    Content   string // Diff 内容
    IsNew     bool   // 是否为新文件
    IsDeleted bool   // 是否已删除
    IsBinary  bool   // 是否为二进制文件
}

// GitCommit 提交记录
type GitCommit struct {
    Hash      string // 完整哈希
    ShortHash string // 短哈希
    Message   string // 提交信息
    Author    string // 作者
    Email     string // 邮箱
    Date      string // 日期
}

// GitBranch 分支信息
type GitBranch struct {
    Name    string // 分支名
    Current bool   // 是否为当前分支
    Remote  string // 远程追踪信息
    Ahead   int    // 领先数
    Behind  int    // 落后数
}
```

---

## 终端服务接口

**结构体**：`terminal.TerminalService`

**路径**：`internal/terminal/service.go`

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `Startup` | `Startup(ctx context.Context)` | 初始化终端服务（Wails 自动调用） |
| `StartTerminal` | `StartTerminal(shell string) error` | 启动新的终端会话 |
| `StopTerminal` | `StopTerminal() error` | 停止当前终端会话 |
| `IsRunning` | `IsRunning() bool` | 检查终端是否运行 |
| `GetDefaultShell` | `GetDefaultShell() string` | 获取默认 Shell 路径 |

### 事件常量

```go
const (
    EventTerminalOutput = "terminal:output" // 后端推送终端输出
    EventTerminalInput  = "terminal:input"  // 前端发送输入
    EventTerminalResize = "terminal:resize" // 调整终端大小
    EventTerminalReady  = "terminal:ready"  // 终端就绪
    EventTerminalClosed = "terminal:closed" // 终端关闭
)
```

### 通信说明

终端采用事件驱动的前后端通信：

- **输出流**：后端 goroutine 读取 PTY 输出，base64 编码后通过 `EventsEmit` 推送 `terminal:output` 事件
- **输入流**：前端捕获键盘输入，通过 `EventsEmit` 发送 `terminal:input` 事件，后端解码后写入 PTY
- **Resize**：前端终端尺寸变化时发送 `terminal:resize` 事件，后端调用 `pty.Resize()`

---

## LSP 服务接口

**结构体**：`lsp.LSPClient`

**路径**：`internal/lsp/client.go`

### 方法列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `Start` | `Start(serverPath string, args []string) error` | 启动语言服务器进程 |
| `Stop` | `Stop() error` | 停止语言服务器 |
| `Restart` | `Restart() error` | 重启语言服务器 |
| `Initialize` | `Initialize(workspacePath string) (*InitializeResult, error)` | 发送 Initialize 请求 |
| `Shutdown` | `Shutdown() error` | 发送 Shutdown 请求 |
| `IsRunning` | `IsRunning() bool` | 检查客户端是否运行 |
| `IsInitialized` | `IsInitialized() bool` | 检查是否已完成初始化 |
| `DidOpen` | `DidOpen(document *TextDocumentItem) error` | 通知服务器文档打开 |
| `DidClose` | `DidClose(uri DocumentURI) error` | 通知服务器文档关闭 |
| `DidChange` | `DidChange(uri DocumentURI, version int, changes []TextDocumentContentChangeEvent) error` | 通知文档内容变更 |

### LSP 状态机

```
Stopped ──Start()──► Starting ──进程启动──► Running ──Initialize()──► Initialized
   ▲                                                                      │
   └────────────────── Shutdown()/Stop() ─────────────────────────────────┘
```

---

## AI Agent 接口

### Provider 管理

**路径**：`internal/ai/provider.go`

```go
// ProviderManager AI Provider 管理器
type ProviderManager struct {
    configs map[Provider]*ProviderConfig
}

// 核心方法
func NewProviderManager() *ProviderManager
func (pm *ProviderManager) RegisterConfig(config ProviderConfig) error
func (pm *ProviderManager) GetConfig(provider Provider) (*ProviderConfig, bool)
func (pm *ProviderManager) GetBestProvider() (*ProviderConfig, error)
func (pm *ProviderManager) ValidateConfig(provider Provider) error
```

**支持的 Provider**：

| Provider | 标识 | 说明 |
|----------|------|------|
| Kimi | `kimi` | 月之暗面 |
| GLM | `glm` | 智谱 AI |
| DeepSeek | `deepseek` | DeepSeek |
| Claude | `anthropic` | Anthropic |
| OpenAI | `openai` | OpenAI |
| Ollama | `ollama` | 本地模型 |

### 聊天会话

**路径**：`internal/ai/chat.go`

```go
// ChatSession 对话会话
type ChatSession struct {
    id       string          // 会话 ID
    title    string          // 会话标题
    messages []Message       // 对话历史
    provider *ProviderConfig // 当前 Provider 配置
    client   *AIClient       // AI 客户端
}

// 核心方法
func (s *ChatSession) SendMessage(ctx context.Context, content string) (<-chan StreamChunk, error)
func (s *ChatSession) GetMessages() []Message
func (s *ChatSession) ClearHistory()
func (s *ChatSession) SwitchProvider(provider Provider) error
func (s *ChatSession) GetID() string
func (s *ChatSession) GetTitle() string
```

### 流式响应

```go
// StreamChunk 流式输出数据块
type StreamChunk struct {
    Content string // 文本内容增量
    Done    bool   // 是否结束
    Error   error  // 错误信息
}
```

前端通过遍历返回的通道获取实时响应：

```typescript
const stream = await SendMessage(content);
for await (const chunk of stream) {
  if (chunk.error) { /* 处理错误 */ }
  if (chunk.done) { /* 结束 */ }
  appendMessage(chunk.content);
}
```

### 对话历史管理

**路径**：`internal/ai/chat.go`

```go
// ChatHistoryManager 对话历史管理器
type ChatHistoryManager struct {
    sessions map[string]*ChatSession
}

// 核心方法
func (hm *ChatHistoryManager) CreateSession() (*ChatSession, error)
func (hm *ChatHistoryManager) GetSession(id string) (*ChatSession, bool)
func (hm *ChatHistoryManager) RemoveSession(id string)
func (hm *ChatHistoryManager) ListSessions() []ChatSessionInfo
func (hm *ChatHistoryManager) LoadAllSessionsFromDB() error
```

---

## MCP 工具接口

### MCP 框架

**路径**：`pkg/mcp/framework.go`

MCP (Model Context Protocol) 是 AI IDE 的扩展框架，允许 AI Agent 调用外部工具。

#### Tool 接口

```go
// Tool MCP 工具接口
type Tool interface {
    Name() string                              // 工具名称
    Description() string                       // 工具描述
    Execute(args map[string]interface{}) (string, error)  // 执行工具
}
```

#### ToolRegistry

```go
// ToolRegistry MCP 工具注册表
type ToolRegistry struct {
    tools map[string]Tool
}

// 核心方法
func (r *ToolRegistry) Register(tool Tool) error
func (r *ToolRegistry) Get(name string) (Tool, error)
func (r *ToolRegistry) List() []string
func (r *ToolRegistry) ExecuteToolCall(call ToolCall) ToolCallResult
```

### 内置工具

**路径**：`pkg/mcp/tools/`

| 工具 | 名称 | 描述 |
|------|------|------|
| GrepTool | `grep_app` | 在代码库中搜索指定模式 |
| RTKTool | `rtk` | 执行 rtk（ripgrep-like）搜索 |
| WebFetchTool | `webfetch` | 获取指定 URL 的网页内容 |
| PermissionGuardTool | `permission_guard` | 权限守卫，控制敏感操作 |

### 工具调用流程

```
1. AI 生成包含工具调用的回复
   ```tool
   {"name": "grep_app", "arguments": {"pattern": "func main"}}
   ```

2. MCPToolManager.ExecuteToolCall() 解析 JSON

3. ToolRegistry 查找并执行对应工具

4. 返回 ToolCallResult 给 AI

5. AI 根据工具结果生成最终回复
```

### ToolCall 类型

```go
// ToolCall 工具调用请求
type ToolCall struct {
    Name      string                 `json:"name"`
    Arguments map[string]interface{} `json:"arguments"`
}

// ToolCallResult 工具调用结果
type ToolCallResult struct {
    Name    string `json:"name"`
    Output  string `json:"output"`
    Error   string `json:"error,omitempty"`
    Success bool   `json:"success"`
}
```

---

## 事件系统

### Wails 事件机制

Wails 提供了前后端双向事件通信机制。

#### 后端发送事件

```go
import "github.com/wailsapp/wails/v2/pkg/runtime"

// 发送事件到前端
runtime.EventsEmit(ctx, "event:name", data)

// 监听前端事件
runtime.EventsOn(ctx, "event:name", func(data ...interface{}) {
    // 处理事件
})
```

#### 前端接收/发送事件

```typescript
import { EventsOn, EventsEmit } from '@wails/runtime';

// 监听后端事件
EventsOn('event:name', (data: any) => {
  console.log(data);
});

// 发送事件到后端
EventsEmit('event:name', data);
```

### 系统事件列表

| 事件名 | 方向 | 数据 | 说明 |
|--------|------|------|------|
| `terminal:output` | 后端 -> 前端 | base64 字符串 | 终端输出 |
| `terminal:input` | 前端 -> 后端 | base64 字符串 | 终端输入 |
| `terminal:resize` | 前端 -> 后端 | cols, rows | 终端大小调整 |
| `terminal:ready` | 前端 -> 后端 | 无 | 终端组件就绪 |
| `terminal:closed` | 后端 -> 前端 | 无 | 终端会话关闭 |
| `file:changed` | 后端 -> 前端 | FileEvent | 文件变更通知 |

### 配置管理接口

**路径**：`internal/config/settings.go`

```go
// Settings 应用全局配置
type Settings struct {
    Theme     string           `json:"theme"`     // light | dark | system
    Language  string           `json:"language"`  // zh | en
    AutoSave  bool             `json:"autoSave"`
    Editor    EditorSettings   `json:"editor"`
    Terminal  TerminalSettings `json:"terminal"`
    AI        AISettings       `json:"ai"`
}

// 配置方法
func GetSettings() (Settings, error)
func SaveSettings(settings Settings) error
func ResetSettings() error
```

---

## 前端服务封装

**路径**：`frontend/src/services/wailsApp.ts`

前端通过封装层调用 Wails 绑定方法，提供类型安全的接口并处理降级逻辑。

### LSP 服务封装

```typescript
// 初始化 LSP 客户端
export async function LSPInitialize(
  workspacePath: string,
  language: string,
  serverCommand: string,
  serverArgs: string[]
): Promise<boolean>

// 关闭 LSP 客户端
export async function LSPShutdown(): Promise<void>

// 打开文档
export async function LSPOpenDocument(uri: string, language: string, content: string): Promise<void>

// 关闭文档
export async function LSPCloseDocument(uri: string): Promise<void>

// 文档内容变更
export async function LSPChangeDocument(uri: string, content: string, version: number): Promise<void>

// 获取自动补全
export async function LSPCompletion(uri: string, line: number, character: number): Promise<CompletionResult>

// 跳转定义
export async function LSPDefinition(uri: string, line: number, character: number): Promise<Location[]>

// 查找引用
export async function LSPReferences(uri: string, line: number, character: number): Promise<Location[]>
```
