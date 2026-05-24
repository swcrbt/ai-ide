# AI IDE 自研计划

## TL;DR

> **目标**: 基于 Wails v2 + Go + React/TypeScript + Monaco Editor 构建生产级 AI IDE，支持多tab代码编辑、LSP代码智能、AI Agent（含Subagent）、12个MCP工具、Git集成、内置终端、多主题、多语言。
>
> **核心交付物**:
> - Wails v2 桌面应用（macOS优先，跨平台）
> - Monaco Editor 多tab代码编辑器（Diff、LSP、Snippets）
> - Go LSP 客户端（支持8+语言）
> - AI Agent 系统（国产Provider优先 + Subagent实时汇报）
> - 12个MCP工具（grep_app/rtk/webfetch/computer_use等）
> - Git 集成与文件浏览器
> - 内置终端（xterm.js + pty）
> - 多主题系统（暗色/亮色/自定义）
> - 多语言支持（中文/英文）
>
> **预估工作量**: Large（10-12周）
> **并行执行**: YES - 4个Wave + Final Verification
> **关键路径**: 框架搭建 → LSP客户端 → AI Agent核心 → MCP工具 → UI集成 → 系统测试

---

## Context

### 原始需求
用户希望参考 `/Users/swcrbt/develop/github/ai-agents` 下的项目（cc-haha、codex、DeepSeek-TUI、warp），实现一个自研的AI IDE，包含图形界面、MAC端使用、代码标记、LSP服务器、代码DIFF。

### 参考项目分析

**1. cc-haha (Claude Code Haha)**
- 技术栈: Tauri + React + TypeScript + Monaco Editor
- 特点: 桌面端AI IDE，多会话、代码Diff、LSP集成、权限审批、Computer Use、IM接入
- 借鉴: 桌面端架构、AI Agent工作流、Diff实现、权限系统、MCP工具设计

**2. Warp**
- 技术栈: Rust + 自定义UI(warpui) + wgpu
- 特点: 高性能终端，自研LSP客户端(crates/lsp)、编辑器(crates/editor)、AI功能
- 借鉴: LSP实现架构、编辑器设计、模块化组织、Workflows

**3. DeepSeek-TUI**
- 技术栈: Rust + TUI
- 特点: Agent系统、多crate架构、工具调用
- 借鉴: Agent系统设计、工具注册调用机制

**4. codex (OpenAI)**
- 技术栈: Rust + TypeScript
- 特点: CLI工具、AI核心逻辑
- 借鉴: AI交互模式、代码生成流程

**5. RTK (rtk-ai/rtk)**
- 技术栈: Rust
- 特点: CLI代理，减少LLM token消耗60-90%
- 借鉴: 命令输出优化、过滤策略

### 技术决策汇总

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 框架 | Wails v2 | 稳定、生态成熟、单窗口多tab满足需求 |
| 后端 | Go 1.21+ | 并发性能好、系统调用方便 |
| 前端 | React 18 + TypeScript + Vite | 生态成熟、开发效率高 |
| 编辑器 | Monaco Editor | VS Code同款、LSP/Diff/多tab原生支持 |
| 状态管理 | Zustand | 轻量、TypeScript友好 |
| 样式 | Tailwind CSS | utility-first、主题切换方便 |
| 终端 | xterm.js + pty | 完整终端体验 |
| 存储 | SQLite（纯Go） | 轻量、无需外部依赖 |
| Git操作 | 系统git命令 | 功能完整、与cc-haha一致 |
| AI流式 | SSE | 单向流、实现简单 |
| 测试 | TDD | 测试驱动开发 |
| AI Provider | 国产优先 | Kimi→GLM→DeepSeek→Anthropic→OpenAI→Ollama |
| 任务系统 | AI自动分解 | 项目级任务卡片 |
| Subagent | 实时汇报 | 独立汇报、主Agent动态决策 |
| 文件同步 | Watcher+事件 | Go后端fsnotify + Wails事件推送 |
| Git集成 | IDE级别 | 完整图形化操作 |
| 主题 | CSS变量+class | Tailwind CSS变量切换 |
| 启动 | 渐进式加载 | 先框架后内容 |
| 快捷键 | VS Code兼容 | 降低学习成本 |
| LSP配置 | 自动检测 | 开箱即用 |
| AI配置 | 混合模式 | 默认Provider+会话级覆盖 |
| 搜索 | ripgrep | 高性能 |
| 工作区 | 单一 | 左侧切换任务 |
| 自动保存 | 手动 | 未保存状态提示 |
| Diff视图 | 两者支持 | 左右分屏+内联可切换 |
| AI代码应用 | Diff预览 | 全部/分文件/分块应用 |
| 错误处理 | Toast+面板 | 用户友好+详细日志 |
| AI安全 | 模式切换 | 严格/宽松模式 |
| Minimap | 默认隐藏 | 需要时开启 |
| 行号 | 绝对行号 | 标准显示 |
| 编码 | UTF-8 | 自动检测其他编码 |
| 界面语言 | 中+英 | 可切换，默认中文 |
| Snippets | 内置常用 | for/if/func模板 |
| 崩溃恢复 | 手动保存 | 不自动保存草稿 |

### MCP工具清单（12个）

| 工具 | 功能 | 优先级 |
|------|------|--------|
| grep_app | 代码搜索（基于ripgrep） | P0 |
| rtk | 命令输出优化（节省60-90% token） | P0 |
| webfetch | 网页内容获取 | P0 |
| permission_guard | 危险操作审批 | P0 |
| computer_use | 截图/点击/输入 | P1 |
| command_suggest | AI生成终端命令 | P1 |
| code_review | 代码质量审查 | P1 |
| screenshot | 截取界面 | P1 |
| workflow | 命令序列保存 | P2 |
| code_interpreter | 执行代码片段 | P2 |
| documentation | 生成文档 | P2 |
| feishu_im | 飞书IM接入 | P2 |

---

## Work Objectives

### Core Objective
构建一个功能完整的AI IDE桌面应用，集成代码编辑（Monaco）、代码智能（LSP）、AI辅助（Agent + Subagent + 12个MCP工具）、版本控制（Git）、终端，提供AI-first的开发体验，参考Trae Sole模式。

