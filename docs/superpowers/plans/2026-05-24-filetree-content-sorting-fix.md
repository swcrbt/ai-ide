# FileTree 文件内容显示与排序修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复文件内容不显示问题和文件树排序问题

**架构：** 在 Go 后端 buildFileTree 中添加排序逻辑；在前端添加调试日志确认 ReadFile 调用链；修复可能的字节数组转换问题

**技术栈：** React + TypeScript + Zustand + Go + Wails

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `internal/fs/service.go` | Go 后端文件服务，构建文件树 | 修改 |
| `internal/fs/service_test.go` | Go 后端测试 | 修改 |
| `frontend/src/App.tsx` | 前端应用主组件，文件点击处理 | 修改 |
| `frontend/src/components/Explorer/FileTree.tsx` | 文件树组件 | 修改（添加日志） |
| `frontend/src/components/Explorer/FileTreeNode.tsx` | 文件树节点组件 | 修改（添加日志） |
| `frontend/src/stores/useEditorStore.ts` | 编辑器状态管理 | 查看 |

---

## 任务 1：添加调试日志确认文件点击数据流

**问题：** 文件内容不显示，需要确认数据流哪一步出问题

**文件：**
- 修改：`frontend/src/components/Explorer/FileTreeNode.tsx`
- 修改：`frontend/src/App.tsx`

- [ ] **步骤 1：在 FileTreeNodeRow 添加点击日志**

修改 `FileTreeNodeRow` 的 `handleClick` 方法：

```tsx
const handleClick = () => {
  console.log('[FileTreeNodeRow] 点击节点:', node.path, 'isDir:', node.isDir);
  selectNode(node.path);
  if (node.isDir) {
    toggleNode(node.path);
  } else if (onFileClick) {
    console.log('[FileTreeNodeRow] 调用 onFileClick:', node.path);
    onFileClick(node.path);
  } else {
    console.log('[FileTreeNodeRow] 调用 openFile:', node.path);
    openFile(node.path, '');
  }
};
```

- [ ] **步骤 2：在 App.tsx 添加 ReadFile 日志**

修改 `onFileClick` 回调：

```tsx
explorer: <FileTree onFileClick={async (path) => {
  console.log('[App] onFileClick 被调用:', path);
  try {
    const bytes = await ReadFile(path);
    console.log('[App] ReadFile 返回:', bytes?.length, '字节');
    if (!bytes || bytes.length === 0) {
      console.log('[App] 文件为空，打开空文件');
      openFile(path, '');
      setActiveFile(path);
      return;
    }
    const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    console.log('[App] 解码后内容长度:', content.length);
    openFile(path, content);
    setActiveFile(path);
  } catch (err) {
    console.error('[App] 读取文件失败:', err);
    showAppToast(`读取文件失败: ${path}`);
  }
}} />,
```

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/components/Explorer/FileTreeNode.tsx frontend/src/App.tsx
git commit -m "debug: 添加文件点击数据流日志"
```

---

## 任务 2：修复文件树排序

**问题：** `buildFileTree` 方法没有排序，文件和目录顺序混乱

**文件：**
- 修改：`internal/fs/service.go`
- 测试：`internal/fs/service_test.go`

- [ ] **步骤 1：修改 buildFileTree 添加排序**

修改 `internal/fs/service.go` 第188-219行：

```go
// buildFileTree 递归构建文件树（内部方法）
func (s *FileService) buildFileTree(node *FileNode) error {
	entries, err := os.ReadDir(node.Path)
	if err != nil {
		return fmt.Errorf("读取目录失败 %s: %w", node.Path, err)
	}

	// 排序：目录在前，文件在后，同类型按字母顺序
	sort.Slice(entries, func(i, j int) bool {
		iIsDir := entries[i].IsDir()
		jIsDir := entries[j].IsDir()
		if iIsDir != jIsDir {
			return iIsDir // 目录排在前面
		}
		return entries[i].Name() < entries[j].Name() // 同类型按字母顺序
	})

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue // 跳过无法获取信息的文件
		}

		child := &FileNode{
			Name:    entry.Name(),
			Path:    filepath.Join(node.Path, entry.Name()),
			IsDir:   entry.IsDir(),
			ModTime: info.ModTime(),
			Size:    info.Size(),
		}

		if entry.IsDir() {
			if err := s.buildFileTree(child); err != nil {
				// 忽略无权限的目录，继续遍历其他目录
				continue
			}
		}

		node.Children = append(node.Children, child)
	}

	return nil
}
```

- [ ] **步骤 2：添加 sort 包导入**

在 `internal/fs/service.go` 文件顶部添加：

```go
import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)
```

- [ ] **步骤 3：运行 Go 测试**

```bash
cd <project-root>
go test ./internal/fs/ -v
```

预期：测试通过

- [ ] **步骤 4：Commit**

```bash
git add internal/fs/service.go
git commit -m "fix: 文件树按目录优先、字母顺序排序"
```

---

## 任务 3：验证修复并清理日志

- [ ] **步骤 1：构建应用**

```bash
cd <project-root>
make build
```

- [ ] **步骤 2：运行前端测试**

```bash
cd <project-root>
npx vitest run --config frontend/vitest.config.ts frontend/src/
```

- [ ] **步骤 3：清理调试日志（可选）**

如果文件内容显示问题已修复，清理调试日志：

```bash
git revert HEAD~1 --no-edit  # 回滚调试日志 commit
```

- [ ] **步骤 4：最终 Commit**

```bash
git add .
git commit -m "fix: 修复文件树排序和文件内容显示问题"
```

---

## 自检

### 1. 规格覆盖度

| 问题 | 修复任务 |
|------|---------|
| 文件内容不显示 | 任务 1（添加日志诊断）+ 根据日志结果进一步修复 |
| 文件树没有排序 | 任务 2（添加排序逻辑） |

### 2. 占位符扫描

- [x] 无 "待定"、"TODO"、"后续实现"
- [x] 所有步骤包含实际代码
- [x] 无 "类似任务 N" 引用

### 3. 类型一致性

- [x] `FileNode` 类型在 Go 和 TypeScript 中一致
- [x] `ReadFile` 返回类型一致：`Promise<Array<number>>`

---

## 执行选项

**计划已完成并保存到 `docs/superpowers/plans/2026-05-24-filetree-content-sorting-fix.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
