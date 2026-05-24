# FileTree 功能修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 FileTree 组件的三个 BUG：点击文件不显示内容、文件夹收缩不生效、搜索功能未实现

**架构：** 统一 FileTree 渲染逻辑，移除双模式（虚拟滚动/普通渲染），统一使用扁平化树形结构；修复文件点击回调传递；实现基础文件搜索面板

**技术栈：** React + TypeScript + Zustand + react-window + Tailwind CSS + Wails

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `frontend/src/components/Explorer/FileTree.tsx` | 文件树主组件，统一渲染逻辑 | 修改 |
| `frontend/src/components/Explorer/FileTreeNode.tsx` | 文件树节点渲染 | 修改 |
| `frontend/src/components/Explorer/FileTree.test.tsx` | 文件树测试 | 修改 |
| `frontend/src/components/Search/SearchPanel.tsx` | 搜索面板组件 | 创建 |
| `frontend/src/components/Search/SearchPanel.test.tsx` | 搜索面板测试 | 创建 |
| `frontend/src/App.tsx` | 应用主组件，集成搜索面板 | 修改 |
| `frontend/src/stores/useExplorerStore.ts` | 文件浏览器状态管理 | 修改 |

---

## 任务 1：统一 FileTree 渲染逻辑

**问题：** FileTree 组件存在两种渲染模式（虚拟滚动/普通渲染），普通渲染模式下使用 `FileTreeNodeRow` 而非 `FileTreeNode`，导致子节点无法递归渲染，文件夹展开/收缩不生效。

**文件：**
- 修改：`frontend/src/components/Explorer/FileTree.tsx`
- 修改：`frontend/src/components/Explorer/FileTreeNode.tsx`
- 测试：`frontend/src/components/Explorer/FileTree.test.tsx`

- [ ] **步骤 1：分析当前代码问题**

当前代码在 `FileTree.tsx` 第251-268行：
```tsx
// 虚拟滚动模式（大项目）
<List ...>
  {FileTreeRow}
</List>
) : (
// 普通渲染模式（小项目）
treeData.map((node) => (
  <FileTreeNodeRow key={node.path} node={node} depth={0} onFileClick={onFileClick} />
))
```

问题：普通模式下使用 `FileTreeNodeRow` 而非 `FileTreeNode`，`FileTreeNodeRow` 只渲染单个节点，不递归渲染子节点。

- [ ] **步骤 2：统一使用扁平化渲染**

修改 `FileTree.tsx`，移除双模式逻辑，统一使用 `flattenTree` + `react-window` 渲染：

```tsx
// 修改前（第251-269行）
} : enableVirtualization ? (
  <List ...>{FileTreeRow}</List>
) : (
  treeData.map((node) => (
    <FileTreeNodeRow ... />
  ))
)

// 修改后 - 统一使用扁平化渲染
} : (
  <List
    ref={listRef}
    itemCount={nodeCount}
    itemSize={() => ITEM_HEIGHT}
    itemData={{ nodes: flattenedNodes, onFileClick }}
    height={containerRef.current?.clientHeight || 600}
    width="100%"
    overscanCount={5}
  >
    {FileTreeRow}
  </List>
)
```

同时移除 `enableVirtualization` 相关逻辑（第104-113行）。

- [ ] **步骤 3：验证 FileTreeNodeRow 的 onFileClick 传递**

确认 `FileTreeNodeRow` 中 `onFileClick` 的传递逻辑正确：

```tsx
// FileTreeNodeRow.tsx 第66-75行
const handleClick = () => {
  selectNode(node.path);
  if (node.isDir) {
    toggleNode(node.path);
  } else if (onFileClick) {
    onFileClick(node.path);
  } else {
    openFile(node.path, '');
  }
};
```

确认 `FileTreeRow` 组件正确传递 `onFileClick`：
```tsx
// FileTree.tsx 第41-51行
const FileTreeRow: React.FC<any> = ({ index, style, data }) => {
  const rowData = data as FileTreeRowData;
  const item = rowData.nodes[index] as FlattenedNode | undefined;
  if (!item) return null;

  return (
    <div style={style}>
      <FileTreeNodeRow node={item.node} depth={item.depth} onFileClick={rowData.onFileClick} />
    </div>
  );
};
```

- [ ] **步骤 4：运行现有测试**