### Concrete Deliverables
1. **可运行的Wails v2应用** - `wails build` 生成macOS应用
2. **多tab代码编辑器** - Monaco Editor支持多文件编辑、Diff、Snippets
3. **LSP代码智能** - 自动补全、跳转定义、查找引用、诊断（8+语言）
4. **AI Agent系统** - 聊天、代码生成、自动修改、多文件重构
5. **Subagent系统** - 并行子代理、实时汇报、动态决策
6. **12个MCP工具** - grep_app/rtk/webfetch/computer_use等
7. **Git集成** - 文件状态、分支管理、Diff查看、图形化操作
8. **内置终端** - xterm.js + pty
9. **多主题系统** - 暗色/亮色/自定义
10. **多语言支持** - 中文/英文切换
11. **完整测试覆盖** - 单元测试、集成测试
12. **文档** - README、架构文档、API文档

### Definition of Done
- [ ] `wails build` 成功生成macOS应用
- [ ] 能打开、编辑、保存文件（多tab）
- [ ] LSP自动补全、跳转正常工作（至少Go/TS/Python）
- [ ] AI聊天能生成代码并应用（Diff预览）
- [ ] Subagent能并行执行多个任务并实时汇报
- [ ] MCP工具能正常调用（至少grep_app/rtk/webfetch）
- [ ] Git状态正确显示，支持基本操作
- [ ] 终端能执行命令
- [ ] 主题能切换（暗色/亮色）
- [ ] 语言能切换（中/英）
- [ ] 所有测试通过
- [ ] 文档完整

### Must Have
- [ ] Wails v2框架搭建
- [ ] Monaco Editor多tab集成
- [ ] Go LSP客户端（至少支持Go/TypeScript/Python）
- [ ] AI Agent基础（聊天、代码生成、Diff应用）
- [ ] Subagent系统（并行执行、实时汇报）
- [ ] 4个P0 MCP工具（grep_app/rtk/webfetch/permission_guard）
- [ ] 文件浏览器
- [ ] Git基础集成（状态、Diff）
- [ ] 内置终端
- [ ] 暗色/亮色主题
- [ ] 中文/英文语言
- [ ] 测试覆盖核心模块

### Must NOT Have (Guardrails)
- [ ] 不实现插件/扩展系统（超出范围）
- [ ] 不实现多窗口（单窗口多tab足够）
- [ ] 不实现远程开发（本地IDE即可）
- [ ] 不实现调试器（基础IDE，调试后续迭代）
- [ ] 不实现复杂的AI训练/微调（仅使用API）
- [ ] 不实现自动保存（手动保存为主）
- [ ] 不实现代码同步/协作（单人IDE）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO（需新建）
- **Automated tests**: TDD
- **Framework**: Go testing + Vitest (前端)
- **TDD流程**: RED（写失败测试）→ GREEN（最小实现）→ REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright - Navigate, interact, assert DOM, screenshot
- **Go Backend**: Go test - Unit tests, integration tests
- **LSP**: Bash - 启动语言服务器，验证通信
- **AI Agent**: Bash (curl) - 调用API，验证响应
- **MCP工具**: Bash - 调用工具，验证输出
- **E2E**: Wails build + 手动验证流程

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 可并行):
├── Task 1: Wails v2 项目脚手架 + 目录结构
├── Task 2: Monaco Editor 基础集成（单文件编辑）
├── Task 3: Go LSP 客户端核心（JSON-RPC通信）
├── Task 4: AI Agent 基础架构（API客户端、Provider管理）
├── Task 5: 文件系统服务（Go后端 + Watcher）
└── Task 6: 项目配置（主题、设置、多语言框架）

Wave 2 (Core Features - 依赖Wave 1):
├── Task 7: Monaco 多tab + Diff编辑器
├── Task 8: LSP 集成 Monaco（自动补全、跳转、诊断）
├── Task 9: AI 聊天面板 + 流式响应
├── Task 10: 文件浏览器（左侧树 + 按需显示）
├── Task 11: Git 集成（状态、Diff、基础操作）
└── Task 12: 内置终端（xterm.js + pty）

Wave 3 (Advanced Features - 依赖Wave 2):
├── Task 13: Subagent 系统（并行执行、实时汇报）
├── Task 14: AI 代码自动修改（Diff预览、分块应用）
├── Task 15: 4个P0 MCP工具（grep_app/rtk/webfetch/permission_guard）
├── Task 16: 多主题系统（暗色/亮色/自定义）
└── Task 17: 键盘快捷键（VS Code兼容）

Wave 4 (MCP Tools & Polish - 依赖Wave 3):
├── Task 18: 8个P1/P2 MCP工具（computer_use/command_suggest等）
├── Task 19: 设置面板 + 配置管理
├── Task 20: 性能优化（虚拟滚动、懒加载）
├── Task 21: 测试补充（边缘情况、集成测试）
└── Task 22: 文档编写 + CI/CD配置

