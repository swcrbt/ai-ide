# AI IDE

<p align="center">
  <img src="docs/screenshot-placeholder.png" alt="AI IDE Screenshot" width="800">
</p>

<p align="center">
  <a href="https://github.com/swcrbt/ai-ide/releases">
    <img src="https://img.shields.io/github/v/release/swcrbt/ai-ide?style=flat-square" alt="Release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/swcrbt/ai-ide?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/swcrbt/ai-ide/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/swcrbt/ai-ide/ci.yml?style=flat-square" alt="CI">
  </a>
</p>

## 简介 / Introduction

**AI IDE** 是一款基于 Wails 框架构建的跨平台桌面代码编辑器，深度融合 AI 辅助编程能力。它结合了 Go 后端的强大性能与 React 前端的灵活交互，为开发者提供现代化的编码体验。

AI IDE is a cross-platform desktop code editor built on the Wails framework, deeply integrated with AI-assisted programming capabilities. It combines the powerful performance of a Go backend with the flexible interaction of a React frontend to provide a modern coding experience.

### 功能特性 / Features

- **智能代码编辑** / **Smart Code Editing**
  - 基于 Monaco Editor 的专业代码编辑体验，支持语法高亮、自动补全、代码折叠
  - Professional code editing based on Monaco Editor with syntax highlighting, auto-completion, and code folding
  - 集成 LSP (Language Server Protocol)，支持跳转到定义、查找引用、实时诊断
  - Integrated LSP support for go-to-definition, find references, and real-time diagnostics

- **AI 编程助手** / **AI Programming Assistant**
  - 支持多 Provider（Kimi、DeepSeek、GLM、Claude、OpenAI、Ollama）
  - Multi-provider support (Kimi, DeepSeek, GLM, Claude, OpenAI, Ollama)
  - 流式对话交互，实时获取 AI 建议
  - Streaming chat interaction with real-time AI suggestions
  - MCP (Model Context Protocol) 工具扩展，AI 可直接调用代码搜索、网页获取等工具
  - MCP tool extensions allowing AI to directly invoke code search, web fetching, and more

- **内置终端** / **Built-in Terminal**
  - 基于 xterm.js 的完整终端模拟器，支持 PTY
  - Full terminal emulator based on xterm.js with PTY support
  - 支持 zsh/bash，保留你的 Shell 环境
  - Supports zsh/bash, preserving your shell environment

- **Git 集成** / **Git Integration**
  - 可视化 Git 状态面板，实时查看文件变更
  - Visual Git status panel with real-time file change tracking
  - 支持暂存、提交、推送、拉取、分支切换、stash 操作
  - Supports stage, commit, push, pull, branch switch, and stash operations

- **文件浏览器** / **File Explorer**
  - 树形文件浏览，支持文件操作（新建、删除、重命名）
  - Tree-style file explorer with file operations (create, delete, rename)
  - 文件变更实时监听
  - Real-time file change monitoring

- **国际化支持** / **Internationalization**
  - 中文/英文界面切换
  - Chinese/English UI switching
  - 亮色/暗色/跟随系统 三种主题
  - Light, dark, and system-follow themes

---

## 安装 / Installation

### 环境要求 / Requirements

| 依赖 | 版本 | 说明 |
|------|------|------|
| Go | 1.23+ | 后端运行时 |
| Node.js | 18+ | 前端构建 |
| Wails CLI | v2 | 应用构建工具 |

### 安装 Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

验证安装：

```bash
wails version
```

### 克隆项目

```bash
git clone https://github.com/swcrbt/ai-ide.git
cd ai-ide
```

### 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

---

## 快速开始 / Quick Start

### 开发模式

```bash
# 在项目根目录执行
wails dev
```

这会同时启动：
- Go 后端（带热重载）
- Vite 前端开发服务器
- Wails 桥接服务

前端开发服务器地址：`http://localhost:34115`

### 构建生产版本

```bash
# 构建当前平台的应用
wails build

# 构建所有平台（需要对应平台的 SDK）
wails build -platform darwin/universal
wails build -platform linux/amd64
wails build -platform windows/amd64
```

构建产物位于 `build/bin/` 目录。

---

## 技术栈 / Tech Stack

### 后端 / Backend

| 技术 | 用途 |
|------|------|
| Go 1.23 | 后端主语言 |
| Wails v2 | 跨平台桌面应用框架 |
| SQLite | 本地数据存储（配置、对话历史） |
| creack/pty | 伪终端支持 |
| fsnotify | 文件系统事件监听 |

### 前端 / Frontend

| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Tailwind CSS | 样式系统 |
| Monaco Editor | 代码编辑器 |
| xterm.js | 终端模拟器 |
| Zustand | 状态管理 |
| i18next | 国际化 |
| Lucide React | 图标库 |

---

## 项目结构 / Project Structure

```
ai-ide/
├── app.go                     # Wails 应用主结构体
├── main.go                    # 程序入口
├── wails.json                 # Wails 项目配置
├── go.mod / go.sum            # Go 依赖管理
├── frontend/                  # 前端代码
│   ├── src/
│   │   ├── App.tsx            # 主应用组件
│   │   ├── components/        # React 组件
│   │   │   ├── Editor/        # Monaco 编辑器
│   │   │   ├── Terminal/      # 终端面板
│   │   │   ├── Chat/          # AI 对话面板
│   │   │   ├── Git/           # Git 面板
│   │   │   ├── Explorer/      # 文件浏览器
│   │   │   ├── Diff/          # Diff 预览
│   │   │   └── CommandPalette.tsx  # 命令面板
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── services/          # 服务封装（Wails、LSP）
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── config/            # 配置文件（快捷键等）
│   │   └── i18n/              # 国际化资源
│   ├── package.json           # 前端依赖
│   └── vite.config.ts         # Vite 配置
├── internal/                  # 内部模块（不可外部引用）
│   ├── config/                # 配置管理、SQLite 数据库
│   ├── fs/                    # 文件系统服务
│   ├── git/                   # Git 操作服务
│   ├── terminal/              # 终端管理服务
│   ├── lsp/                   # LSP 客户端实现
│   └── ai/                    # AI 服务（Provider、聊天、MCP）
├── pkg/                       # 可复用公共包
│   ├── mcp/                   # MCP 框架实现
│   └── utils/                 # 工具函数
├── docs/                      # 文档
│   ├── API.md                 # API 文档
│   └── USER_MANUAL.md         # 用户手册
├── .github/
│   └── workflows/
│       └── ci.yml             # CI/CD 配置
└── build/                     # 构建产物
```

---

## 贡献指南 / Contributing

欢迎贡献代码、报告问题或提出功能建议！

### 提交 Issue

- 使用中文或英文描述问题
- 提供复现步骤和环境信息（操作系统、Go 版本、Node 版本）
- 如果是 Bug，请附上错误日志

### 提交 Pull Request

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m "feat: add some feature"`
4. 推送到远程：`git push origin feature/your-feature`
5. 创建 Pull Request

### 代码规范

- Go 代码遵循 `gofmt` 和 `golint`
- 前端代码使用 ESLint + Prettier
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范

---

## 许可证 / License

本项目采用 [MIT License](LICENSE) 开源许可。

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/swcrbt">swcrbt</a>
</p>
