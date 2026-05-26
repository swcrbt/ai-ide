# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI IDE is a cross-platform desktop code editor built on [Wails v2](https://wails.io) (Go backend + React/TypeScript frontend). It integrates Monaco Editor, xterm.js terminal, LSP, Git operations, and AI chat with MCP tool support.

## Common Commands

### Development

```bash
# Start full dev mode (Go backend + Vite frontend + Wails bridge)
wails dev

# Frontend dev server only (http://localhost:34115)
cd frontend && npm run dev
```

### Build

```bash
# Build frontend only
cd frontend && npm run build

# Build desktop app for current platform
wails build

# Build for specific platform
wails build -platform darwin/universal
```

### Testing

```bash
# Frontend unit tests (Vitest + jsdom + @testing-library/react)
cd frontend && npx vitest run          # run once
cd frontend && npx vitest              # watch mode

# Run single test file
cd frontend && npx vitest run src/stores/useConsoleStore.test.ts

# E2E tests (Playwright — 要求 wails dev 运行中)
npx playwright test tests/gui/ --reporter=line
PLAYWRIGHT_HEADED=1 npx playwright test tests/gui/

# Go 序列化契约测试
go test ./internal/fs/ -run TestReadFileJSONSerialization -v
```

### 测试规则 — TDD 工作方式

**硬性规则：新增功能必须同时增加单元测试和 E2E 测试。**

工作流程：
1. **先写测试** — 定义期望行为，测试此时会失败
2. **写实现** — 让测试通过，不多不少
3. **重构** — 清理代码，确保测试仍通过

测试覆盖要求：
- **Go 后端**：每个新增 exported 方法必须有对应的 `*_test.go` 测试
- **前端逻辑**：Store、工具函数（如 `getEditorMode`）必须有 Vitest 单元测试
- **前端 UI**：交互组件（如 Dialog）必须有 `@testing-library/react` 测试，覆盖核心交互（打开/确认/取消）
- **E2E**：涉及 IPC 管道的功能（Go → JS → UI）必须有 Playwright E2E 测试，验证真实后端

### Wails Bindings

When Go structs/methods change, regenerate TypeScript bindings:

```bash
wails generate module
```

This updates `frontend/wailsjs/go/` which is auto-generated and should not be hand-edited.

## Architecture

### Frontend-Backend Bridge (Wails)

Go services are exposed to the frontend via Wails bindings. The frontend calls them through auto-generated modules:

- `frontend/wailsjs/go/main/App.js` — Main app methods (settings, chat, projects)
- `frontend/wailsjs/go/fs/FileService.js` — File operations. **ReadFile 返回 base64 字符串**（Go `json.Marshal([]byte)` 的默认行为），不是 `Array<number>`。前端解码：`atob(bytes)` → `Uint8Array.from(binary, c => c.charCodeAt(0))` → `TextDecoder`
- `frontend/wailsjs/go/git/GitService.js` — Git operations
- `frontend/wailsjs/go/terminal/` — Terminal service

Runtime events (backend → frontend) use `window.runtime.EventsOn/EventsEmit`:
- AI streaming: `ai:chunk:<sessionID>`, `ai:done:<sessionID>`, `ai:error:<sessionID>`
- File watcher: `fs:change`, `fs:create`, `fs:delete`
- Terminal: `terminal:data`, `terminal:exit`

### E2E Testing — 必须使用真实环境

**硬性规则：E2E 测试必须连接真实 Wails 后端，禁止使用 mock。**

Mock 会掩盖 IPC 序列化差异。例如 `ReadFile` 返回的 `[]byte` 在真实环境中被 Go `json.Marshal` 序列化为 base64 字符串，而 mock 可能错误地返回 `Array<number>`，导致 `new Uint8Array(base64String)` 产生零长度数组的 bug 无法被测试发现。

#### E2E 测试（`tests/gui/`）

Playwright 连接运行中的 `wails dev` DevServer（`http://localhost:34115`），
通过 websocket IPC bridge 调用真实 Go 后端。

```bash
# 终端 1：启动 wails dev
wails dev

# 终端 2：运行 E2E
npx playwright test tests/gui/ --reporter=line
PLAYWRIGHT_HEADED=1 npx playwright test tests/gui/
```

- 配置：`playwright.config.ts`（baseURL = `http://localhost:34115`）
- 无需 mock，`window.go` 和 `window.runtime` 由 Wails 运行时自动注入
- 测试验证完整 IPC 管道：Go → json.Marshal → base64 → JS → UI

#### Go 序列化契约测试（`internal/fs/service_test.go`）

验证 `json.Marshal([]byte)` → base64 round-trip，不依赖浏览器。

```bash
go test ./internal/fs/ -run TestReadFileJSONSerialization -v
```

### State Management (Zustand)

All stores use Zustand v5 with **individual primitive selectors** (not object selectors) to avoid unnecessary re-renders:

```tsx
// Correct
const errorCount = useConsoleStore((s) => s.errorCount);
const warnCount = useConsoleStore((s) => s.warnCount);

// Wrong — returns new object every time, causes infinite loops
const { errorCount, warnCount } = useConsoleStore((s) => ({
  errorCount: s.errorCount,
  warnCount: s.warnCount,
}));
```

Stores are in `frontend/src/stores/`. Key stores:
- `useEditorStore` — Tabs, file content, diff state
- `useConsoleStore` — Console entries with ring buffer (`MAX_ENTRIES = 1000`), batch `addEntries`
- `useExplorerStore` — File tree, selected path
- `useChatStore` — AI chat sessions and messages
- `useGitStore` — Git status, branch info
- `useThemeStore` — Theme (light/dark/system)

### Console Hijacking

`App.tsx` installs a one-time console hijack in a `useEffect`:
- Intercepts `console.log/error/warn/info/debug`
- Batches entries via `requestAnimationFrame` before pushing to `useConsoleStore`
- Uses `__isHijacked` flag to prevent double-hijacking during HMR
- Calls original console methods with `.bind(console)` to preserve `this`

### Editor Architecture

- `Editor.tsx` — Monaco Editor wrapper with LSP integration
- `LSPProvider.tsx` — Context provider for LSP client
- `TabBar.tsx` — File tabs with dirty indicators
- Editor mode degrades by file size: full LSP (<10MB) → basic LSP → highlight-only → plaintext

### Vite Configuration

`frontend/vite.config.ts` must use `base: './'` because Wails loads resources via `file://` protocol. Absolute paths like `/assets/...` will fail in the desktop environment.

### Backend Structure

```
internal/
  config/    — SQLite settings database
  fs/        — FileService (read/write/watch), FileWatcher
  git/       — GitService (status, commit, branch, stash)
  terminal/  — TerminalService (PTY via creack/pty)
  lsp/       — LSP client implementation
  ai/        — Chat history, provider management, MCP tools
  project/   — Project management
pkg/
  mcp/       — MCP framework implementation
```

`app.go` wires all services together and exposes methods to the frontend via Wails.