Wave FINAL (Verification):
├── Task F1: 计划合规审计
├── Task F2: 代码质量审查
├── Task F3: E2E测试执行
└── Task F4: 范围保真检查
```

### Dependency Matrix

| Task | 依赖 | 被阻塞 |
|------|------|--------|
| 1 (Wails脚手架) | - | 2,3,4,5,6,12 |
| 2 (Monaco基础) | 1 | 7,8 |
| 3 (LSP核心) | 1 | 8 |
| 4 (AI基础) | 1 | 9,13,14,15 |
| 5 (文件系统) | 1 | 10,11 |
| 6 (配置框架) | 1 | 16,19 |
| 7 (多tab+Diff) | 2 | - |
| 8 (LSP集成) | 2,3 | - |
| 9 (AI聊天) | 4 | - |
| 10 (文件浏览器) | 5 | - |
| 11 (Git) | 5 | - |
| 12 (终端) | 1 | - |
| 13 (Subagent) | 4 | - |
| 14 (代码修改) | 4,8 | - |
| 15 (P0 MCP工具) | 4 | - |
| 16 (主题) | 6 | - |
| 17 (快捷键) | 1 | - |
| 18 (P1/P2 MCP工具) | 15 | - |
| 19 (设置面板) | 6 | - |
| 20 (性能优化) | 全部 | - |
| 21 (测试补充) | 全部 | - |
| 22 (文档+CI/CD) | 全部 | - |

### Agent Dispatch Summary

- **Wave 1**: 6 tasks → `quick` (1,6), `unspecified-high` (3,5), `deep` (2,4)
- **Wave 2**: 6 tasks → `visual-engineering` (7,9,10), `unspecified-high` (11,12), `deep` (8)
- **Wave 3**: 5 tasks → `deep` (13,14,15), `visual-engineering` (16), `quick` (17)
- **Wave 4**: 5 tasks → `unspecified-high` (18,20,21), `visual-engineering` (19), `writing` (22)
- **Wave FINAL**: 4 tasks → `oracle` (F1), `unspecified-high` (F2,F3), `deep` (F4)

---

## TODOs

- [x] 1. Wails v2 项目脚手架 + 目录结构

  **What to do**:
  - 初始化 Wails v2 项目: `wails init -n ai-ide -t react-ts`
  - 创建完整目录结构（frontend/src/components, internal/, pkg/等）
  - 配置 Go modules 和 frontend package.json
  - 设置 Tailwind CSS + Zustand + 多语言框架 (react-i18next)
  - 配置开发环境（热重载、代理）

  **Must NOT do**:
  - 不实现具体业务逻辑
  - 不配置生产构建优化

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 脚手架搭建属于基础配置工作

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 2,3,4,5,6,12
  - **Blocked By**: None

  **References**:
  - Wails docs: `https://wails.io/docs/gettingstarted/firstproject`
  - Tailwind + Vite: `https://tailwindcss.com/docs/guides/vite`
  - Zustand docs: `https://docs.pmnd.rs/zustand/getting-started/introduction`

  **Acceptance Criteria**:
  - [ ] `wails dev` 能正常启动，显示默认页面
  - [ ] `go mod tidy` 无错误
  - [ ] `cd frontend && npm install` 无错误
  - [ ] 目录结构符合设计

  **QA Scenarios**:
  ```
  Scenario: 项目能正常启动
    Tool: Bash
    Preconditions: Go 1.21+, Node.js 18+ 已安装
    Steps:
      1. 运行 `wails dev`
      2. 等待编译完成
      3. 检查窗口是否显示
    Expected Result: 应用窗口正常显示，无报错
    Evidence: .sisyphus/evidence/task-1-start-app.png
  ```

  **Commit**: YES
  - Message: `chore: initialize wails v2 project with react-ts`
  - Files: `wails.json`, `go.mod`, `frontend/package.json`, `frontend/vite.config.ts`

- [x] 2. Monaco Editor 基础集成（单文件编辑）

  **What to do**:
  - 安装 `@monaco-editor/react` 和 `monaco-editor`
  - 创建 Editor 组件，支持单文件编辑
  - 配置基础编辑器选项（字体、主题、行号等）
  - 实现文件打开/保存基本功能
  - 集成到主布局中间区域

  **Must NOT do**:
  - 不实现多tab（Task 7）
  - 不实现LSP连接（Task 8）
  - 不实现Diff编辑器（Task 7）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: Monaco集成涉及复杂配置和生命周期管理

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 7,8
  - **Blocked By**: Task 1

  **References**:
  - Monaco React: `https://github.com/suren-atoyan/monaco-react`
  - gotepad: `/Users/swcrbt/develop/github/ai-agents/gotepad` (Wails + Monaco示例)

  **Acceptance Criteria**:
  - [ ] 能显示 Monaco Editor
  - [ ] 能输入文本
  - [ ] 能设置和获取内容
  - [ ] 暗色主题正确显示

  **QA Scenarios**:
  ```
  Scenario: Monaco Editor正常显示和编辑
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 访问主界面
      2. 检查编辑器区域是否显示
      3. 输入文本 "Hello World"
      4. 验证内容是否正确
    Expected Result: 编辑器显示正常，文本输入有效
    Evidence: .sisyphus/evidence/task-2-monaco-edit.png
  ```

  **Commit**: YES
  - Message: `feat(editor): integrate monaco editor for single file editing`

- [x] 3. Go LSP 客户端核心（JSON-RPC通信）

  **What to do**:
  - 安装 Go LSP 库: `modern-dev/go-lsp` 或自研JSON-RPC客户端
  - 实现 LSP 进程管理（启动/停止/重启语言服务器）
  - 实现 JSON-RPC 通信层（请求/响应/通知）
  - 支持 stdio 传输
  - 实现基础的 Initialize/Shutdown 流程

  **Must NOT do**:
  - 不实现具体LSP功能（补全、跳转等，Task 8）
  - 不支持多语言服务器同时运行（后续迭代）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: LSP协议复杂，需要深入理解JSON-RPC和LSP规范

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  - go-lsp: `https://github.com/modern-dev/go-lsp`
  - agent-lsp: `https://github.com/blackwell-systems/agent-lsp`
  - LSP spec: `https://microsoft.github.io/language-server-protocol/specifications/specification-current/`

  **Acceptance Criteria**:
  - [ ] 能启动 gopls 进程
  - [ ] 能发送 Initialize 请求并收到响应
  - [ ] 能发送 Shutdown 请求
  - [ ] 进程能正常退出

  **QA Scenarios**:
  ```
  Scenario: LSP客户端能正常通信
    Tool: Go test
    Preconditions: gopls 已安装
    Steps:
      1. 启动 LSP 客户端
      2. 发送 Initialize 请求
      3. 验证响应包含服务器能力
      4. 发送 Shutdown 请求
    Expected Result: 所有请求正常响应，无错误
    Evidence: .sisyphus/evidence/task-3-lsp-test.log
  ```

  **Commit**: YES
  - Message: `feat(lsp): implement json-rpc client and process manager`

