# Trae SOLO 模式布局重构计划

## 目标
将当前布局重构为 Trae SOLO 模式的三栏布局：
- **左侧**：任务/Git 面板（Tab 切换，无活动栏图标）
- **中间**：动态区域 - 平时 AI 聊天面板（大），点击文件后编辑器（大）+ AI 收缩到底部（小）
- **右侧**：可折叠文件树（折叠后变图标工具栏）
- **底部**：终端（可隐藏）+ AI 面板（收缩时）
- **底部**：状态栏（分支、任务进度、AI状态、行列数、编码、换行符）

---

## 已确认的设计决策

| 决策项 | 选择 |
|--------|------|
| **左侧面板** | Tab 切换任务/Git 面板，**无活动栏图标** |
| **中间区域** | 动态：平时 AI 面板（大）↔ 点击文件后编辑器（大）+ AI 收缩到底部（小） |
| **右侧文件树** | 可折叠，**折叠后变成图标工具栏**（📁📄🔍🌿⚙️） |
| **任务创建** | 简洁表单：标题 + 分支名 + 标签。**自动创建 Git 分支** |
| **分支冲突** | **提示用户选择**（切换或重输） |
| **标签系统** | 预设（BUG=红, feature=蓝, hotfix=绿）+ **支持自定义** |
| **AI 上下文** | **自动注入 Prompt**（用户发送消息时自动附加任务信息） |
| **AI 面板** | 纯聊天界面，**顶部不显示任务信息** |
| **状态栏** | 分支、任务进度、AI状态、行列数、编码、换行符 |

---

## 布局结构

### 平时状态（无文件打开）
```
┌─────────────────────────────────────────────────────────────┐
│ Header (顶部标题栏) h-12                                    │
├────────────────┬─────────────────────┬──────────────────────┤
│ [任务] [Git]   │                     │ 📁 📄 🔍 🌿 ⚙️      │
│ 左侧Tab切换     │   AI Chat Panel     │ 右侧图标栏(折叠时)   │
│                │   (主区域/大)        │                      │
│ 内容区域        │                     │                      │
│ (任务列表或    │   - Message list    │                      │
│  Git面板)      │   - Input box       │                      │
│                │   - DiffPreview     │                      │
└────────────────┴─────────────────────┴──────────────────────┘
│ Terminal (底部，可隐藏)                                     │
├─────────────────────────────────────────────────────────────┤
│ Status Bar (分支|任务|AI状态|行列|编码|换行符)               │
└─────────────────────────────────────────────────────────────┘
```

### 点击文件后（编辑器打开）
```
┌─────────────────────────────────────────────────────────────┐
│ Header (顶部标题栏) h-12                                    │
├────────────────┬─────────────────────┬──────────────────────┤
│ [任务] [Git]   │                     │ 📁 📄 🔍 🌿 ⚙️      │
│ 左侧Tab切换     │   Editor (Monaco)   │ 右侧图标栏(折叠时)   │
│                │   (主区域/大)        │                      │
│ 内容区域        │                     │                      │
│ (任务列表或    │   - Code editing    │                      │
│  Git面板)      │   - Syntax highlight│                      │
│                │   - LSP features    │                      │
└────────────────┼─────────────────────┴──────────────────────┘
│                │ AI Chat (收缩到底部/小)                       │
│ 底部面板       │ Terminal (可切换显示)                        │
└────────────────┴─────────────────────────────────────────────┘
│ Status Bar (分支|任务|AI状态|行列|编码|换行符)               │
└─────────────────────────────────────────────────────────────┘
```

**布局要点：**
- 左侧：**Tab 切换**任务/Git 面板（非上下分栏，无图标）
- 中间：**动态区域** - 平时 AI 面板（大），点击文件后编辑器（大）+ AI 收缩到底部（小）
- 右侧：文件树，**折叠后变成图标工具栏**（📁文件 📄编辑器 🔍搜索 🌿Git ⚙️设置）
- 底部：**终端**（可隐藏）+ **AI 面板**（收缩时显示在底部）

---

## 需要新建的文件

### 1. `frontend/src/stores/useTaskStore.ts`
**功能**：任务状态管理

