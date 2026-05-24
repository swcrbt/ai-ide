# 内嵌控制台面板 - 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 IDE 底部面板新增控制台标签页，捕获 console 输出和未处理异常并实时显示

**架构：** 劫持 console.* → Zustand store（环缓冲 1000 条）→ ConsolePanel 组件（过滤+搜索+角标+自动滚动）→ 集成到 BottomPanel

**技术栈：** React 18 + TypeScript + Zustand v5 + Vitest + @testing-library/react + Tailwind CSS

**规格文档：** `docs/superpowers/specs/2026-05-24-console-panel-design.md`

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `frontend/src/stores/useConsoleStore.ts` | 控制台状态管理（entries + filter + search + 角标） | **创建** |
| `frontend/src/stores/useConsoleStore.test.ts` | Store 单元测试 | **创建** |
| `frontend/src/components/Console/ConsolePanel.tsx` | 控制台面板 UI | **创建** |
| `frontend/src/components/Console/ConsolePanel.test.tsx` | 面板组件测试 | **创建** |
| `frontend/src/components/Layout/BottomPanel.tsx` | 扩展 BottomTab 类型，新增 console 标签 | **修改** |
| `frontend/src/App.tsx` | 安装 console 劫持，传递 ConsolePanel | **修改** |

---

### 任务 1：创建 useConsoleStore

**文件：**
- 创建：`frontend/src/stores/useConsoleStore.ts`
- 创建：`frontend/src/stores/useConsoleStore.test.ts`

- [ ] **步骤 1：编写失败测试**

创建 `frontend/src/stores/useConsoleStore.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore } from './useConsoleStore';

describe('useConsoleStore', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useConsoleStore.setState({
      entries: [],
      filterLevel: new Set(['log', 'error', 'warn', 'info', 'debug']),
      searchQuery: '',
      autoScroll: true,
      errorCount: 0,
      warnCount: 0,
    });
  });

  it('addEntry 应添加条目并自增 id', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'log', message: '测试消息', timestamp: 1000, source: 'console', args: [] });

    const state = useConsoleStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].message).toBe('测试消息');
    expect(state.entries[0].level).toBe('log');
    expect(state.entries[0].id).toBe(1);
  });

  it('id 应自增不重复', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'log', message: '第一条', timestamp: 1000, source: 'console', args: [] });
    store.addEntry({ level: 'error', message: '第二条', timestamp: 2000, source: 'console', args: [] });

    const state = useConsoleStore.getState();
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0].id).toBe(1);
    expect(state.entries[1].id).toBe(2);
  });

  it('entries 超过 1000 条时应移除最旧的', () => {
    const store = useConsoleStore.getState();
    // 添加 1001 条
    for (let i = 0; i < 1001; i++) {
      store.addEntry({ level: 'log', message: `消息${i}`, timestamp: i, source: 'console', args: [] });
    }

    const state = useConsoleStore.getState();
    expect(state.entries).toHaveLength(1000);
    // 最旧的（id=1）已被移除，最老的应该是 id=2
    expect(state.entries[0].id).toBe(2);
  });

  it('clear 应清空所有条目和角标', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'error', message: '错误', timestamp: 1000, source: 'console', args: [] });
    store.addEntry({ level: 'warn', message: '警告', timestamp: 2000, source: 'console', args: [] });

    store.clear();

    const state = useConsoleStore.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.errorCount).toBe(0);
    expect(state.warnCount).toBe(0);
  });

  it('markAsRead 应清零角标', () => {
    const store = useConsoleStore.getState();
    // 直接设置角标计数来模拟未读状态
    useConsoleStore.setState({ errorCount: 5, warnCount: 3 });

    store.markAsRead();

    const state = useConsoleStore.getState();
    expect(state.errorCount).toBe(0);
    expect(state.warnCount).toBe(0);
  });

  it('setFilterLevel 应切换过滤级别', () => {
    const store = useConsoleStore.getState();
    store.setFilterLevel('debug', false);

    const state = useConsoleStore.getState();
    expect(state.filterLevel.has('debug')).toBe(false);

    store.setFilterLevel('debug', true);
    const state2 = useConsoleStore.getState();
    expect(state2.filterLevel.has('debug')).toBe(true);
  });

  it('setSearchQuery 应设置搜索词', () => {
    const store = useConsoleStore.getState();
    store.setSearchQuery('error');

    const state = useConsoleStore.getState();
    expect(state.searchQuery).toBe('error');
  });

  it('setAutoScroll 应切换自动滚动', () => {
    const store = useConsoleStore.getState();
    store.setAutoScroll(false);

    const state = useConsoleStore.getState();
    expect(state.autoScroll).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npm test -- useConsoleStore.test.ts
```