- [x] 4. AI Agent 基础架构（API客户端、Provider管理）

  **What to do**:
  - 实现 AI Provider 管理器（支持多Provider切换）
  - 实现国产优先策略（Kimi→GLM→DeepSeek→...）
  - 实现 SSE 流式响应处理
  - 实现基础对话历史管理
  - 创建 SQLite 表存储对话历史

  **Must NOT do**:
  - 不实现Subagent（Task 13）
  - 不实现MCP工具（Tasks 15,18）
  - 不实现代码修改功能（Task 14）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: AI架构涉及流式处理、错误恢复、多Provider适配

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 9,13,14,15
  - **Blocked By**: Task 1

  **References**:
  - cc-haha AI实现: `/Users/swcrbt/develop/github/ai-agents/cc-haha/src` (参考其AI调用方式)

  **Acceptance Criteria**:
  - [ ] 能配置多个Provider API Key
  - [ ] 能发送流式请求并接收SSE响应
  - [ ] 能存储和读取对话历史
  - [ ] 国产Provider优先策略生效

  **QA Scenarios**:
  ```
  Scenario: AI流式响应正常工作
    Tool: Go test
    Preconditions: 至少配置了一个有效的AI Provider API Key
    Steps:
      1. 发送测试消息 "Hello"
      2. 验证收到SSE流式响应
      3. 验证响应内容非空
      4. 检查对话历史已保存到SQLite
    Expected Result: 流式响应正常，历史已保存
    Evidence: .sisyphus/evidence/task-4-ai-stream.log
  ```

  **Commit**: YES
  - Message: `feat(ai): implement multi-provider agent with sse streaming`

- [x] 5. 文件系统服务（Go后端 + Watcher）

  **What to do**:
  - 实现文件CRUD操作（读/写/创建/删除/重命名）
  - 集成 fsnotify 实现文件Watcher
  - 实现文件变更事件（创建/修改/删除）推送到前端
  - 实现文件树遍历和缓存

  **Must NOT do**:
  - 不实现Git相关操作（Task 11）
  - 不实现文件搜索（ripgrep，通过MCP工具）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 文件系统涉及并发、Watcher可靠性

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 10,11
  - **Blocked By**: Task 1

  **References**:
  - fsnotify: `https://github.com/fsnotify/fsnotify`

  **Acceptance Criteria**:
  - [ ] 能读取文件内容
  - [ ] 能写入文件
  - [ ] 能监听文件变化并推送事件
  - [ ] 能遍历目录生成文件树

  **QA Scenarios**:
  ```
  Scenario: 文件Watcher正常工作
    Tool: Go test + Bash
    Preconditions: 测试目录存在
    Steps:
      1. 启动Watcher监听目录
      2. 用Bash创建新文件 `touch test.txt`
      3. 验证收到文件创建事件
      4. 修改文件内容
      5. 验证收到文件修改事件
    Expected Result: 所有文件变更事件正确推送
    Evidence: .sisyphus/evidence/task-5-watcher.log
  ```

  **Commit**: YES
  - Message: `feat(fs): implement file system service with fsnotify watcher`

- [x] 6. 项目配置（主题、设置、多语言框架）

  **What to do**:
  - 配置 Tailwind CSS 主题变量（暗色/亮色）
  - 实现主题切换功能（class切换）
  - 配置 react-i18next 多语言框架
  - 实现基础设置结构（SQLite表）
  - 创建默认配置（编辑器字体、缩进等）

  **Must NOT do**:
  - 不实现设置UI界面（Task 19）
  - 不实现复杂主题自定义

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 配置和框架搭建属于基础工作

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 16,19
  - **Blocked By**: Task 1

  **References**:
  - Tailwind dark mode: `https://tailwindcss.com/docs/dark-mode`
  - react-i18next: `https://react.i18next.com/`

  **Acceptance Criteria**:
  - [ ] 暗色/亮色主题能切换
  - [ ] 中英文能切换
  - [ ] 配置能持久化到SQLite
  - [ ] 重启后配置能恢复

  **QA Scenarios**:
  ```
  Scenario: 主题和语言切换正常
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 切换暗色主题
      2. 验证界面变为暗色
      3. 切换英文语言
      4. 验证界面文本变为英文
      5. 重启应用
      6. 验证配置保持
    Expected Result: 主题和语言切换正常，配置持久化
    Evidence: .sisyphus/evidence/task-6-theme-lang.png
  ```

  **Commit**: YES
  - Message: `feat(config): setup theme system and i18n framework`

- [x] 7. Monaco 多tab + Diff编辑器

  **What to do**:
  - 实现多tab管理（打开/关闭/切换文件）
  - 实现 Monaco Diff Editor（左右分屏对比）
  - 支持内联Diff模式切换
  - 实现未保存文件标记（tab上显示圆点）
  - 集成到主布局

  **Must NOT do**:
  - 不实现LSP功能（Task 8）
  - 不实现AI代码修改（Task 14）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: UI组件开发，需要精细的交互设计

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2,6

  **References**:
  - Monaco DiffEditor: `https://microsoft.github.io/monaco-editor/playground.html?example=comparing-diff-editor`

  **Acceptance Criteria**:
  - [ ] 能打开多个文件tab
  - [ ] 能切换tab
  - [ ] 能关闭tab
  - [ ] Diff编辑器能显示左右对比
  - [ ] 未保存文件有标记

  **QA Scenarios**:
  ```
  Scenario: 多tab和Diff正常工作
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 打开文件A
      2. 打开文件B
      3. 验证显示两个tab
      4. 切换tab
      5. 关闭tab A
      6. 打开Diff视图
      7. 验证左右分屏显示
    Expected Result: tab管理正常，Diff显示正确
    Evidence: .sisyphus/evidence/task-7-tabs-diff.png
  ```

  **Commit**: YES
  - Message: `feat(editor): implement multi-tab and diff editor`