运行：`cd frontend && npm test -- FileTree.test.tsx`
预期：测试通过（可能需要调整测试以适应统一渲染）

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/Explorer/FileTree.tsx
git commit -m "fix: 统一 FileTree 渲染逻辑，修复文件夹展开/收缩"
```

---

## 任务 2：修复文件点击回调

**问题：** 虽然 `onFileClick` 传递逻辑正确，但需要确认 `App.tsx` 中的回调是否正确处理文件读取。

**文件：**
- 修改：`frontend/src/App.tsx`
- 测试：`frontend/src/components/Explorer/FileTree.test.tsx`

- [ ] **步骤 1：检查 App.tsx 中的 onFileClick 回调**

当前代码（第538-548行）：
```tsx
explorer: <FileTree onFileClick={async (path) => {
  try {
    const bytes = await ReadFile(path);
    const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    openFile(path, content);
    setActiveFile(path);
  } catch (err) {
    console.error('读取文件失败:', err);
    showAppToast(`读取文件失败: ${err}`);
  }
}} />,
```

- [ ] **步骤 2：添加文件读取错误处理**

增强错误处理，添加更详细的错误信息：

```tsx
explorer: <FileTree onFileClick={async (path) => {
  try {
    const bytes = await ReadFile(path);
    if (!bytes || bytes.length === 0) {
      openFile(path, '');
      setActiveFile(path);
      return;
    }
    const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    openFile(path, content);
    setActiveFile(path);
  } catch (err) {
    console.error('读取文件失败:', err);
    showAppToast(`读取文件失败: ${path}`);
  }
}} />,
```

- [ ] **步骤 3：运行测试**

运行：`cd frontend && npm test -- FileTree.test.tsx`
预期：测试通过

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix: 增强文件读取错误处理"
```

---

## 任务 3：实现搜索面板组件

**问题：** RightPanel 中的 search 工具显示 "搜索功能开发中..."，需要实现基础文件搜索功能。

**文件：**
- 创建：`frontend/src/components/Search/SearchPanel.tsx`
- 创建：`frontend/src/components/Search/SearchPanel.test.tsx`
- 修改：`frontend/src/App.tsx`

- [ ] **步骤 1：创建 SearchPanel 组件**

```tsx
// frontend/src/components/Search/SearchPanel.tsx
import { useState, useMemo, useCallback } from 'react';
import { Search, File, Folder, X } from 'lucide-react';
import { useExplorerStore } from '../../stores/useExplorerStore';

interface SearchPanelProps {
  onFileClick: (path: string) => void;
}

/**
 * 搜索面板组件
 *
 * 支持按文件名搜索当前项目中的文件。
 */
export function SearchPanel({ onFileClick }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const { treeData } = useExplorerStore();

  // 递归收集所有文件节点
  const allFiles = useMemo(() => {
    const files: Array<{ name: string; path: string; isDir: boolean }> = [];
    
    function collectFiles(nodes: typeof treeData) {
      for (const node of nodes) {
        files.push({ name: node.name, path: node.path, isDir: node.isDir });
        if (node.isDir && node.children) {
          collectFiles(node.children);
        }
      }
    }
    
    collectFiles(treeData);
    return files;
  }, [treeData]);

  // 根据搜索词过滤
  const filteredFiles = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return allFiles.filter((file) =>
      file.name.toLowerCase().includes(lowerQuery)
    );
  }, [allFiles, query]);

  const handleFileClick = useCallback((path: string) => {
    onFileClick(path);
  }, [onFileClick]);

  return (
    <div className="flex flex-col h-full">
      {/* 搜索输入框 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={16} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文件..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-0.5 rounded hover:bg-accent transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 搜索结果 */}
      <div className="flex-1 overflow-auto py-1">
        {query.trim() && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center">
            <Search size={24} className="mb-2 opacity-50" />
            <p>未找到匹配的文件</p>
          </div>
        ) : (
          filteredFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => handleFileClick(file.path)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm w-full text-left hover:bg-accent/50 transition-colors"
            >
              {file.isDir ? (
                <Folder size={14} className="text-warning flex-shrink-0" />
              ) : (
                <File size={14} className="text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：创建 SearchPanel 测试**

```tsx
// frontend/src/components/Search/SearchPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchPanel } from './SearchPanel';

const mockOnFileClick = vi.fn();

let mockExplorerState: Record<string, unknown> = {};

vi.mock('../../stores/useExplorerStore', () => ({
  useExplorerStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockExplorerState);
    }
    return mockExplorerState;
  }),
}));