预期：FAIL，报错 "useConsoleStore is not defined" 或模块不存在

- [ ] **步骤 3：实现 useConsoleStore**

创建 `frontend/src/stores/useConsoleStore.ts`：

```typescript
import { create } from 'zustand';

/**
 * 控制台条目
 */
export interface ConsoleEntry {
  id: number;
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: number;
  source: 'console' | 'error' | 'unhandledrejection';
  args: unknown[];
}

/** 环形缓冲上限 */
const MAX_ENTRIES = 1000;

/**
 * 控制台状态
 */
interface ConsoleState {
  entries: ConsoleEntry[];
  filterLevel: Set<'log' | 'error' | 'warn' | 'info' | 'debug'>;
  searchQuery: string;
  autoScroll: boolean;
  errorCount: number;
  warnCount: number;

  addEntry: (entry: Omit<ConsoleEntry, 'id'>) => void;
  clear: () => void;
  setFilterLevel: (level: ConsoleEntry['level'], enabled: boolean) => void;
  setSearchQuery: (query: string) => void;
  setAutoScroll: (on: boolean) => void;
  markAsRead: () => void;
}

let nextId = 1;

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  entries: [],
  filterLevel: new Set(['log', 'error', 'warn', 'info', 'debug']),
  searchQuery: '',
  autoScroll: true,
  errorCount: 0,
  warnCount: 0,

  addEntry: (entry) => {
    const newEntry: ConsoleEntry = { ...entry, id: nextId++ };
    set((state) => {
      const entries = state.entries.length >= MAX_ENTRIES
        ? [...state.entries.slice(1), newEntry]
        : [...state.entries, newEntry];

      // 如果不是当前遍历的错误/警告，递增角标
      const errorCount = entry.level === 'error' ? state.errorCount + 1 : state.errorCount;
      const warnCount = entry.level === 'warn' ? state.warnCount + 1 : state.warnCount;

      return { entries, errorCount, warnCount };
    });
  },

  clear: () => {
    set({ entries: [], errorCount: 0, warnCount: 0, searchQuery: '' });
  },

  setFilterLevel: (level, enabled) => {
    set((state) => {
      const next = new Set(state.filterLevel);
      if (enabled) {
        next.add(level);
      } else {
        next.delete(level);
      }
      return { filterLevel: next };
    });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setAutoScroll: (on) => {
    set({ autoScroll: on });
  },

  markAsRead: () => {
    set({ errorCount: 0, warnCount: 0 });
  },
}));
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npm test -- useConsoleStore.test.ts
```

