# AI IDE 架构文档

本文档描述 AI IDE 的整体系统架构、模块设计和关键技术决策。

## 1. 系统架构概述

AI IDE 采用 **分层架构**，由以下层次组成：

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Frontend)                     │
│  React 18 + TypeScript + Vite + Tailwind CSS               │
├─────────────────────────────────────────────────────────────┤
│                     Wails 桥接层 (Bridge)                    │
│  Wails v2 运行时 — Go/JS 双向绑定、事件系统                  │
├─────────────────────────────────────────────────────────────┤
│                        后端层 (Backend)                      │
│  Go 1.23 + 模块化服务设计                                    │
├─────────────────────────────────────────────────────────────┤
│                      系统层 (System)                         │
│  OS 文件系统、Shell/PTY、Git 二进制、LSP 进程               │
└─────────────────────────────────────────────────────────────┘
```

### 架构特点

- **前后端分离**：前端 React 与后端 Go 通过 Wails 桥接通信，接口类型安全
- **模块化服务**：后端按功能域拆分为独立 Service，便于测试和维护
- **平台原生**：利用 Wails 封装原生能力（文件系统、终端、窗口管理）
- **数据本地化**：配置和对话历史存储在本地 SQLite

---

## 2. 前端架构

### 2.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 组件框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具与开发服务器 |
| Tailwind CSS | 3.x | 原子化样式系统 |
| Monaco Editor | 0.47+ | 代码编辑器核心 |
| xterm.js | 5.x | 终端模拟器 |
| Zustand | 4.x | 轻量状态管理 |
| i18next | 23.x | 国际化 |
| Lucide React | 0.x | 图标库 |

### 2.2 组件层次结构

```
App.tsx
├── Layout (整体布局)
│   ├── TitleBar (自定义标题栏)
│   ├── Sidebar (侧边栏)
│   │   ├── Explorer (文件浏览器)
│   │   ├── GitPanel (Git 面板)
│   │   └── ... (其他面板)
│   ├── MainArea (主编辑区)
│   │   ├── Editor (Monaco 编辑器)
│   │   ├── Terminal (xterm.js 终端)
│   │   └── DiffViewer (Diff 预览)
│   └── ChatPanel (AI 对话侧边栏)
│       ├── ChatInput (消息输入)
│       ├── ChatMessages (消息列表)
│       └── ChatToolbar (工具栏)
└── CommandPalette (命令面板)
```

### 2.3 状态管理（Zustand）

使用 Zustand 按域拆分 Store：

```
stores/
├── editorStore.ts      # 编辑器状态（当前文件、光标位置、打开文件列表）
├── terminalStore.ts    # 终端状态（会话、当前目录）
├── chatStore.ts        # AI 对话状态（消息历史、流式响应）
├── gitStore.ts         # Git 状态（分支、变更文件）
├── explorerStore.ts    # 文件浏览器状态（目录树、选中节点）
└── settingsStore.ts    # 应用设置（主题、语言、快捷键）
```

### 2.4 前端服务层

```
services/
├── wailsService.ts     # Wails 运行时封装（Go 方法调用、事件监听）
├── lspService.ts       # LSP WebSocket 客户端
└── aiService.ts        # AI Provider 统一接口
```

---

## 3. 后端架构

### 3.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.23+ | 后端主语言 |
| Wails v2 | 2.x | 跨平台桌面应用框架 |
| SQLite | 3 | 本地数据持久化 |
| creack/pty | v1 | 伪终端支持 |
| fsnotify | v1 | 文件系统事件监听 |

### 3.2 模块化服务设计

后端采用 **App 聚合根 + 独立 Service** 的模式：

```
main.go
├── App (聚合根)
│   ├── FileService     *fs.FileService
│   ├── GitService      *git.GitService
│   └── TerminalService *terminal.TerminalService
│
internal/
├── config/           # 配置管理 + SQLite 数据库
│   ├── database.go
│   └── settings.go
├── fs/               # 文件系统服务
│   ├── file.go
│   └── watcher.go
├── git/              # Git 操作服务
│   ├── git.go
│   └── operations.go
├── terminal/         # 终端管理服务
│   ├── terminal.go
│   └── pty.go
├── lsp/              # LSP 客户端实现
│   ├── client.go
│   └── protocol.go
└── ai/               # AI 服务
    ├── provider.go
    ├── chat.go
    └── mcp.go
