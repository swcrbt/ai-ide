# AI 面板居中与 Chat 样式修复

## TL;DR

> 将 AI 面板（ChatPanel）在编辑器区域改为水平和垂直居中显示，并调整为类似 ChatGPT 的居中对话风格。
> 
> **Deliverables**:
> - `ChatPanel.tsx` 添加居中布局容器
> - `MessageList.tsx` 消息最大宽度限制 + 居中
> - `MessageInput.tsx` 输入框最大宽度 + 居中
> - 空状态欢迎界面居中显示
> 
> **Estimated Effort**: Short (30-60 分钟)
> **Parallel Execution**: NO - 顺序执行（修改有依赖关系）
> **Critical Path**: ChatPanel 布局 → MessageList 消息样式 → MessageInput 输入框样式 → 测试验证

---

## Context

### 原始请求
用户反馈：
1. AI 面板默认没有居中显示
2. AI 面板样式不对，应该是 chat 样式

### 当前实现问题
- `ChatPanel.tsx` 使用 `h-full w-full` 占满整个容器，没有居中
- `MessageList.tsx` 消息气泡使用 `max-w-[85%]` 和 `max-w-[90%]`，没有整体最大宽度限制
- `MessageInput.tsx` 输入框占满宽度，没有居中限制
- 空状态虽然有一定居中，但不够明显

### 目标样式（ChatGPT 风格）
- 消息列表有最大宽度限制（约 768px / 48rem）
- 整体在编辑器区域水平和垂直居中
- 输入框固定在底部，但也有最大宽度并居中
- 空状态欢迎内容居中

---

## Work Objectives

### Core Objective
将 AI 面板改为类似 ChatGPT 的居中对话界面风格。

### Concrete Deliverables
- `frontend/src/components/Chat/ChatPanel.tsx` - 添加居中容器和最大宽度
- `frontend/src/components/Chat/MessageList.tsx` - 消息最大宽度 768px，水平居中
- `frontend/src/components/Chat/MessageInput.tsx` - 输入框最大宽度 768px，水平居中

### Definition of Done
- [ ] 没有文件打开时，AI 面板在编辑器区域水平和垂直居中
- [ ] 消息气泡有最大宽度限制（768px），整体居中
- [ ] 输入框有最大宽度限制（768px），固定在底部并居中
- [ ] 空状态欢迎内容居中显示
- [ ] 底部面板中的 AI 面板也保持一致样式

### Must Have
- 水平和垂直居中
- 最大宽度 768px（48rem）
- ChatGPT 风格的对话布局

### Must NOT Have (Guardrails)
- 不改变终端面板的样式
- 不改变其他组件的布局
- 不修改消息气泡的基本颜色和对齐方式

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Playwright GUI 测试)
- **Automated tests**: 现有 tests/gui/ai.spec.ts
- **Agent-Executed QA**: YES

### QA Policy
每个任务完成后运行 GUI 测试验证视觉效果。

---

## Execution Strategy

### 执行顺序（顺序执行，有依赖关系）

```
Wave 1 (布局框架):
├── Task 1: ChatPanel 添加居中容器 [quick]

Wave 2 (消息样式):
├── Task 2: MessageList 消息最大宽度 + 居中 [quick]

Wave 3 (输入框样式):
├── Task 3: MessageInput 输入框最大宽度 + 居中 [quick]

Wave 4 (验证):
├── Task 4: 运行 GUI 测试验证视觉效果 [quick]
└── Task 5: 手动截图验证 [quick]
```

### 依赖矩阵
- **Task 1**: 无依赖 → 影响 Task 2, 3
- **Task 2**: 依赖 Task 1
- **Task 3**: 依赖 Task 1
- **Task 4, 5**: 依赖 Task 1, 2, 3

---

## TODOs

- [ ] 1. ChatPanel 添加居中布局容器

  **What to do**:
  - 在 `ChatPanel.tsx` 的最外层添加居中容器
  - 使用 `flex items-center justify-center h-full` 实现水平和垂直居中
  - 内部内容区域设置 `max-w-3xl`（768px）和 `w-full`
  - 保持底部面板的 `h-full w-full`（因为底部面板本身不需要居中，它的父容器会处理）

  **Must NOT do**:
  - 不要改变 ChatPanel 的 props 接口
  - 不要影响 DiffPreview 的显示

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 前端 UI 布局调整
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 2, 3

  **References**:
  - `frontend/src/components/Chat/ChatPanel.tsx` - 当前实现
  - `frontend/src/App.tsx:608` - ChatPanel 在 main 区域的使用

  **Acceptance Criteria**:
  - [ ] ChatPanel 在编辑器区域水平和垂直居中
  - [ ] 内容最大宽度 768px

  **QA Scenarios**:
  ```
  Scenario: 空状态居中显示
    Tool: Playwright
    Preconditions: 应用启动，没有打开文件
    Steps:
      1. 打开应用
      2. 确保没有文件被打开
      3. 截图检查 AI 面板位置
    Expected Result: AI 面板（欢迎界面）在编辑器区域水平和垂直居中
    Evidence: .sisyphus/evidence/task-1-empty-state.png
  ```

  **Commit**: YES
  - Message: `style(chat): 添加 AI 面板居中布局容器`
  - Files: `frontend/src/components/Chat/ChatPanel.tsx`