**数据结构：**
```typescript
interface Task {
  id: string;
  title: string;
  branch: string;          // 关联的 Git 分支
  description?: string;    // 任务描述（可选）
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tag: string;             // 标签名
  tagColor: string;        // 标签颜色（hex）
  createdAt: number;
  updatedAt: number;
}

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  customTags: { name: string; color: string }[];  // 自定义标签
  
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  addCustomTag: (name: string, color: string) => void;
}
```

**预设标签：**
- `BUG`: `#ef4444` (红色)
- `feature`: `#3b82f6` (蓝色)
- `hotfix`: `#22c55e` (绿色)

**自定义标签支持：**
- 用户可以创建新标签，输入名称和选择颜色
- 标签列表存储在 localStorage

**示例任务（默认）：**
```typescript
[
  {
    id: 'task-1',
    title: '实现用户登录功能',
    branch: 'feature/login',
    status: 'in_progress',
    tag: 'feature',
    tagColor: '#3b82f6',
  },
  {
    id: 'task-2',
    title: '修复首页加载慢的问题',
    branch: 'bug/slow-loading',
    status: 'pending',
    tag: 'BUG',
    tagColor: '#ef4444',
  },
]
```

---

### 2. `frontend/src/components/Layout/LeftPanel.tsx`
**功能**：左侧容器（Tab 切换任务/Git）

**布局结构：**
```
┌─────────────────────┐
│ [任务 (3)] [Git (2)]│  <- Tab 切换（顶部）
├─────────────────────┤
│                     │
│   内容区域          │  <- 根据 Tab 显示
│                     │
│                     │
└─────────────────────┘
```

**Tab 设计：**
- 两个 Tab 按钮：`任务 (3)` / `Git (2)`
- 显示数量角标
- 激活态：`border-b-2 border-primary text-primary`
- 非激活态：`text-muted-foreground hover:text-foreground`
- **无图标**（用户明确要求左侧无活动栏图标）

**样式：**
- 宽度：280px（固定）
- 背景：`bg-background`
- 边框：`border-r border-border`

---

### 3. `frontend/src/components/Task/TaskPanel.tsx`
**功能**：任务列表面板

**布局结构：**
```
┌─────────────────────┐
│ 任务 (3)        [+] │  <- 标题栏，右侧有添加按钮
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ 🟢 任务标题      │ │  <- TaskCard
│ │ feature/login    │ │
│ │ [feature]        │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 🔴 任务标题      │ │
│ │ bug/slow-loading │ │
│ │ [BUG]            │ │
│ └─────────────────┘ │
└─────────────────────┘
```

**样式要求：**
- 背景：`bg-background`
- 任务卡片：圆角 `rounded-lg`、边框 `border`、hover 效果
- 激活状态：左侧边框高亮 `border-l-2 border-l-primary bg-accent/50`

**功能：**
- 显示任务列表（按创建时间倒序）
- 标题栏显示任务数量
- 添加按钮（+）打开创建任务弹窗
- 点击任务卡片激活该任务（激活后 AI 自动注入任务上下文）
- 激活任务高亮显示

---

### 4. `frontend/src/components/Task/TaskCard.tsx`
**功能**：单个任务卡片

**Props：**
```typescript
interface TaskCardProps {
  task: Task;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}
```

**样式：**
- 内边距：`p-3`
- 圆角：`rounded-lg`
- 边框：`border border-border`
- hover：`hover:bg-accent hover:border-accent`
- 激活状态：`border-l-2 border-l-primary bg-accent/50`

**内容：**
- 第一行：标签色块（小圆点）+ 任务标题
- 第二行：`🌿 branch-name`（灰色小字）
- 第三行：标签胶囊（彩色背景）
- hover 时右上角显示删除按钮（垃圾桶图标）

---

### 5. `frontend/src/components/Task/TaskCreateDialog.tsx`
**功能**：创建任务弹窗

**表单字段（简洁）：**
1. **任务标题**（输入框，必填）
   - placeholder: "输入任务标题..."
   
2. **关联分支**（输入框，必填）
   - placeholder: "输入分支名..."
   - 说明：系统会自动创建此分支
   