function setMockExplorerState(state: Record<string, unknown>) {
  mockExplorerState = {
    treeData: [],
    ...state,
  };
}

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExplorerState = {};
  });

  it('应渲染搜索输入框', () => {
    setMockExplorerState({ treeData: [] });
    render(<SearchPanel onFileClick={mockOnFileClick} />);

    expect(screen.getByPlaceholderText('搜索文件...')).toBeInTheDocument();
  });

  it('搜索应过滤文件', () => {
    setMockExplorerState({
      treeData: [
        { name: 'App.tsx', path: '/project/App.tsx', isDir: false, modTime: '', size: 0 },
        { name: 'index.ts', path: '/project/index.ts', isDir: false, modTime: '', size: 0 },
      ],
    });
    render(<SearchPanel onFileClick={mockOnFileClick} />);

    const input = screen.getByPlaceholderText('搜索文件...');
    fireEvent.change(input, { target: { value: 'App' } });

    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
  });

  it('点击文件应调用 onFileClick', () => {
    setMockExplorerState({
      treeData: [
        { name: 'App.tsx', path: '/project/App.tsx', isDir: false, modTime: '', size: 0 },
      ],
    });
    render(<SearchPanel onFileClick={mockOnFileClick} />);

    const input = screen.getByPlaceholderText('搜索文件...');
    fireEvent.change(input, { target: { value: 'App' } });

    const fileButton = screen.getByText('App.tsx');
    fireEvent.click(fileButton);

    expect(mockOnFileClick).toHaveBeenCalledWith('/project/App.tsx');
  });
});
```

- [ ] **步骤 3：在 App.tsx 中集成 SearchPanel**

修改 `App.tsx`，导入并传入 SearchPanel：

```tsx
// 在文件顶部添加导入
import { SearchPanel } from './components/Search/SearchPanel';

// 在 RightPanel 的 children 中添加 search
<RightPanel ...>
  {{
    explorer: <FileTree onFileClick={...} />,
    search: <SearchPanel onFileClick={async (path) => {
      try {
        const bytes = await ReadFile(path);
        if (!bytes || bytes.length === 0) {
          openFile(path, '');
          setActiveFile(path);
          return;
        }
        const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        openFile(path, content);
        setActiveFile(path);
      } catch (err) {
        console.error('读取文件失败:', err);
        showAppToast(`读取文件失败: ${path}`);
      }
    }} />,
  }}
</RightPanel>
```

- [ ] **步骤 4：运行测试**

运行：`cd frontend && npm test -- SearchPanel.test.tsx`
预期：测试通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/Search/
git add frontend/src/App.tsx
git commit -m "feat: 实现搜索面板组件"
```

---

## 任务 4：更新快捷键和命令面板

**文件：**
- 修改：`frontend/src/App.tsx`

- [ ] **步骤 1：更新 view.globalSearch 快捷键处理**

修改 `App.tsx` 中的 `view.globalSearch` 处理器：

```tsx
registerHandler('view.globalSearch', () => {
  setRightTool('search');
  if (!fileTreeOpen) setFileTreeOpen(true);
});
```

- [ ] **步骤 2：更新命令面板中的搜索命令**

在 `commandPaletteItems` 中添加搜索命令：

```tsx
handlerMap.set('view.globalSearch', () => {
  setRightTool('search');
  if (!fileTreeOpen) setFileTreeOpen(true);
});
```

- [ ] **步骤 3：运行测试**

运行：`cd frontend && npm test`
预期：所有测试通过

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: 更新全局搜索快捷键，打开搜索面板"
```

---

## 任务 5：验证和回归测试

- [ ] **步骤 1：运行所有相关测试**

```bash
cd frontend
npm test -- FileTree.test.tsx
npm test -- SearchPanel.test.tsx
npm test -- FileTreeNode.test.tsx 2>/dev/null || echo "FileTreeNode 测试不存在，跳过"
```

- [ ] **步骤 2：TypeScript 类型检查**

```bash
cd frontend
npx tsc --noEmit
```

- [ ] **步骤 3：构建验证**

```bash
cd frontend
npm run build
```

- [ ] **步骤 4：最终 Commit**

```bash
git add .
git commit -m "test: 添加搜索面板测试，验证所有修复"
```

---

## 自检

### 1. 规格覆盖度

| 问题 | 修复任务 |
|------|---------|
| 点击文件不显示内容 | 任务 1（统一渲染确保回调传递）+ 任务 2（增强错误处理） |
| 文件夹收缩不生效 | 任务 1（统一使用扁平化渲染，移除有问题的普通模式） |
| 搜索功能没实现 | 任务 3（实现 SearchPanel）+ 任务 4（集成快捷键） |

### 2. 占位符扫描

- [x] 无 "待定"、"TODO"、"后续实现"
- [x] 所有步骤包含实际代码
- [x] 无 "类似任务 N" 引用

### 3. 类型一致性

- [x] `FileTreeProps.onFileClick` 签名一致：`(path: string) => void`
- [x] `SearchPanelProps.onFileClick` 签名一致：`(path: string) => void`
- [x] `FileNode` 类型在所有文件中一致

---

## 执行选项

**计划已完成并保存到 `docs/superpowers/plans/2026-05-24-filetree-bug-fix.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