- [ ] 2. MessageList 消息最大宽度与居中

  **What to do**:
  - 修改 `MessageList.tsx` 中的 `MessageBubble` 组件
  - 用户消息容器：将 `max-w-[85%]` 改为 `max-w-3xl mx-auto`
  - AI 消息容器：将 `max-w-[90%]` 改为 `max-w-3xl mx-auto`
  - 确保消息整体在容器内居中
  - 空状态（`messages.length === 0`）已经居中，保持不变

  **Must NOT do**:
  - 不改变消息气泡的对齐方式（用户右对齐，AI 左对齐）
  - 不改变颜色和圆角样式

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 前端 UI 样式调整
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 1

  **References**:
  - `frontend/src/components/Chat/MessageList.tsx` - 当前实现

  **Acceptance Criteria**:
  - [ ] 用户消息有最大宽度 768px 并居中
  - [ ] AI 消息有最大宽度 768px 并居中

  **QA Scenarios**:
  ```
  Scenario: 消息列表居中显示
    Tool: Playwright
    Preconditions: 应用启动，发送一条消息
    Steps:
      1. 打开 AI 面板
      2. 发送一条测试消息
      3. 截图检查消息位置
    Expected Result: 消息气泡在容器内居中，最大宽度 768px
    Evidence: .sisyphus/evidence/task-2-message-center.png
  ```

  **Commit**: YES
  - Message: `style(chat): 消息列表最大宽度限制并居中`
  - Files: `frontend/src/components/Chat/MessageList.tsx`

- [ ] 3. MessageInput 输入框最大宽度与居中

  **What to do**:
  - 修改 `MessageInput.tsx`
  - 在外层容器添加 `max-w-3xl mx-auto`
  - 确保输入框在底部居中显示

  **Must NOT do**:
  - 不改变输入框的基本样式和功能
  - 不改变发送按钮的位置

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 前端 UI 样式调整
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 1

  **References**:
  - `frontend/src/components/Chat/MessageInput.tsx` - 当前实现

  **Acceptance Criteria**:
  - [ ] 输入框容器最大宽度 768px 并居中

  **QA Scenarios**:
  ```
  Scenario: 输入框居中显示
    Tool: Playwright
    Preconditions: 应用启动，打开 AI 面板
    Steps:
      1. 打开 AI 面板
      2. 截图检查输入框位置
    Expected Result: 输入框在底部居中，最大宽度 768px
    Evidence: .sisyphus/evidence/task-3-input-center.png
  ```

  **Commit**: YES
  - Message: `style(chat): 输入框最大宽度限制并居中`
  - Files: `frontend/src/components/Chat/MessageInput.tsx`

- [ ] 4. 运行 GUI 测试验证

  **What to do**:
  - 运行 `npx playwright test tests/gui/ai.spec.ts`
  - 检查测试是否通过
  - 查看截图结果

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 运行测试命令
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 1, 2, 3

  **Acceptance Criteria**:
  - [ ] `npx playwright test tests/gui/ai.spec.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: GUI 测试通过
    Tool: Bash
    Preconditions: 所有修改已完成
    Steps:
      1. 运行 npx playwright test tests/gui/ai.spec.ts
    Expected Result: 测试全部通过
    Evidence: .sisyphus/evidence/task-4-test-result.txt
  ```

  **Commit**: NO

- [ ] 5. 手动截图验证最终效果

  **What to do**:
  - 启动应用
  - 截图空状态
  - 发送消息截图对话状态
  - 检查是否满足 ChatGPT 风格

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 手动验证
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4

  **Acceptance Criteria**:
  - [ ] 空状态截图显示居中
  - [ ] 对话状态截图显示消息居中

  **QA Scenarios**:
  ```
  Scenario: 最终视觉效果验证
    Tool: Playwright
    Preconditions: 应用运行中
    Steps:
      1. 截图空状态
      2. 发送消息
      3. 截图对话状态
    Expected Result: 视觉效果类似 ChatGPT 的居中对话风格
    Evidence: .sisyphus/evidence/task-5-final-empty.png, .sisyphus/evidence/task-5-final-chat.png
  ```

  **Commit**: NO

---

## Final Verification Wave

> 4 个审查代理并行运行。全部通过后才能完成。

- [ ] F1. **Plan Compliance Audit** — `oracle`
  验证：
  - ChatPanel 添加了居中容器
  - MessageList 消息最大宽度 768px
  - MessageInput 输入框最大宽度 768px
  - 没有影响其他组件

- [ ] F2. **Code Quality Review** — `unspecified-high`
  运行 `npm run lint` 或 `npm run build` 检查是否有错误。

- [ ] F3. **Real Manual QA** — `unspecified-high`
  启动应用，手动验证视觉效果。

- [ ] F4. **Scope Fidelity Check** — `deep`
  对比计划中的修改范围，确认没有过度修改。

---

## Commit Strategy

- **Task 1**: `style(chat): 添加 AI 面板居中布局容器` - ChatPanel.tsx
- **Task 2**: `style(chat): 消息列表最大宽度限制并居中` - MessageList.tsx
- **Task 3**: `style(chat): 输入框最大宽度限制并居中` - MessageInput.tsx

---

## Success Criteria

### Verification Commands
```bash
# 构建检查
cd frontend && npm run build

# GUI 测试
npx playwright test tests/gui/ai.spec.ts
```

### Final Checklist
- [x] AI 面板在编辑器区域水平和垂直居中
- [x] 消息最大宽度 768px 并居中
- [x] 输入框最大宽度 768px 并居中
- [x] 空状态欢迎内容居中
- [x] 没有影响其他组件