3. **标签**（下拉选择，必选）
   - 选项：BUG（红）、feature（蓝）、hotfix（绿）
   - 支持输入新标签（自动保存为自定义标签）
   - 每个选项显示对应颜色圆点

**按钮：**
- 取消
- 创建（自动执行 `git checkout -b branch-name`）

**分支冲突处理：**
- 如果分支已存在，弹窗提示："分支 feature/login 已存在，是否切换到该分支？"
- 选项：「切换分支」/「重新输入」

---

### 6. `frontend/src/components/Layout/RightPanel.tsx`
**功能**：右侧文件树容器（带折叠/展开功能）

**布局结构（展开时）：**
```
┌─────────────────────┐
│ 资源管理器      [−] │  <- 标题栏，右侧有折叠按钮
├─────────────────────┤
│ 📁 src              │
│   📁 components     │
│   📄 App.tsx        │
│ 📄 package.json     │
└─────────────────────┘
```

**布局结构（折叠后）：**
```
│ 📁 │  <- 垂直图标工具栏（右侧边缘）
│ 📄 │
│ 🔍 │
│ 🌿 │
│ ⚙️ │
```

**折叠按钮行为：**
- 展开时：右上角「−」按钮，点击后折叠
- 折叠后：显示垂直图标栏（宽度 48px），图标包括：
  - 📁 文件资源管理器
  - 📄 编辑器
  - 🔍 搜索
  - 🌿 Git
  - ⚙️ 设置
- 点击图标展开对应面板

**样式：**
- 展开宽度：260px
- 折叠宽度：48px（图标栏）
- 背景：`bg-background`
- 边框：`border-l border-border`
- 过渡动画：`transition-all duration-200`

---

### 7. `frontend/src/components/Layout/BottomPanel.tsx`
**功能**：底部面板（终端 + AI 聊天收缩版）

**布局结构：**
```
┌─────────────────────────────────────────────────────┐
│ [终端] [AI 助手]                        [隐藏] [−] │  <- Tab 切换 + 控制按钮
├─────────────────────────────────────────────────────┤
│                                                     │
│   内容区域（终端 或 AI 聊天）                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Tab 切换：**
- `终端` / `AI 助手`
- 激活态：`border-b-2 border-primary`
- **注意**：AI 助手 Tab 只在 AI 面板收缩到底部时显示

**控制按钮：**
- 隐藏：完全隐藏底部面板
- 最小化：收缩为细条

**样式：**
- 高度：默认 200px，可拖拽调整
- 最小高度：40px（只显示标题栏）
- 背景：`bg-background`
- 边框：`border-t border-border`

---

### 8. `frontend/src/components/Layout/StatusBar.tsx`
**功能**：底部状态栏

**显示信息（从左到右）：**
1. **Git 分支**：`🌿 main` （点击可切换分支）
2. **分隔符**：`|`
3. **任务进度**：`📋 3/5` （已完成/总任务数）
4. **分隔符**：`|`
5. **AI 状态**：`🤖 就绪` / `🤖 思考中...` / `🤖 执行中...`
6. **分隔符**：`|`
7. **光标位置**：`Ln 12, Col 34`（如果有编辑器焦点）
8. **分隔符**：`|`
9. **编码**：`UTF-8`
10. **分隔符**：`|`
11. **换行符**：`LF`
12. **右侧**：语言模式（如 TypeScript）

**样式：**
- 高度：`h-6` (24px)
- 背景：`bg-background`
- 文字：`text-xs text-muted-foreground`
- 边框：`border-t border-border`
- 内边距：`px-3`

---

## 需要修改的文件

### 9. `frontend/src/App.tsx`（重大重构）

**新布局结构：**
```tsx
<div className="h-screen flex flex-col overflow-hidden">
  {/* Header */}
  <header className="h-12 flex-shrink-0">...</header>
  
  {/* Main Content */}
  <div className="flex-1 flex overflow-hidden">
    {/* Left: Task/Git Tab Panel */}
    <LeftPanel className="w-[280px] flex-shrink-0" />
    
    {/* Center: Dynamic Area */}
    <main className="flex-1 flex flex-col min-w-0">
      {/* Editor or AI Chat */}
      {activeFile ? (
        <Editor className="flex-1" />
      ) : (
        <ChatPanel className="flex-1" />
      )}
    </main>
    
    {/* Right: File Tree */}
    <RightPanel className="flex-shrink-0" />
  </div>
  
  {/* Bottom: Terminal + AI (when activeFile) */}
  {activeFile && <BottomPanel className="h-[200px]" />}
  
  {/* Status Bar */}
  <StatusBar />
