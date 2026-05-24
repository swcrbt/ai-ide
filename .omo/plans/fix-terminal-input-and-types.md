# 修复终端输入与类型问题

## TL;DR
> 通过 E2E 测试日志发现终端输入失败根因：macOS Hardened Runtime 阻止 `fork/exec /bin/zsh`（`operation not permitted`）。
> 
> **修复步骤**：
> 1. 更新 `wails.json` 引用 `build/darwin/entitlements.plist`
> 2. 重建并验证终端输入（E2E 测试）
> 3. 修复 `GetSettings`/`SaveSettings` 类型不匹配（移除 `JSON.parse` 的 `any` 用法）
> 4. 运行完整测试套件
>
> **预估工作量**：中等（4 个任务，可并行执行 2+3）
> **并行执行**：YES - 2 waves

---

## Context

### 诊断结果（来自 E2E 测试 + 日志分析）
**终端输入失败根因**：
```
ERR | 启动终端失败: 启动 PTY 失败: fork/exec /bin/zsh: operation not permitted
```
- **原因**：macOS Hardened Runtime 的 App Sandbox 阻止了 `fork/exec` 系统调用
- **已创建**：`build/darwin/entitlements.plist` 包含 PTY/JIT/unsigned-memory 权限
- **未配置**：`wails.json` 尚未引用 entitlements 文件，Wails 构建时不会应用

**类型不匹配问题**：
- `GetSettings()` 绑定声明返回 `Promise<string>`，但运行时返回 JS 对象
- `SaveSettings()` 绑定声明接受 `string` 参数，但运行时接受 JS 对象
- `useThemeStore.ts` 和 `useAppStore.ts` 中使用 `JSON.parse` 处理已经是对象的数据

### 架构决策
- **entitlements 方案**：生产构建需要签名+entitlements；`wails dev` 模式下也需要正确配置
- **类型修复方案**：更新前端类型声明与实际运行时行为一致，移除 `JSON.parse` 和 `any`

---

## Work Objectives

### Core Objective
修复终端输入功能（macOS PTY 权限），并解决 `GetSettings`/`SaveSettings` 的类型不匹配问题。

### Concrete Deliverables
- `wails.json` 更新为引用 entitlements.plist
- 终端输入 E2E 测试通过（`ls`/`pwd` 命令有输出）
- `useThemeStore.ts` 和 `useAppStore.ts` 移除 `JSON.parse` 和 `any`
- 完整测试套件通过（Go + Frontend + Playwright）

### Definition of Done
- [x] `wails build` 成功，应用启动后终端可以输入命令并看到输出
- [x] Playwright E2E 测试验证终端输入（`test-terminal-input.js` 通过）
- [x] `go test ./...` 全部通过
- [x] `npm test` 全部通过
- [x] TypeScript 无 `any` 类型错误

### Must Have
- 终端输入功能正常工作（macOS + Linux）
- 类型安全，无 `any` 用法
- E2E 测试覆盖终端功能

### Must NOT Have
- 不引入新的 `any` 类型
- 不修改 PTY 核心逻辑（除非必要）
- 不破坏现有功能

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: YES (Tests-after)
- **Framework**: bun test (frontend), go test (backend), Playwright (GUI)
- **Agent-Executed QA**: MANDATORY for all tasks

### QA Policy
每个任务必须包含 Agent-Executed QA Scenarios。证据保存到 `.sisyphus/evidence/`。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 必须串行):
├── Task 1: 更新 wails.json + 重建验证 [quick]
└── Task 2: 修复类型不匹配 + 移除 any [quick]