```

### 3.3 服务注册（Wails Bind）

在 `main.go` 中，所有 Service 通过 `Bind` 暴露给前端：

```go
wails.Run(&options.App{
    Bind: []interface{}{
        app,              // App 本身的方法（Greet、Settings）
        app.FileService,  // 文件操作
        app.GitService,   // Git 操作
        app.TerminalService, // 终端操作
    },
})
```

---

## 4. 数据流设计

### 4.1 文件操作数据流

```
用户操作 (前端)
    ↓
Zustand Store 更新 UI
    ↓
Wails Bridge 调用 Go 方法
    ↓
FileService 执行文件系统操作
    ↓
fsnotify 触发变更事件
    ↓
Wails Events 通知前端
    ↓
Explorer Store 刷新目录树
```

### 4.2 AI 对话数据流

```
用户输入消息
    ↓
chatStore 添加用户消息
    ↓
aiService 调用 Wails (Go)
    ↓
AI Provider (Kimi/DeepSeek/...) 流式响应
    ↓
Go 通过 Wails Events 推送 token
    ↓
前端接收 token，更新 chatStore
    ↓
React 重新渲染消息列表
```

### 4.3 终端数据流

```
用户输入字符 (xterm.js)
    ↓
Wails 调用 TerminalService.Write
    ↓
Go 通过 PTY 写入 Shell
    ↓
Shell 执行命令，输出到 PTY
    ↓
Go 读取 PTY 输出
    ↓
Wails Events 推送输出到前端
    ↓
xterm.js 渲染终端内容
```

### 4.4 Git 操作数据流

```
用户执行 Git 操作 (暂存/提交/推送)
    ↓
gitStore 更新 UI 状态（loading）
    ↓
Wails 调用 GitService
    ↓
Go 执行 git 命令（os/exec）
    ↓
命令完成后返回结果
    ↓
gitStore 刷新状态 + 通知 Toast
```

---

## 5. 模块依赖关系

```
                    ┌──────────────┐
                    │     App      │
                    │   (聚合根)    │
                    └──────┬───────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼──────┐    ┌───────▼───────┐   ┌──────▼──────┐
│ FileService │    │ TerminalService│   │ GitService  │
└──────┬──────┘    └───────┬───────┘   └──────┬──────┘
       │                   │                   │
       │          ┌────────▼────────┐          │
       │          │   creack/pty    │          │
       │          └─────────────────┘          │
       │                                       │