</div>
```

**关键逻辑：**
```typescript
const [activeFile, setActiveFile] = useState<string | null>(null);
const [fileTreeOpen, setFileTreeOpen] = useState(true);
const [bottomPanelOpen, setBottomPanelOpen] = useState(true);

// 当 activeFile 为 null 时：中间显示 AI Chat（大），底部显示 Terminal
// 当 activeFile 有值时：中间显示 Editor（大），底部显示 AI Chat（收缩版）+ Terminal
```

**移除的组件：**
- 原有的 sidebar/toolbar/GitPanel 直接引用
- TerminalPanel（替换为 BottomPanel）
- SettingsPanel（改为命令面板触发或右侧图标栏）

---

### 10. `frontend/src/components/Chat/ChatPanel.tsx`（调整）

**调整内容：**
1. 移除可折叠逻辑（现在是主区域，不需要折叠）
2. 移除拖拽调整宽度（使用 flex-1 自适应）
3. 移除 `PanelRightOpen`/`PanelRightClose` 按钮
4. **保持**：MessageList、MessageInput、DiffPreview
5. **添加**：自动注入任务上下文逻辑

**AI 上下文自动注入：**
```typescript
// 当用户发送消息时，自动附加任务信息
const sendMessage = (content: string) => {
  const activeTask = useTaskStore.getState().getActiveTask();
  if (activeTask) {
    const contextPrompt = `[任务: ${activeTask.title}](分支: ${activeTask.branch})\n${content}`;
    // 发送 contextPrompt 到 AI
  } else {
    // 发送原始 content
  }
};
```

**注意：** 顶部**不显示**任务信息（用户明确要求）

---

### 11. `frontend/src/components/Explorer/FileTree.tsx`（调整）

**调整内容：**
1. 移除 `isVisible` 切换逻辑（由 RightPanel 控制）
2. 调整样式适配右侧面板
3. 保持文件操作功能（展开/折叠、右键菜单）

---

### 12. `frontend/src/components/Git/GitPanel.tsx`（调整）

**调整内容：**
1. 移除 `border-r`（现在在左侧面板内部，不需要右边框）
2. 移除标题栏（LeftPanel 已提供 Tab 切换）
3. 调整高度自适应（flex-1）
4. 保持所有现有功能（分支显示、文件变更、Stage/Commit）

---

## 数据流设计

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ LeftPanel    │  │ Center       │  │ RightPanel   │      │
│  │ (Task/Git)   │  │ (AI/Editor)  │  │ (File Tree)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ useTaskStore │  │ useChatStore │  │ useExplorer  │      │
│  │              │  │              │  │ Store        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                                 │
│         │                 │                                 │
│         ▼                 ▼                                 │
│  ┌──────────────────────────────────────┐                  │
│  │ useGitStore                           │                  │
│  │ (分支创建、状态查询)                   │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**关键数据流：**
1. **创建任务** → `useTaskStore.addTask()` → 调用 Git API `git checkout -b branch-name`
2. **点击任务** → `useTaskStore.setActiveTask()` → ChatPanel 自动注入上下文
3. **点击文件** → `useExplorerStore` → App.tsx 设置 `activeFile` → 中间显示 Editor
4. **文件打开后** → AI Chat 收缩到底部面板
5. **Git 操作** → `useGitStore` → 更新分支/提交状态

---

## 实施步骤

### Wave 1: 基础 Store 和组件
1. 创建 `useTaskStore.ts`
2. 创建 `TaskCard.tsx`
3. 创建 `TaskCreateDialog.tsx`
4. 创建 `LeftPanel.tsx`

### Wave 2: 布局容器
5. 创建 `RightPanel.tsx`
6. 创建 `BottomPanel.tsx`
7. 创建 `StatusBar.tsx`

### Wave 3: 主布局重构
8. 修改 `App.tsx`（三栏动态布局）
9. 调整 `ChatPanel.tsx`（移除折叠/拖拽，添加上下文注入）
10. 调整 `FileTree.tsx`（适配右侧面板）
11. 调整 `GitPanel.tsx`（适配左侧面板）

### Wave 4: 交互和 Polish
12. 实现文件打开后 AI 收缩动画
13. 实现右侧图标工具栏
14. 实现底部面板 Tab 切换
15. 状态栏实时更新

---

## QA 验证清单

### 布局验证
- [x] 三栏布局正确显示，无重叠
- [x] 左侧 Tab 切换任务/Git 正常
- [x] 右侧文件树可折叠/展开
- [x] 文件树折叠后显示图标工具栏
- [x] 点击文件后中间显示编辑器
- [x] 点击文件后 AI 面板收缩到底部
- [x] 底部终端可隐藏/显示
- [x] 状态栏信息完整显示

### 任务功能验证
- [x] 点击 (+) 打开创建任务弹窗
- [x] 输入标题、分支名、标签后创建任务
- [x] 系统自动执行 `git checkout -b branch-name`
- [x] 分支已存在时提示用户选择（切换或重输）
- [x] 任务卡片显示分支名和标签色
- [x] 点击任务卡片激活（高亮显示）
- [x] hover 显示删除按钮，点击删除任务
- [x] 支持创建自定义标签

### Git 集成验证
- [x] Git 面板显示当前分支
- [x] 显示已修改/已暂存文件列表
- [x] 可 Stage/Unstage 文件
- [x] 可输入提交信息并 Commit

### AI 面板验证
- [x] 消息流正常显示
- [x] 代码块高亮正确
- [x] 输入框可发送消息
- [x] 激活任务后自动注入上下文（Prompt 前附加任务信息）
- [x] DiffPreview 正常显示
- [x] 收缩到底部后仍可正常对话

### 文件树验证
- [x] 显示项目文件结构
- [x] 可展开/折叠目录
- [x] 点击文件在中间打开编辑器
- [x] 折叠后显示图标工具栏
- [x] 点击图标展开对应面板

### 状态栏验证
- [x] 显示当前 Git 分支
- [x] 显示任务进度（已完成/总数）
- [x] 显示 AI 状态（就绪/思考中）
- [x] 显示光标位置（编辑器焦点时）
- [x] 显示编码和换行符

---

## 技术要点

1. **分支自动创建**：创建任务时，通过 Wails Go API 调用 `git checkout -b branch-name`，失败时捕获错误并提示用户
2. **分支冲突处理**：检测分支是否存在，存在则弹窗提示「切换分支」/「重新输入」
3. **标签持久化**：自定义标签存储在 localStorage，应用启动时加载
4. **AI 上下文注入**：在 sendMessage 时自动从 useTaskStore 读取 activeTask，附加到 Prompt 前
5. **动态布局切换**：使用 React state 控制 activeFile，条件渲染 Editor/AI Chat
6. **AI 收缩动画**：使用 CSS transition 实现高度/位置变化动画
7. **图标工具栏**：折叠后使用 flex-col 垂直排列图标按钮
8. **状态栏更新**：使用 Zustand subscribe 监听状态变化，实时更新状态栏

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Git 分支创建失败 | 高 | 捕获错误，弹窗提示用户手动创建或切换 |
| 分支冲突处理复杂 | 中 | 简化提示：仅提供「切换」/「重输」两个选项 |
| AI 收缩动画卡顿 | 中 | 使用 CSS transform 而非 height 动画 |
| 图标工具栏功能不完整 | 低 | Phase 2 补充所有图标功能 |
| 任务数据丢失 | 高 | 后续添加 localStorage 持久化（Phase 2） |

---

## 后续优化（Phase 2）

1. **任务持久化**：将任务数据保存到 localStorage 或后端 SQLite
2. **AI 自动执行**：点击任务后，AI 自动分析并开始执行
3. **多分支任务**：支持一个任务关联多个分支
4. **任务模板**：预设常见任务模板（如"添加新页面"、"修复 Bug"）
5. **拖拽排序**：支持拖拽调整任务顺序
6. **完整图标工具栏**：右侧图标栏支持所有面板切换