Wave 2 (Verification - 并行):
├── Task 3: E2E 测试终端输入 [unspecified-high]
└── Task 4: 完整测试套件验证 [unspecified-high]
```

### Agent Dispatch Summary
- **Wave 1**: 2 quick tasks
- **Wave 2**: 2 unspecified-high tasks (并行)

---

## TODOs

- [x] 1. 更新 wails.json 引用 entitlements.plist

  **What to do**:
  - 编辑 `wails.json` 添加 `info` 字段和 `macos.entitlements` 配置
  - 内容：
    ```json
    {
      "info": {
        "companyName": "swcrbt",
        "productName": "AI IDE",
        "productVersion": "1.0.0",
        "copyright": "Copyright © 2025 swcrbt",
        "comments": "AI驱动的集成开发环境"
      },
      "macos": {
        "entitlements": "build/darwin/entitlements.plist"
      }
    }
    ```
  - 运行 `wails build` 验证构建成功
  - 运行 `wails dev`，检查日志中是否还有 `operation not permitted`

  **Must NOT do**:
  - 不修改 entitlements.plist 内容（已正确配置）
  - 不修改终端核心逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 配置文件修改，简单直接

  **Parallelization**:
  - **Can Run In Parallel**: NO (必须在 Task 2 之前完成)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `wails.json` - Wails 配置文件
  - `build/darwin/entitlements.plist` - 已创建的 entitlements 文件

  **Acceptance Criteria**:
  - [ ] `wails build` 成功完成
  - [ ] `wails dev` 启动无 `operation not permitted` 错误
  - [ ] 应用启动后终端面板可见

  **QA Scenarios**:
  ```
  Scenario: 构建成功且终端无权限错误
    Tool: Bash
    Steps:
      1. cd /Users/swcrbt/develop/github/swcrbt/ai-ide && wails build
      2. grep -i "operation not permitted" /tmp/wails-build.log | wc -l
    Expected Result: 输出为 0（无权限错误）
    Evidence: .sisyphus/evidence/task1-build-success.log
  ```

- [x] 2. 修复 GetSettings/SaveSettings 类型不匹配

  **What to do**:
  - 检查 `frontend/src/stores/useThemeStore.ts` 中的 `GetSettings` 调用
  - 检查 `frontend/src/stores/useAppStore.ts` 中的 `SaveSettings`/`GetSettings` 调用
  - 移除所有 `JSON.parse` 调用（因为数据已经是对象）
  - 更新类型声明与实际运行时行为一致
  - 确保不使用 `any` 类型

  **Must NOT do**:
  - 不修改 Go 后端返回类型（保持当前绑定行为）
  - 不引入 `as any` 或 `@ts-ignore`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: TypeScript 类型修复，简单直接

  **Parallelization**:
  - **Can Run In Parallel**: YES (与 Task 1 并行，不依赖)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `frontend/src/stores/useThemeStore.ts` - 包含 `JSON.parse` 调用
  - `frontend/src/stores/useAppStore.ts` - 包含 `JSON.parse` 调用
  - `frontend/wailsjs/go/main/App.d.ts` - 生成的类型声明

  **Acceptance Criteria**:
  - [ ] `grep -r "JSON.parse" frontend/src/stores/` 返回空
  - [ ] `grep -r ": any" frontend/src/stores/` 返回空
  - [ ] `npx tsc --noEmit` 通过

  **QA Scenarios**:
  ```
  Scenario: 类型检查通过且无 any 用法
    Tool: Bash
    Steps:
      1. cd frontend && npx tsc --noEmit
      2. grep -r "JSON.parse" src/stores/ | wc -l
      3. grep -r ": any" src/stores/ | wc -l
    Expected Result: tsc 通过，JSON.parse 和 any 计数均为 0
    Evidence: .sisyphus/evidence/task2-type-check.log
  ```

- [x] 3. E2E 测试验证终端输入

  **What to do**:
  - 运行 `wails dev` 启动应用
  - 使用 Playwright 打开应用
  - 点击终端区域
  - 输入 `ls` 和 `Enter`
  - 验证终端输出包含 `ls` 和文件列表
  - 输入 `pwd` 和 `Enter`
  - 验证输出包含当前路径
  - 截图保存为证据

  **Must NOT do**:
  - 不修改测试逻辑（除非发现 bug）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`/playwright`]
  - **Reason**: 需要浏览器自动化测试

  **Parallelization**:
  - **Can Run In Parallel**: NO (依赖 Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `frontend/src/components/Terminal/Terminal.tsx` - 终端组件
  - `tests/gui/` - 现有 Playwright 测试

  **Acceptance Criteria**:
  - [ ] 终端可见（`xterm-screen` 存在）
  - [ ] 输入 `ls` 后终端显示文件列表
  - [ ] 输入 `pwd` 后显示当前路径

  **QA Scenarios**:
  ```
  Scenario: 终端输入正常工作
    Tool: Playwright
    Steps:
      1. 启动 wails dev，等待页面加载
      2. 定位 `.xterm-screen` 并点击
      3. 键盘输入 "ls" + Enter
      4. 等待 3 秒
      5. 检查 `.xterm-rows .xterm-row` 文本包含 "ls" 或文件列表
    Expected Result: 终端显示 shell 输出
    Evidence: .sisyphus/evidence/task3-terminal-input.png
  ```

- [x] 4. 完整测试套件验证

  **What to do**:
  - 运行 `go test ./...`
  - 运行 `cd frontend && npm test`
  - 运行 Playwright GUI 测试
  - 验证所有测试通过

  **Must NOT do**:
  - 不跳过失败的测试

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 运行测试套件，验证修复

  **Parallelization**:
  - **Can Run In Parallel**: NO (依赖 Task 2 和 Task 3)
  - **Blocks**: None
  - **Blocked By**: Task 2, Task 3

  **References**:
  - `tests/e2e/` - Go E2E 测试
  - `tests/gui/` - Playwright GUI 测试
  - `frontend/` - 前端测试

  **Acceptance Criteria**:
  - [ ] `go test ./...` 全部通过
  - [ ] `npm test` 全部通过
  - [ ] Playwright 测试全部通过

  **QA Scenarios**:
  ```
  Scenario: 完整测试套件通过
    Tool: Bash
    Steps:
      1. go test ./...
      2. cd frontend && npm test
      3. npx playwright test
    Expected Result: 所有测试通过
    Evidence: .sisyphus/evidence/task4-full-test.log
  ```

---

## Final Verification Wave

- [x] F1. **终端功能验证** — `unspecified-high`
  手动启动应用，验证终端可以输入命令并看到输出。
  Output: `终端输入: PASS`

- [x] F2. **类型检查** — `quick`
  运行 `npx tsc --noEmit`，确保无类型错误。
  Output: `类型检查: PASS`

- [x] F3. **E2E 测试** — `unspecified-high`
  运行 Playwright 终端测试，验证通过。
  Output: `E2E 测试: PASS`

---

## Commit Strategy

- **1**: `fix: 添加 macOS entitlements 配置修复终端输入` - wails.json, build/darwin/entitlements.plist
- **2**: `fix: 修复 GetSettings/SaveSettings 类型不匹配` - useThemeStore.ts, useAppStore.ts
- **3**: `test: 添加终端输入 E2E 测试` - tests/gui/terminal-input.spec.ts
- **4**: `chore: 运行完整测试套件` - (验证提交)

---

## Success Criteria

### Verification Commands
```bash
# 构建成功
wails build

# 终端无权限错误
! grep -i "operation not permitted" /tmp/wails-dev.log

# 类型检查通过
cd frontend && npx tsc --noEmit

# 无 JSON.parse 和 any
grep -r "JSON.parse" frontend/src/stores/ | wc -l  # 应为 0
grep -r ": any" frontend/src/stores/ | wc -l      # 应为 0

# E2E 测试通过
npx playwright test tests/gui/terminal-input.spec.ts
```

### Final Checklist
- [x] 终端可以输入命令并看到输出
- [x] `wails build` 成功
- [x] `wails dev` 无权限错误
- [x] 类型检查通过
- [x] 无 `any` 用法
- [x] 完整测试套件通过