- [x] 8. LSP 集成 Monaco（自动补全、跳转、诊断）

  **What to do**:
  - 集成 monaco-languageclient 连接Monaco和Go LSP客户端
  - 实现自动补全（Completion）
  - 实现跳转定义（Go to Definition）
  - 实现查找引用（Find References）
  - 实现诊断显示（Diagnostics/Error Squiggles）
  - 支持至少3种语言（Go/TypeScript/Python）

  **Must NOT do**:
  - 不支持超过5种语言（后续迭代扩展）
  - 不实现代码重构（重命名等，后续迭代）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: LSP协议复杂，需要精确的协议对接

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Tasks 2,3,7

  **References**:
  - monaco-languageclient: `https://github.com/TypeFox/monaco-languageclient`
  - LSP spec: `https://microsoft.github.io/language-server-protocol/specifications/specification-current/`

  **Acceptance Criteria**:
  - [ ] 自动补全能显示建议
  - [ ] 能跳转到定义
  - [ ] 代码错误能显示红色波浪线
  - [ ] 支持Go/TypeScript/Python

  **QA Scenarios**:
  ```
  Scenario: LSP功能正常工作
    Tool: Playwright
    Preconditions: 应用已启动，项目包含Go/TS/Python文件
    Steps:
      1. 打开Go文件
      2. 输入 "fmt." 触发自动补全
      3. 验证补全列表显示
      4. 点击补全项
      5. 验证代码插入正确
      6. 故意输入错误代码
      7. 验证显示错误诊断
    Expected Result: LSP功能完整工作
    Evidence: .sisyphus/evidence/task-8-lsp-features.png
  ```

  **Commit**: YES
  - Message: `feat(lsp): integrate monaco-languageclient for completion and diagnostics`

- [x] 9. AI 聊天面板 + 流式响应

  **What to do**:
  - 实现左侧/右侧AI聊天面板UI
  - 实现消息列表（用户/AI头像、代码块高亮）
  - 集成SSE流式响应显示（打字机效果）
  - 实现代码块渲染（Syntax Highlighting）
  - 实现快捷操作（复制、插入、应用代码）
  - 集成到主布局

  **Must NOT do**:
  - 不实现内联编辑（Task 14）
  - 不实现Subagent（Task 13）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: 聊天UI需要精细的交互和动画

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Tasks 4,6

  **References**:
  - cc-haha聊天UI: `/Users/swcrbt/develop/github/ai-agents/cc-haha/desktop/src` (参考其AI面板设计)

  **Acceptance Criteria**:
  - [ ] 能输入消息并发送
  - [ ] AI回复能流式显示
  - [ ] 代码块能正确高亮
  - [ ] 能复制代码块

  **QA Scenarios**:
  ```
  Scenario: AI聊天正常工作
    Tool: Playwright
    Preconditions: 已配置AI Provider
    Steps:
      1. 打开AI面板
      2. 输入 "写一个hello world"
      3. 发送消息
      4. 验证流式响应显示
      5. 验证代码块渲染
      6. 点击复制按钮
      7. 验证剪贴板内容
    Expected Result: 聊天流式响应正常，代码块可交互
    Evidence: .sisyphus/evidence/task-9-ai-chat.png
  ```

  **Commit**: YES
  - Message: `feat(ai): implement chat panel with streaming response`

- [x] 10. 文件浏览器（左侧树 + 按需显示）

  **What to do**:
  - 实现文件树组件（左侧）
  - 支持展开/折叠目录
  - 支持文件操作（右键菜单：新建/删除/重命名）
  - 集成文件Watcher实时更新
  - 实现按需显示（默认隐藏，按钮切换）
  - 显示Git状态图标（modified/added/deleted）

  **Must NOT do**:
  - 不实现拖拽排序
  - 不实现文件搜索（通过MCP工具）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: 树形组件需要处理大量节点和交互

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Tasks 5,6

  **References**:
  - VS Code文件树设计参考

  **Acceptance Criteria**:
  - [ ] 能显示项目文件树
  - [ ] 能展开/折叠目录
  - [ ] 点击文件能在编辑器打开
  - [ ] 右键能新建/删除/重命名文件

  **QA Scenarios**:
  ```
  Scenario: 文件浏览器正常工作
    Tool: Playwright
    Preconditions: 已打开项目
    Steps:
      1. 显示文件树
      2. 点击目录展开
      3. 点击文件打开
      4. 右键点击文件
      5. 选择重命名
      6. 输入新名称
      7. 验证文件已重命名
    Expected Result: 文件树操作正常
    Evidence: .sisyphus/evidence/task-10-file-tree.png
  ```

  **Commit**: YES
  - Message: `feat(explorer): implement file tree with context menu`

- [x] 11. Git 集成（状态、Diff、基础操作）

  **What to do**:
  - 实现Git状态检测（modified/added/deleted）
  - 在文件树显示Git状态图标
  - 实现Git Diff查看（文件级和项目级）
  - 实现基础Git操作（stage/commit/push/pull）
  - 实现分支切换显示
  - 在左侧任务卡片区域显示Git概要

  **Must NOT do**:
  - 不实现复杂操作（rebase/cherry-pick，后续迭代）
  - 不实现Git历史图形化

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Git操作需要处理各种边缘情况

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Tasks 5,6

  **References**:
  - go-git: `https://github.com/go-git/go-git` (可选，但用户要求系统git命令)

  **Acceptance Criteria**:
  - [ ] 能显示文件Git状态
  - [ ] 能查看文件Diff
  - [ ] 能stage/unstage文件
  - [ ] 能commit（带消息输入框）
  - [ ] 能显示当前分支

  **QA Scenarios**:
  ```
  Scenario: Git集成正常工作
    Tool: Playwright + Bash
    Preconditions: 项目为Git仓库
    Steps:
      1. 修改一个文件
      2. 验证文件树显示modified图标
      3. 点击stage按钮
      4. 输入commit消息
      5. 点击commit
      6. 验证commit成功
    Expected Result: Git操作正常
    Evidence: .sisyphus/evidence/task-11-git-ops.png
  ```

  **Commit**: YES
  - Message: `feat(git): implement git status, diff and basic operations`

- [x] 12. 内置终端（xterm.js + pty）

  **What to do**:
  - 前端集成 xterm.js
  - Go后端通过 pty 启动系统shell（bash/zsh）
  - 实现前后端通信（Wails Events或WebSocket）
  - 实现终端标签切换（与AI面板共享底部区域）
  - 支持复制/粘贴

  **Must NOT do**:
  - 不支持多终端会话（后续迭代）
  - 不支持终端分屏

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 终端集成涉及pty和实时通信

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - xterm.js: `https://xtermjs.org/`
  - pty: `https://github.com/creack/pty`

  **Acceptance Criteria**:
  - [ ] 能显示终端
  - [ ] 能输入命令
  - [ ] 能显示命令输出
  - [ ] 能切换终端/AI标签

  **QA Scenarios**:
  ```
  Scenario: 终端正常工作
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 点击终端标签
      2. 输入 "echo hello"
      3. 按回车
      4. 验证显示 "hello"
      5. 切换到AI标签
      6. 切换回终端标签
      7. 验证历史保留
    Expected Result: 终端输入输出正常，标签切换正常
    Evidence: .sisyphus/evidence/task-12-terminal.png
  ```

  **Commit**: YES
  - Message: `feat(terminal): integrate xterm.js with pty backend`

