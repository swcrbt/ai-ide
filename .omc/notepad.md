# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->
### 2026-05-23 02:19
### 2026-05-23 02:20
## 多tab + Diff编辑器实现总结

### 创建的文件
1. `frontend/src/stores/useEditorStore.ts` - Zustand编辑器状态管理
   - EditorTab 接口：path, content, language, isDirty
   - DiffState 接口：isOpen, original, modified, language, inlineMode
   - 方法：openFile, closeFile, switchTab, updateContent, markDirty, markClean, openDiff, closeDiff, toggleDiffInlineMode
   - 自动从文件扩展名推断语言类型（支持20+种语言）
   - 关闭tab时自动切换到相邻tab

2. `frontend/src/components/Editor/TabBar.tsx` - 标签栏组件
   - 使用 CSS 变量 --tab-bg/--tab-fg/--tab-active-bg/--tab-active-fg 实现主题适配
   - 未保存状态用圆点标记（bg-primary）
   - 支持滚轮水平滚动
   - 右键关闭、点击切换

3. `frontend/src/components/Editor/DiffViewer.tsx` - Diff对比组件
   - 使用 @monaco-editor/react 的 DiffEditor
   - renderSideBySide 选项控制分屏/内联模式
   - 工具栏有模式切换按钮和关闭按钮

### 修改的文件
4. `frontend/src/components/Editor/Editor.tsx`
   - 移除外部 value/language/onChange props，改为从 useEditorStore 读取
   - 集成 TabBar 和 DiffViewer
   - 无文件时显示欢迎页面

5. `frontend/src/App.tsx`
   - 重构为 IDE 布局：顶部标题栏 + 左侧边栏(预留) + 中间编辑器 + 底部面板(预留) + 状态栏
   - 提供示例文件用于演示多tab功能
   - 集成 useEditorStore 的 openFile

### 修复的既有问题
- `frontend/src/components/Terminal/Terminal.tsx` 的 TypeScript 错误：
  - EventsOn 返回 void 但被当作函数调用 → 改用 EventsOff 清理
  - XTerm.ITerminalOptions 类型引用错误 → 改为从 @xterm/xterm 导入 ITerminalOptions

### 设计系统使用
- Tab 颜色使用 style.css 中定义的 CSS 变量（--tab-bg, --tab-active-bg 等）
- 使用 Tailwind 的 arbitrary value 语法 `bg-[hsl(var(--tab-active-bg))]` 引用 CSS 变量
- 所有组件保持与现有 Editor.tsx 一致的编辑器选项配置

### Build 结果
- `npm run build` 通过，零 TypeScript 错误



## 2026-05-23 02:19
## 2026-05-23 Task: 实现文件浏览器（左侧树 + 按需显示）

### 完成内容
- 创建 `frontend/src/stores/useExplorerStore.ts`: FileNode/GitStatus 类型定义、ExplorerStore（Zustand）管理文件树状态、展开/折叠、选中、可见性控制、模拟数据生成
- 复用已有的 `frontend/src/stores/useEditorStore.ts`: EditorStore 管理标签页、openFile/closeFile/switchTab/updateContent 等方法
- 创建 `frontend/src/components/Explorer/FileTree.tsx`: 文件树容器组件，标题栏显示项目名、刷新按钮、加载状态、空状态提示
- 创建 `frontend/src/components/Explorer/FileTreeNode.tsx`: 单个节点组件，递归渲染，展开/折叠图标、文件类型图标（按扩展名）、Git 状态指示点（黄/绿/红/灰）、缩进层级、点击打开文件
- 创建 `frontend/src/components/Explorer/ContextMenu.tsx`: 基于 Radix UI DropdownMenu 的右键菜单，支持文件/目录不同菜单项（新建文件/文件夹、重命名、删除），危险操作（删除）红色高亮
- 修改 `frontend/src/App.tsx`: 集成文件浏览器到左侧边栏，添加 FolderTree 切换按钮（与编辑器并排布局），文件浏览器宽度 256px 可折叠
- 修复 `frontend/src/components/Terminal/Terminal.tsx` 已存在的 3 个 TypeScript 错误（EventsOn 返回 void 不能调用、XTerm 命名空间误用）

### 验证结果
- `cd frontend && npm run build` 构建成功，无 TypeScript 错误
- JS 产出 646 KiB（含 Monaco Editor），CSS 23 KiB

### 技术要点
- 文件树递归渲染使用 depth 参数控制缩进（paddingLeft: 8 + depth * 16）
- ExplorerStore 使用 Set<string> 管理展开状态，O(1) 查询效率
- 右键菜单使用 Radix UI DropdownMenu 编程控制 open 状态，通过 onContextMenu 事件触发
- Git 状态使用彩色圆点指示：黄色 modified、绿色 added、红色 deleted、灰色 untracked
- 文件图标按扩展名匹配：ts/js -> FileCode、json -> FileJson、md/txt -> FileText、其他 -> FileType
- 目录图标使用 Folder/FolderOpen 区分展开状态
- 与已有 EditorStore 集成：点击文件调用 openFile(path, '') 打开标签页
- ContextMenu 组件通过 asChild + div 包装节点内容，实现右键触发

### 设计决策
- 文件浏览器默认显示（isVisible: true），可通过左侧图标栏按钮切换
- 使用模拟数据演示功能，后续 Task 接入真实后端 API
- 沿用项目 Tailwind + CSS 变量设计系统，使用 sidebar 系列变量
- 注释精简：保留 JSDoc 公共接口文档，移除行内说明注释和 JSX 区域标记


## MANUAL
<!-- User content. Never auto-pruned. -->