预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/stores/useConsoleStore.ts frontend/src/stores/useConsoleStore.test.ts
git commit -m "feat: 创建 useConsoleStore（环缓冲 + 过滤 + 搜索 + 角标）"
```

---

### 任务 2：创建 ConsolePanel 组件

**文件：**
- 创建：`frontend/src/components/Console/ConsolePanel.tsx`
- 创建：`frontend/src/components/Console/ConsolePanel.test.tsx`

- [ ] **步骤 1：编写失败测试**

创建 `frontend/src/components/Console/ConsolePanel.test.tsx`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsolePanel } from './ConsolePanel';
import type { ConsoleEntry } from '../../stores/useConsoleStore';

let mockStoreState: {
  entries: ConsoleEntry[];
  filterLevel: Set<string>;
  searchQuery: string;
  autoScroll: boolean;
  errorCount: number;
  warnCount: number;
} = {
  entries: [],
  filterLevel: new Set(['log', 'error', 'warn', 'info', 'debug']),
  searchQuery: '',
  autoScroll: true,
  errorCount: 0,
  warnCount: 0,
};

const mockClear = vi.fn();
const mockSetFilterLevel = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetAutoScroll = vi.fn();

vi.mock('../../stores/useConsoleStore', () => ({
  useConsoleStore: vi.fn((selector?: (s: typeof mockStoreState) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return {
      ...mockStoreState,
      clear: mockClear,
      setFilterLevel: mockSetFilterLevel,
      setSearchQuery: mockSetSearchQuery,
      setAutoScroll: mockSetAutoScroll,
      markAsRead: vi.fn(),
    };
  }),
}));

function setStoreState(partial: Partial<typeof mockStoreState>) {
  mockStoreState = { ...mockStoreState, ...partial };
}

describe('ConsolePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      entries: [],
      filterLevel: new Set(['log', 'error', 'warn', 'info', 'debug']),
      searchQuery: '',
      autoScroll: true,
      errorCount: 0,
      warnCount: 0,
    };
  });

  it('应在无消息时显示空状态', () => {
    render(<ConsolePanel />);
    expect(screen.getByText(/暂无输出/)).toBeInTheDocument();
  });

  it('应显示控制台消息', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '初始化完成', timestamp: 1000, source: 'console', args: [] },
        { id: 2, level: 'error', message: '读取失败', timestamp: 2000, source: 'console', args: [] },
      ],
    });

    render(<ConsolePanel />);
    expect(screen.getByText(/初始化完成/)).toBeInTheDocument();
    expect(screen.getByText(/读取失败/)).toBeInTheDocument();
  });

  it('应显示过滤按钮', () => {
    render(<ConsolePanel />);
    expect(screen.getByText('log')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('warn')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('debug')).toBeInTheDocument();
  });

  it('点击过滤按钮应调用 setFilterLevel', () => {
    render(<ConsolePanel />);
    const errorBtn = screen.getByText('error');
    fireEvent.click(errorBtn);
    expect(mockSetFilterLevel).toHaveBeenCalledWith('error', false);
  });

  it('应显示搜索输入框', () => {
    render(<ConsolePanel />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });

  it('搜索输入应调用 setSearchQuery', () => {
    render(<ConsolePanel />);
    const input = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(input, { target: { value: 'error' } });
    expect(mockSetSearchQuery).toHaveBeenCalledWith('error');
  });

  it('点击清空按钮应调用 clear', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '测试', timestamp: 1000, source: 'console', args: [] },
      ],
    });

    render(<ConsolePanel />);
    const clearBtn = screen.getByTitle('清空');
    fireEvent.click(clearBtn);
    expect(mockClear).toHaveBeenCalled();
  });

  it('过滤后应只显示匹配级别的消息', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '普通日志', timestamp: 1000, source: 'console', args: [] },
        { id: 2, level: 'error', message: '错误信息', timestamp: 2000, source: 'console', args: [] },
      ],
      filterLevel: new Set(['error']), // 只显示 error
    });

    render(<ConsolePanel />);
    expect(screen.queryByText('普通日志')).not.toBeInTheDocument();
    expect(screen.getByText('错误信息')).toBeInTheDocument();
  });

  it('搜索应过滤消息', () => {
    setStoreState({
      entries: [
        { id: 1, level: 'log', message: '初始化完成', timestamp: 1000, source: 'console', args: [] },
        { id: 2, level: 'error', message: '读取文件失败', timestamp: 2000, source: 'console', args: [] },
      ],
      searchQuery: '初始化',
    });

    render(<ConsolePanel />);
    expect(screen.getByText('初始化完成')).toBeInTheDocument();
    expect(screen.queryByText('读取文件失败')).not.toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npm test -- ConsolePanel.test.tsx
```

预期：FAIL，ConsolePanel 组件不存在

- [ ] **步骤 3：实现 ConsolePanel 组件**

创建 `frontend/src/components/Console/ConsolePanel.tsx`：