- [x] 13. Subagent 系统（并行执行、实时汇报）

  **What to do**:
  - 实现 Subagent 管理器（创建/调度/监控）
  - 实现并行执行（goroutine池，最大5个并发）
  - 实现实时汇报机制（通过Channel）
  - 实现主Agent动态决策逻辑
  - 实现超时控制（单个Subagent 5分钟）
  - 实现结果聚合和错误处理

  **Must NOT do**:
  - 不实现Subagent间直接通信（仅通过主Agent）
  - 不支持跨任务Subagent复用

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: 并发调度、状态机、错误恢复

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 4

  **References**:
  - DeepSeek-TUI agent: `/Users/swcrbt/develop/github/ai-agents/DeepSeek-TUI/crates/agent`

  **Acceptance Criteria**:
  - [ ] 能创建并并行运行多个Subagent
  - [ ] Subagent完成时立即汇报
  - [ ] 主Agent能根据汇报动态创建新Subagent
  - [ ] 超时Subagent能自动取消
  - [ ] 所有Subagent结果能正确聚合

  **QA Scenarios**:
  ```
  Scenario: Subagent并行执行和汇报
    Tool: Go test
    Preconditions: AI基础架构已就绪
    Steps:
      1. 创建任务，AI分解为3个子任务
      2. 启动3个Subagent并行执行
      3. 验证Subagent-1完成并立即汇报
      4. 验证主Agent收到汇报
      5. 验证主Agent动态决策（如创建新Subagent）
      6. 等待所有Subagent完成
      7. 验证结果聚合正确
    Expected Result: 并行执行正常，实时汇报正确
    Evidence: .sisyphus/evidence/task-13-subagent.log
  ```

  **Commit**: YES
  - Message: `feat(agent): implement subagent system with real-time reporting`

- [x] 14. AI 代码自动修改（Diff预览、分块应用）

  **What to do**:
  - 实现AI生成代码修改的Diff预览
  - 实现分块显示（新增/删除/修改块）
  - 实现应用选项（全部应用/分文件应用/分块应用）
  - 实现权限审批（危险操作弹出确认）
  - 实现修改历史（可撤销）
  - 集成到聊天面板和内联编辑

  **Must NOT do**:
  - 不实现自动执行（必须用户确认或安全模式）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: Diff算法、文件操作、用户体验

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 4,7,8

  **References**:
  - cc-haha Diff实现: `/Users/swcrbt/develop/github/ai-agents/cc-haha` (参考其代码修改流程)

  **Acceptance Criteria**:
  - [ ] AI生成修改后能显示Diff预览
  - [ ] 能分块显示修改
  - [ ] 能选择性应用某些块
  - [ ] 危险操作弹出确认对话框
  - [ ] 能撤销已应用的修改

  **QA Scenarios**:
  ```
  Scenario: AI代码修改和Diff应用
    Tool: Playwright
    Preconditions: AI聊天正常工作
    Steps:
      1. 请求AI修改代码
      2. 验证显示Diff预览
      3. 选择部分块应用
      4. 验证文件已修改
      5. 点击撤销
      6. 验证文件恢复原状
    Expected Result: Diff预览和应用正常，可撤销
    Evidence: .sisyphus/evidence/task-14-code-modify.png
  ```

  **Commit**: YES
  - Message: `feat(ai): implement code modification with diff preview and block apply`

- [x] 15. 4个P0 MCP工具（grep_app/rtk/webfetch/permission_guard）

  **What to do**:
  - 实现 MCP 工具注册和调用框架
  - 实现 grep_app: 基于ripgrep的代码搜索
  - 实现 rtk: 命令输出优化（包装系统命令）
  - 实现 webfetch: 网页内容获取（转换为Markdown）
  - 实现 permission_guard: 危险操作审批对话框
  - 集成到AI Agent工具调用

  **Must NOT do**:
  - 不实现其他MCP工具（Task 18）
  - 不实现MCP Server（仅Client）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: 工具框架设计、系统集成

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: Task 4

  **References**:
  - rtk: `https://github.com/rtk-ai/rtk` (参考其过滤策略)
  - MCP spec: `https://modelcontextprotocol.io/`

  **Acceptance Criteria**:
  - [ ] grep_app能搜索代码并返回结果
  - [ ] rtk能优化命令输出
  - [ ] webfetch能获取网页内容
  - [ ] permission_guard能弹出确认对话框
  - [ ] AI能调用这些工具

  **QA Scenarios**:
  ```
  Scenario: MCP工具正常工作
    Tool: Go test + Bash
    Preconditions: 工具框架已就绪
    Steps:
      1. 调用grep_app搜索"func main"
      2. 验证返回搜索结果
      3. 调用rtk执行"git status"
      4. 验证返回优化后的输出
      5. 调用webfetch获取"https://example.com"
      6. 验证返回Markdown内容
      7. 调用permission_guard请求删除文件
      8. 验证弹出确认对话框
    Expected Result: 所有P0工具正常工作
    Evidence: .sisyphus/evidence/task-15-mcp-tools.log
  ```

  **Commit**: YES
  - Message: `feat(mcp): implement p0 tools - grep_app, rtk, webfetch, permission_guard`

