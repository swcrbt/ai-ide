# 内嵌控制台面板 - 设计规格

> **状态：** 已确认，待编写实现计划

**目标：** 在 IDE 底部面板新增"控制台"标签页，捕获 JavaScript `console.*` 输出和未处理异常，实时显示在 UI 中

**方案：** 方案 B — 完整控制台（带过滤、搜索、角标、自动滚动）

---

## 一、数据流

```
console.log("消息")
    ↓
[劫持层] 调用原始 console 方法（保留原生行为）
    ↓
[劫持层] 推送条目到 useConsoleStore.addEntry()
    ↓
[ConsolePanel] 订阅 store，渲染过滤后的消息列表
```

同时捕获：
- `window.onerror` — 未处理的同步异常
- `window.onunhandledrejection` — 未处理的 Promise 拒绝

---

## 二、Store 设计

### useConsoleStore（Zustand）

```typescript
interface ConsoleEntry {
  id: number;
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: number;
  source: 'console' | 'error' | 'unhandledrejection';
  /** 原始 args 保留，用于未来展开对象详情 */
  args: unknown[];
}

interface ConsoleState {
  entries: ConsoleEntry[];   // 环形缓冲，上限 1000 条
  filterLevel: Set<'log'|'error'|'warn'|'info'|'debug'>;
  searchQuery: string;
  autoScroll: boolean;       // 默认 true
  errorCount: number;        // 未读 error（标签页未激活时累加）
  warnCount: number;         // 未读 warn

  addEntry: (entry: Omit<ConsoleEntry, 'id'>) => void;
  clear: () => void;
  setFilterLevel: (level: ConsoleEntry['level'], enabled: boolean) => void;
  setSearchQuery: (query: string) => void;
  setAutoScroll: (on: boolean) => void;
  markAsRead: () => void;
}
```

**环缓冲策略：** entries 超 1000 条时，`addEntry` 调用 `entries.shift()` 丢弃最旧条目。

**序列化：** `args` 中的对象用 `try { JSON.stringify } catch { String }` 转换，防止循环引用和 Symbol。

---

## 三、ConsolePanel 组件

### 布局

```
┌──────────────────────────────────────────────────┐
│ [log✓] [error✓] [warn✓] [info✓] [debug✓]        │ ← 级别过滤（toggle 按钮）
│ 🔍 搜索...                  🗑 清空  ⏸/▶ 自动  │ ← 搜索框 + 操作按钮
├──────────────────────────────────────────────────┤
│ HH:MM:SS  log     项目已加载                     │
│ HH:MM:SS  error   读取文件失败: /path/to/file    │ ← 红色背景
│ HH:MM:SS  warn    未使用的变量 x                 │ ← 黄色背景
│ HH:MM:SS  info    LSP 连接成功                   │ ← 蓝色文字
│ ...                                              │
├──────────────────────────────────────────────────┤
│ 共 156 条 · 已过滤 12 条                          │ ← 底部状态栏
└──────────────────────────────────────────────────┘
```

### 消息行格式

```
[HH:MM:SS.mmm] LEVEL  消息内容
```

- 时间戳：灰色，等宽字体
- LEVEL 标签：加粗，大写
- 消息内容：正常字体

### 颜色方案

| 级别 | 背景 | 文字 | LEVEL 标签色 |
|------|------|------|-------------|
| error | `bg-red-500/10` | `text-red-400` | `text-red-500` |
| warn | `bg-yellow-500/10` | `text-yellow-400` | `text-yellow-500` |
| info | 无 | `text-blue-400` | `text-blue-500` |
| debug | 无 | `text-gray-500` | `text-gray-500` |
| log | 无 | `text-foreground` | `text-muted-foreground` |

### 角标

- 在底部面板标签按钮上显示未读错误/警告数量
- errorCount > 0 显示红色角标
- warnCount > 0 显示黄色角标
- 切换到控制台标签页时调用 `markAsRead()` 清零

---

## 四、集成修改

### 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/stores/useConsoleStore.ts` | **创建** | 控制台状态管理 |
| `frontend/src/components/Console/ConsolePanel.tsx` | **创建** | 控制台面板组件 |
| `frontend/src/components/Layout/BottomPanel.tsx` | **修改** | 扩展 BottomTab 类型，新增 console 标签 |
| `frontend/src/App.tsx` | **修改** | 安装 console 劫持，传递 ConsolePanel |

### BottomPanel 修改

- `BottomTab` 类型：`'terminal' | 'ai'` → `'terminal' | 'ai' | 'console'`
- tabs 数组新增：`{ key: 'console', label: '控制台', icon: Monitor }`
- `children` props 新增 `console: React.ReactNode`
- 标签按钮上叠加角标组件（从 store 读取 errorCount / warnCount）

### App.tsx 修改

1. 类型扩展：`type BottomTab = 'terminal' | 'ai' | 'console'`
2. 新增 useEffect 安装 console 劫持（一次性，不依赖变化）
3. BottomPanel children 添加 `console: <ConsolePanel />`

---

## 五、边界条件

- **循环引用：** args 序列化用 try-catch 包裹，失败则显示 `[无法序列化]`
- **大对象：** message 截断到 500 字符
- **高频输出：** 使用 requestAnimationFrame 批量推送，防止每秒数千条拖慢 UI
- **卸载恢复：** 组件卸载时可选恢复原始 console（对于开发模式，通常不恢复以保证日志持续收集）
- **空状态：** 无消息时显示 "控制台就绪，暂无输出"

---

## 自检

### 1. 占位符扫描

- [x] 无 "待定"、"TODO"
- [x] 所有类型定义完整
- [x] 颜色方案具体（Tailwind class 已列出）
- [x] 边界条件已覆盖

### 2. 内部一致性

- [x] ConsoleEntry.level 与 filterLevel Set 类型一致
- [x] Timestamp 存储为 number，显示格式化为 HH:MM:SS
- [x] 角标逻辑：label → 未读计数 → 切换时清零

### 3. 范围检查

- [x] 单一功能：控制台面板
- [x] 不涉及其他面板修改
- [x] 不涉及后端 Go 代码