```typescript
import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Trash2, Pause, Play } from 'lucide-react';
import { useConsoleStore, type ConsoleEntry } from '../../stores/useConsoleStore';

/** 级别颜色映射 */
const LEVEL_STYLES: Record<ConsoleEntry['level'], { bg: string; text: string; label: string }> = {
  error: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'text-red-500' },
  warn: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'text-yellow-500' },
  info: { bg: '', text: 'text-blue-400', label: 'text-blue-500' },
  debug: { bg: '', text: 'text-gray-500', label: 'text-gray-500' },
  log: { bg: '', text: 'text-foreground', label: 'text-muted-foreground' },
};

/** 级别显示标签 */
const LEVEL_LABELS: Record<ConsoleEntry['level'], string> = {
  log: 'LOG',
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
};

/** 时间戳格式化 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 所有可过滤级别 */
const ALL_LEVELS: ConsoleEntry['level'][] = ['log', 'error', 'warn', 'info', 'debug'];

/**
 * 内嵌控制台面板
 *
 * 捕获 console.* 输出并实时显示，支持按级别过滤、关键词搜索、
 * 清空、自动滚动等功能。
 */
export function ConsolePanel() {
  const entries = useConsoleStore((s) => s.entries);
  const filterLevel = useConsoleStore((s) => s.filterLevel);
  const searchQuery = useConsoleStore((s) => s.searchQuery);
  const autoScroll = useConsoleStore((s) => s.autoScroll);
  const clear = useConsoleStore((s) => s.clear);
  const setFilterLevel = useConsoleStore((s) => s.setFilterLevel);
  const setSearchQuery = useConsoleStore((s) => s.setSearchQuery);
  const setAutoScroll = useConsoleStore((s) => s.setAutoScroll);

  const listRef = useRef<HTMLDivElement>(null);

  // 过滤 + 搜索
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!filterLevel.has(e.level)) return false;
      if (searchQuery && !e.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterLevel, searchQuery]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (autoScroll && filteredEntries.length > 0) {
      scrollToBottom();
    }
  }, [filteredEntries.length, autoScroll, scrollToBottom]);

  const handleClear = () => {
    clear();
  };

  const handleToggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
  };

  const filteredCount = entries.length - filteredEntries.length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 过滤栏 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border flex-shrink-0 flex-wrap">
        {ALL_LEVELS.map((level) => {
          const active = filterLevel.has(level);
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(level, !active)}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer ${
                active
                  ? `${LEVEL_STYLES[level].bg} ${LEVEL_STYLES[level].label} font-medium`
                  : 'text-muted-foreground opacity-40 hover:opacity-70'
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>

      {/* 搜索 + 操作栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border flex-shrink-0">
        <Search size={12} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索控制台输出..."
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={handleToggleAutoScroll}
          className="p-1 rounded hover:bg-accent transition-colors cursor-pointer"
          title={autoScroll ? '停止自动滚动' : '开启自动滚动'}
        >
          {autoScroll ? <Pause size={12} className="text-muted-foreground" /> : <Play size={12} className="text-muted-foreground" />}
        </button>
        <button
          onClick={handleClear}
          className="p-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
          title="清空"
        >
          <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 overflow-auto font-mono text-xs leading-5">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            控制台就绪，暂无输出
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const style = LEVEL_STYLES[entry.level];
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-2 px-2 py-0.5 ${style.bg} hover:brightness-110 transition-colors`}
              >
                <span className="text-muted-foreground flex-shrink-0 select-none">
                  {formatTime(entry.timestamp)}
                </span>
                <span className={`font-semibold flex-shrink-0 select-none ${style.label}`}>
                  {LEVEL_LABELS[entry.level]}
                </span>
                <span className={`break-all ${style.text}`}>
                  {entry.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border text-[11px] text-muted-foreground flex-shrink-0">
        <span>共 {entries.length} 条</span>
        {filteredCount > 0 && (
          <span>已过滤 {filteredCount} 条</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npm test -- ConsolePanel.test.tsx
```

预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/Console/ConsolePanel.tsx frontend/src/components/Console/ConsolePanel.test.tsx
git commit -m "feat: 创建 ConsolePanel 组件（过滤+搜索+自动滚动+清空）"
```

---

### 任务 3：修改 BottomPanel 扩展控制台标签

**文件：**
- 修改：`frontend/src/components/Layout/BottomPanel.tsx`

- [ ] **步骤 1：修改 BottomPanel 新增 console 标签**

修改 `frontend/src/components/Layout/BottomPanel.tsx`：

**修改 Props 类型（第 4-12 行）：**

```typescript
// 修改前
export interface BottomPanelProps {
  activeTab: 'terminal' | 'ai';
  onTabChange: (tab: 'terminal' | 'ai') => void;
  onHide: () => void;
  children: {
    terminal: React.ReactNode;
    aiChat: React.ReactNode;
  };
}

// 修改后
export type BottomTab = 'terminal' | 'ai' | 'console';

export interface BottomPanelProps {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  onHide: () => void;
  children: {
    terminal: React.ReactNode;
    aiChat: React.ReactNode;
    console: React.ReactNode;
  };
}
```

**修改导入（第 2 行）：**

```typescript
// 修改前
import { TerminalSquare, Bot, X, Minus } from 'lucide-react';

// 修改后
import { TerminalSquare, Bot, Monitor, X, Minus } from 'lucide-react';
```

**修改 tabs 数组（第 72-75 行）：**

```typescript
// 修改前
const tabs = [
  { key: 'terminal' as const, label: '终端', icon: TerminalSquare },
  { key: 'ai' as const, label: 'AI 助手', icon: Bot },
];

// 修改后
const tabs = [
  { key: 'terminal' as const, label: '终端', icon: TerminalSquare },
  { key: 'console' as const, label: '控制台', icon: Monitor },
  { key: 'ai' as const, label: 'AI 助手', icon: Bot },
];
```

**修改内容区域渲染（第 137 行）：**

```typescript
// 修改前
{isTerminal ? children.terminal : children.aiChat}

// 修改后
{activeTab === 'terminal' ? children.terminal
  : activeTab === 'console' ? children.console
    : children.aiChat}
```

同时移除第 70 行的 `const isTerminal = activeTab === 'terminal';`（不再需要）。

**添加角标显示（在标签按钮内部）：**

在标签按钮的 `<span>{tab.label}</span>` 后添加角标逻辑。需要引入 `useConsoleStore`：

```typescript
// 在组件顶部添加导入
import { useConsoleStore } from '../../stores/useConsoleStore';

// 在组件函数体内添加
const { errorCount, warnCount } = useConsoleStore((s) => ({
  errorCount: s.errorCount,
  warnCount: s.warnCount,
}));

// 在标签按钮内，tab.label 后面添加角标
{tab.key === 'console' && (errorCount > 0 || warnCount > 0) && (
  <span className="ml-1 flex items-center gap-0.5">
    {errorCount > 0 && (
      <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
        {errorCount}
      </span>
    )}
    {warnCount > 0 && (
      <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-bold rounded-full bg-yellow-500 text-white">
        {warnCount}
      </span>
    )}
  </span>
)}
```

- [ ] **步骤 2：TypeScript 编译检查**

```bash
cd frontend && npx tsc --noEmit
```

预期：无 TypeScript 错误

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/components/Layout/BottomPanel.tsx
git commit -m "feat: BottomPanel 新增控制台标签页（含角标）"
```

---

### 任务 4：集成到 App.tsx 并安装 console 劫持

**文件：**
- 修改：`frontend/src/App.tsx`

- [ ] **步骤 1：修改 App.tsx 类型定义和导入**

在 `frontend/src/App.tsx` 顶部添加导入：

```typescript
// 在现有导入之后添加
import { ConsolePanel } from './components/Console/ConsolePanel';
import { useConsoleStore } from './stores/useConsoleStore';
```

修改 BottomTab 类型（第 54 行）：

```typescript
// 修改前
type BottomTab = 'terminal' | 'ai';

// 修改后
type BottomTab = 'terminal' | 'ai' | 'console';
```

- [ ] **步骤 2：安装 console 劫持 useEffect**

在 App 组件函数体内，`showAppToast` 定义之后（第 117 行附近）添加：

```typescript
// 安装 console 劫持（仅一次）
useEffect(() => {
  const store = useConsoleStore.getState();

  // 序列化参数（安全处理循环引用和 Symbol）
  function safeStringify(value: unknown): string {
    try {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    } catch {
      return '[无法序列化]';
    }
  }

  // 劫持 console 方法
  const methods = ['log', 'error', 'warn', 'info', 'debug'] as const;
  const originals: Record<string, (...args: unknown[]) => void> = {};

  methods.forEach((method) => {
    originals[method] = (console as Record<string, (...args: unknown[]) => void>)[method];

    (console as Record<string, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
      // 调用原始方法
      originals[method](...args);

      // 推送条目
      const message = args.map(safeStringify).join(' ');
      store.addEntry({
        level: method,
        message: message.length > 500 ? message.slice(0, 500) + '...' : message,
        timestamp: Date.now(),
        source: 'console',
        args,
      });
    };
  });

  // 捕获未处理的同步异常
  const prevOnError = window.onerror;
  window.onerror = (msg, url, line, col, error) => {
    store.addEntry({
      level: 'error',
      message: error instanceof Error
        ? `${error.name}: ${error.message} (${url}:${line}:${col})`
        : `${String(msg)} (${url}:${line}:${col})`,
      timestamp: Date.now(),
      source: 'error',
      args: [error],
    });
    if (prevOnError) {
      prevOnError.call(window, msg, url, line, col, error);
    }
    return false;
  };

  // 捕获未处理的 Promise 拒绝
  const prevOnUnhandled = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    store.addEntry({
      level: 'error',
      message: `未处理的 Promise 拒绝: ${safeStringify(event.reason)}`,
      timestamp: Date.now(),
      source: 'unhandledrejection',
      args: [event.reason],
    });
    if (prevOnUnhandled) {
      prevOnUnhandled.call(window, event);
    }
  };

  // 清理函数（恢复原始方法）
  return () => {
    methods.forEach((method) => {
      (console as Record<string, (...args: unknown[]) => void>)[method] = originals[method];
    });
    window.onerror = prevOnError;
    window.onunhandledrejection = prevOnUnhandled;
  };
}, []);
```

- [ ] **步骤 3：在 BottomPanel children 中添加 console**

修改第 590-598 行的 BottomPanel children：

```typescript
// 修改前
{{
  terminal: (
    <Suspense fallback={<LoadingFallback message="终端加载中..." />}>
      <Terminal theme={resolvedTheme} />
    </Suspense>
  ),
  aiChat: <ChatPanel />,
}}

// 修改后
{{
  terminal: (
    <Suspense fallback={<LoadingFallback message="终端加载中..." />}>
      <Terminal theme={resolvedTheme} />
    </Suspense>
  ),
  console: <ConsolePanel />,
  aiChat: <ChatPanel />,
}}
```

- [ ] **步骤 4：TypeScript 编译检查**

```bash
cd frontend && npx tsc --noEmit
```

预期：无 TypeScript 错误

- [ ] **步骤 5：运行全量测试**

```bash
cd frontend && npm test
```

预期：全部测试通过

- [ ] **步骤 6：Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: 安装 console 劫持，集成 ConsolePanel 到底部面板"
```

---

### 任务 5：最终验证

- [ ] **步骤 1：构建验证**

```bash
cd frontend && npm run build
```

预期：构建成功，无错误

- [ ] **步骤 2：启动应用手动验证**

```bash
wails dev
```

手动验证步骤：
1. 点击底部面板"控制台"标签页 → 应显示 "控制台就绪，暂无输出"
2. 在代码中触发 `console.log('测试消息')` 或点击文件 → 应看到日志出现在控制台面板
3. 点击 error 过滤按钮切换 → 应过滤对应级别的消息
4. 在搜索框输入关键词 → 应过滤匹配的消息
5. 点击清空按钮 → 应清空所有消息
6. 触发 `console.error` → 标签页角标应显示红色数字

- [ ] **步骤 3：Commit**

```bash
git add .
git commit -m "chore: 最终验证通过"
```

---

## 自检

### 1. 规格覆盖度

| 规格需求 | 任务 |
|---------|------|
| 劫持 console.* 并保留原生行为 | 任务 4（步骤 2） |
| 捕获 onerror / unhandledrejection | 任务 4（步骤 2） |
| Zustand store（环缓冲 1000） | 任务 1 |
| ConsolePanel（过滤栏 + 搜索 + 清空 + 自动滚动） | 任务 2 |
| 颜色方案（error 红 / warn 黄 / info 蓝 / debug 灰） | 任务 2（步骤 3，LEVEL_STYLES） |
| 时间戳格式 HH:MM:SS.mmm | 任务 2（步骤 3，formatTime） |
| 底部状态栏 | 任务 2（步骤 3） |
| 标签页角标 | 任务 3（步骤 1） |
| 空状态提示 | 任务 2（步骤 3） |
| 安全序列化（循环引用 / Symbol） | 任务 4（步骤 2，safeStringify） |
| 消息截断 500 字符 | 任务 4（步骤 2） |

### 2. 占位符扫描

- [x] 无 "待定"、"TODO"、"后续实现"
- [x] 所有步骤包含完整代码
- [x] 无 "类似任务 N" 引用
- [x] 无 "适当处理"、"添加验证" 等模糊表述

### 3. 类型一致性

- [x] ConsoleEntry.level 类型：`'log' | 'error' | 'warn' | 'info' | 'debug'`
- [x] BottomTab 类型：`'terminal' | 'ai' | 'console'`
- [x] useConsoleStore.filterLevel 为 `Set<ConsoleEntry['level']>`
- [x] addEntry 接受 `Omit<ConsoleEntry, 'id'>`
- [x] LEVEL_STYLES 覆盖全部 level 值