┌──────▼──────┐                        ┌───────▼───────┐
│   fsnotify  │                        │  os/exec(git) │
└─────────────┘                        └───────────────┘
```

### 依赖原则

- **上层依赖下层**：App 依赖 Service，Service 依赖底层库
- **同层不互相依赖**：FileService、GitService、TerminalService 互不直接调用
- **通过 App 协调**：跨域操作由 App 或前端协调

---

## 6. 关键设计决策

### 6.1 选择 Wails 而非 Electron

| 对比项 | Wails | Electron |
|--------|-------|----------|
| 包大小 | 小（Go 编译） | 大（Chromium + Node） |
| 内存占用 | 低 | 高 |
| 性能 | 原生 Go 后端 | Node.js 后端 |
| 前端技术 | 任意（React/Vue/Vanilla） | 任意 |
| 跨平台 | macOS/Linux/Windows | macOS/Linux/Windows |

**决策理由**：追求更小的包体积和更低的内存占用，同时保持前端技术栈的灵活性。

### 6.2 选择 Monaco Editor 而非 CodeMirror

- **VS Code 同源**： Monaco 是 VS Code 的编辑器核心，功能最完善
- **LSP 原生支持**：内置 Language Server Protocol 客户端
- **主题和插件生态**：VS Code 主题可直接复用

### 6.3 国产 AI Provider 优先策略

默认优先支持国产大模型，降低国内用户的网络门槛：
- **Kimi（月之暗面）**：长文本处理能力突出
- **DeepSeek**：代码生成能力强
- **GLM（智谱）**：中文理解优秀

同时保留 Claude、OpenAI、Ollama（本地部署）的兼容性。

### 6.4 使用 SQLite 而非纯文件配置

- 支持结构化查询（对话历史检索）
- 事务安全（配置原子更新）
- 无需额外服务进程

### 6.5 前端状态管理选择 Zustand 而非 Redux

- **代码量少**：无需写大量的 boilerplate
- **TypeScript 友好**：类型推导自动
- **性能足够**：本项目状态复杂度适中，Zustand 完全胜任

---

## 7. 项目目录结构

```
ai-ide/
├── app.go                     # Wails 应用主结构体（聚合根）
├── main.go                    # 程序入口（Wails 运行时启动）
├── wails.json                 # Wails 项目配置
├── go.mod / go.sum            # Go 依赖管理
├── frontend/                  # 前端代码
│   ├── src/
│   │   ├── App.tsx            # 主应用组件
│   │   ├── components/        # React 组件
│   │   │   ├── Editor/        # Monaco 编辑器封装
│   │   │   ├── Terminal/      # xterm.js 终端面板
│   │   │   ├── Chat/          # AI 对话面板
│   │   │   ├── Git/           # Git 操作面板
│   │   │   ├── Explorer/      # 文件浏览器
│   │   │   ├── Diff/          # Diff 预览
│   │   │   └── CommandPalette.tsx  # 命令面板
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── services/          # 前端服务（Wails、LSP、AI）
│   │   ├── hooks/             # 自定义 React Hooks
│   │   ├── config/            # 配置文件（快捷键映射等）
│   │   └── i18n/              # 国际化资源
│   ├── package.json           # 前端依赖
│   └── vite.config.ts         # Vite 构建配置
├── internal/                  # 内部模块（Go 约定：不可外部引用）
│   ├── config/                # 配置管理、SQLite 数据库操作
│   ├── fs/                    # 文件系统服务（读写、监听）
│   ├── git/                   # Git 操作服务
│   ├── terminal/              # 终端管理服务（PTY）
│   ├── lsp/                   # LSP 客户端实现
│   └── ai/                    # AI 服务（Provider、聊天、MCP）
├── pkg/                       # 可复用公共包
│   ├── mcp/                   # MCP（Model Context Protocol）框架实现
│   └── utils/                 # 通用工具函数
├── docs/                      # 项目文档
│   ├── ARCHITECTURE.md        # 本文档（架构说明）
│   ├── API.md                 # API 文档
│   └── USER_MANUAL.md         # 用户手册
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI/CD 配置
└── build/                     # 构建产物目录
```

---

## 8. 扩展性设计

### 8.1 新增 AI Provider

1. 在 `internal/ai/provider.go` 中实现 `Provider` 接口
2. 在配置中添加 Provider 参数
3. 前端 `aiService.ts` 无需改动（统一接口）

### 8.2 新增 MCP 工具

1. 在 `pkg/mcp/` 中实现新的 `Tool`
2. 注册到 MCP 工具注册表
3. AI 服务自动发现并使用

### 8.3 新增 LSP 语言支持

1. 安装对应语言的 LSP Server
2. 在 `internal/lsp/client.go` 中注册语言 ID
3. 前端 Monaco 已内置多数语言的语法高亮

---

## 9. 安全考量

- **本地运行**：所有数据（配置、对话、代码）存储在本地，不上传云端
- **Shell 隔离**：终端直接调用用户系统的 Shell，与主进程隔离
- **Git 凭证**：使用系统 Git 的凭证管理（而非自行存储）
- **AI API Key**：存储在本地 SQLite，加密存储（待实现）

---

*最后更新：2026-05-23*