- [x] 16. 多主题系统（暗色/亮色/自定义）

  **What to do**:
  - 实现暗色/亮色主题切换
  - 使用 Tailwind CSS 变量定义主题色
  - 实现主题持久化（SQLite）
  - 实现 Monaco Editor 主题同步
  - 实现终端主题同步
  - 提供预设主题选择

  **Must NOT do**:
  - 不实现自定义主题编辑器（后续迭代）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: UI主题系统

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Acceptance Criteria**:
  - [ ] 暗色/亮色主题能切换
  - [ ] Monaco编辑器主题同步切换
  - [ ] 终端主题同步切换
  - [ ] 主题配置持久化

  **QA Scenarios**:
  ```
  Scenario: 主题切换同步
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 切换暗色主题
      2. 验证整个界面变为暗色
      3. 验证Monaco编辑器变为暗色
      4. 验证终端变为暗色
      5. 重启应用
      6. 验证主题保持
    Expected Result: 主题切换全局同步，持久化
    Evidence: .sisyphus/evidence/task-16-theme-sync.png
  ```

  **Commit**: YES
  - Message: `feat(theme): implement dark/light theme system with monaco/terminal sync`

- [x] 17. 键盘快捷键（VS Code兼容）

  **What to do**:
  - 实现快捷键系统（基于Mousetrap或自研）
  - 实现VS Code兼容快捷键映射
  - 实现核心快捷键（保存/打开/关闭/搜索/命令面板等）
  - 实现快捷键持久化
  - 显示快捷键提示

  **Must NOT do**:
  - 不实现自定义快捷键编辑器（后续迭代）
  - 不实现Vim模式（后续迭代）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 快捷键属于配置层

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 1

  **Acceptance Criteria**:
  - [ ] Ctrl+S 保存文件
  - [ ] Ctrl+P 打开命令面板
  - [ ] Ctrl+Shift+F 打开搜索
  - [ ] 快捷键能持久化

  **QA Scenarios**:
  ```
  Scenario: 快捷键正常工作
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 修改文件
      2. 按 Ctrl+S
      3. 验证文件已保存
      4. 按 Ctrl+P
      5. 验证命令面板打开
    Expected Result: 核心快捷键正常工作
    Evidence: .sisyphus/evidence/task-17-shortcuts.png
  ```

  **Commit**: YES
  - Message: `feat(shortcuts): implement vscode-compatible keyboard shortcuts`

- [x] 18. 8个P1/P2 MCP工具（computer_use/command_suggest等）

  **What to do**:
  - 实现 computer_use: 截图、点击、输入（基于macOS Accessibility API）
  - 实现 command_suggest: AI生成终端命令建议
  - 实现 code_review: 代码质量分析
  - 实现 screenshot: 截取当前界面
  - 实现 workflow: 保存和复用命令序列
  - 实现 code_interpreter: 执行代码片段（Python/JS/Go）
  - 实现 documentation: 生成函数文档/README
  - 实现 feishu_im: 飞书消息发送/接收
  - 集成所有工具到AI Agent

  **Must NOT do**:
  - 不实现其他IM（微信/钉钉等，后续迭代）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 工具多样化，涉及系统API和外部服务

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 3)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 15

  **Acceptance Criteria**:
  - [ ] computer_use能截图和控制应用
  - [ ] command_suggest能生成命令
  - [ ] code_review能分析代码
  - [ ] screenshot能截取界面
  - [ ] workflow能执行命令序列
  - [ ] code_interpreter能执行代码
  - [ ] documentation能生成文档
  - [ ] feishu_im能发送消息

  **QA Scenarios**:
  ```
  Scenario: P1/P2 MCP工具正常工作
    Tool: Go test + Bash
    Preconditions: P0工具已就绪
    Steps:
      1. 调用computer_use截图
      2. 验证返回图片
      3. 调用command_suggest生成"列出当前目录"
      4. 验证返回命令建议
      5. 调用code_review分析代码
      6. 验证返回审查报告
      7. 调用screenshot截取界面
      8. 验证返回截图
    Expected Result: P1/P2工具正常工作
    Evidence: .sisyphus/evidence/task-18-p1p2-tools.log
  ```

  **Commit**: YES
  - Message: `feat(mcp): implement p1/p2 tools - computer_use, command_suggest, code_review, etc`

- [x] 19. 设置面板 + 配置管理

  **What to do**:
  - 实现设置面板UI（分类导航：通用/编辑器/终端/Git/AI等）
  - 实现搜索功能（快速定位设置项）
  - 实现配置编辑和保存
  - 实现配置导入/导出
  - 集成到主界面（菜单或快捷键打开）

  **Must NOT do**:
  - 不实现云端同步

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: UI表单和交互

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 3)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Acceptance Criteria**:
  - [ ] 能打开设置面板
  - [ ] 能修改配置并保存
  - [ ] 配置能持久化到SQLite
  - [ ] 能搜索设置项

  **QA Scenarios**:
  ```
  Scenario: 设置面板正常工作
    Tool: Playwright
    Preconditions: 应用已启动
    Steps:
      1. 打开设置面板
      2. 修改编辑器字体大小
      3. 保存设置
      4. 验证编辑器字体变化
      5. 重启应用
      6. 验证设置保持
    Expected Result: 设置面板正常，配置持久化
    Evidence: .sisyphus/evidence/task-19-settings.png
  ```

  **Commit**: YES
  - Message: `feat(settings): implement settings panel with search and import/export`

- [x] 20. 性能优化（虚拟滚动、懒加载）

  **What to do**:
  - 实现文件树虚拟滚动（大项目优化）
  - 实现编辑器大文件分层降级策略：
    - <10MB: 完整LSP功能（补全、跳转、诊断）
    - 10-50MB: 基础LSP（语法检查、简单补全），禁用复杂分析（查找引用、重构）
    - 50-100MB: 仅语法高亮，禁用LSP
    - >100MB: 纯文本模式，禁用所有智能功能
  - 实现LSP延迟加载（按需启动语言服务器）
  - 实现AI消息列表虚拟滚动
  - 优化启动时间（代码分割、懒加载）

  **Must NOT do**:
  - 不做过度优化（先保证功能完整）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 性能调优需要 profiling

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 3)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: 全部

  **Acceptance Criteria**:
  - [ ] 文件树能流畅显示10000+文件
  - [ ] 打开10MB文件不卡顿
  - [ ] 启动时间<3秒

  **QA Scenarios**:
  ```
  Scenario: 大项目性能测试
    Tool: Playwright
    Preconditions: 准备大项目（10000+文件）
    Steps:
      1. 打开大项目
      2. 测量文件树加载时间
      3. 验证滚动流畅
      4. 打开10MB文件
      5. 验证编辑器不卡顿
    Expected Result: 性能满足要求
    Evidence: .sisyphus/evidence/task-20-performance.log
  ```

  **Commit**: YES
  - Message: `perf: implement virtual scrolling and lazy loading optimizations`

- [x] 21. 测试补充（边缘情况、集成测试）

  **What to do**:
  - 补充单元测试（覆盖率>70%）
  - 实现集成测试（端到端场景）
  - 测试边缘情况（空文件、大文件、特殊字符等）
  - 测试错误处理（网络错误、LSP崩溃等）
  - 性能测试（基准测试）

  **Must NOT do**:
  - 不追求100%覆盖率（性价比低）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 测试设计和覆盖

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 3)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: 全部

  **Acceptance Criteria**:
  - [ ] 核心模块测试覆盖率>70%
  - [ ] 集成测试通过
  - [ ] 边缘情况测试通过

  **QA Scenarios**:
  ```
  Scenario: 测试套件通过
    Tool: Bash
    Preconditions: 所有代码已完成
    Steps:
      1. 运行 `go test ./... -cover`
      2. 验证覆盖率>70%
      3. 运行 `cd frontend && npm test`
      4. 验证前端测试通过
    Expected Result: 所有测试通过
    Evidence: .sisyphus/evidence/task-21-test-results.log
  ```

  **Commit**: YES
  - Message: `test: add comprehensive unit and integration tests`

- [x] 22. 文档编写 + CI/CD配置

  **What to do**:
  - 编写 README.md（安装、使用、贡献）
  - 编写架构文档（ARCHITECTURE.md）
  - 编写 API 文档（后端接口）
  - 配置 GitHub Actions CI/CD（测试、构建、发布）
  - 编写用户手册

  **Must NOT do**:
  - 不写视频教程（后续迭代）

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []
  - **Reason**: 文档编写

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 3)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: 全部

  **Acceptance Criteria**:
  - [ ] README完整
  - [ ] 架构文档完整
  - [ ] CI/CD配置成功
  - [ ] 能自动构建和发布

  **QA Scenarios**:
  ```
  Scenario: CI/CD正常工作
    Tool: Bash
    Preconditions: GitHub仓库已配置
    Steps:
      1. 推送代码到main分支
      2. 验证GitHub Actions触发
      3. 验证测试通过
      4. 验证构建成功
    Expected Result: CI/CD流水线正常
    Evidence: .sisyphus/evidence/task-22-cicd.log
  ```

  **Commit**: YES
  - Message: `docs: add documentation and setup ci/cd pipeline`

## Final Verification Wave

- [x] F1. **计划合规审计** — `oracle`

  **What to do**:
  - 读取计划 end-to-end
  - 验证所有 Must Have 已实现（读取文件、curl端点、运行命令）
  - 验证所有 Must NOT Have 未实现（搜索禁止模式）
  - 检查证据文件存在于 `.sisyphus/evidence/`
  - 对比交付物与计划

  **Acceptance Criteria**:
  - [ ] Must Have [N/N] 全部实现
  - [ ] Must NOT Have [N/N] 全部未实现
  - [ ] Tasks [N/N] 全部完成
  - [ ] 证据文件完整

  **Output**: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **代码质量审查** — `unspecified-high`

  **What to do**:
  - 运行 `go test ./...` 全部通过
  - 运行 `go vet ./...` 无问题
  - 前端测试通过
  - 审查代码异味（`as any`、空catch、console.log等）
  - 检查AI slop模式（过度注释、过度抽象等）

  **Acceptance Criteria**:
  - [ ] Build [PASS]
  - [ ] Lint [PASS]
  - [ ] Tests [N pass/N fail]
  - [ ] 代码干净无异味

  **Output**: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N/N] | Files [N clean/N issues] | VERDICT`

- [x] F3. **E2E测试执行** — `unspecified-high`

  **What to do**:
  - 构建应用 (`wails build`)
  - 执行核心用户流程（打开项目→编辑文件→AI聊天→Git提交）
  - 测试跨功能集成
  - 测试边缘情况（空项目、大文件、无网络）
  - 截图记录

  **Acceptance Criteria**:
  - [ ] 核心流程通过
  - [ ] 集成功能正常
  - [ ] 边缘情况处理正确

  **Output**: `Core Flow [PASS/FAIL] | Integration [PASS/FAIL] | Edge Cases [N tested] | VERDICT`

- [x] F4. **范围保真检查** — `deep`

  **What to do**:
  - 对比计划与实际实现
  - 检查scope creep（超出计划的实现）
  - 验证交付物完整性
  - 检查跨任务污染

  **Acceptance Criteria**:
  - [ ] 所有计划功能已实现
  - [ ] 无超出范围的实现
  - [ ] 交付物完整

  **Output**: `Tasks [N/N compliant] | Scope [CLEAN/N issues] | Deliverables [COMPLETE/INCOMPLETE] | VERDICT`

---

## Commit Strategy

- 每个Task独立commit
- Commit格式: `type(scope): description`
  - `feat(editor): add multi-tab support`
  - `feat(lsp): implement go-to-definition`
  - `fix(ai): resolve streaming timeout issue`
  - `test(fs): add file watcher tests`
  - `docs(readme): update installation guide`
- 每个commit包含对应的测试

---

## Success Criteria

### Verification Commands
```bash
# 构建应用
wails build

# 运行测试
cd frontend && npm test
cd .. && go test ./...

# 代码检查
go vet ./...

# 构建验证
ls -la build/bin/ai-ide.app
```

### Final Checklist
- [ ] 应用能正常启动
- [ ] 能打开、编辑、保存文件（多tab）
- [ ] LSP自动补全、跳转工作（至少Go/TS/Python）
- [ ] AI聊天能生成代码并显示Diff预览
- [ ] Subagent能并行执行并实时汇报
- [ ] MCP工具能调用（至少grep_app/rtk/webfetch）
- [ ] Git状态正确显示，支持stage/commit
- [ ] 终端能执行命令
- [ ] 主题能切换（暗色/亮色）
- [ ] 语言能切换（中/英）
- [ ] 所有测试通过
- [ ] 文档完整
- [ ] CI/CD配置成功
