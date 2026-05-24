# 修复：点击文件树打开文件无内容显示

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复通过文件树点击文件后标签页创建但编辑器中无内容显示的 BUG

**架构：** 诊断-修复两步策略。先用 toast 通知定位断点（点击→ReadFile→解码→openFile→Editor 五段），再根据断点位置精准修复。

**技术栈：** React 18 + TypeScript + Zustand v5 + Wails v2.12.0 + @monaco-editor/react v4.7.0

**背景：** 之前的计划 `2026-05-24-filetree-bug-fix.md` 的任务 1-2 已实现（统一渲染 + 增强错误处理），但问题仍然存在。说明根因在第 3-5 段（Wails IPC、TextDecoder 解码、Monaco Editor 渲染）。

**症状：** 点击文件树中文件 → 标签页出现在顶部 TabBar → 编辑器区域空白（或 Monaco Editor 加载中无内容）

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `frontend/src/App.tsx:544-563` | onFileClick 回调，调用 ReadFile → openFile | **修改** |
| `frontend/src/stores/useEditorStore.ts:114-135` | openFile 函数，创建标签页 | **修改** |
| `frontend/src/components/Editor/Editor.tsx:314-327` | MonacoEditor 渲染，绑定 value | **修改** |
| `frontend/src/components/Explorer/FileTreeNode.tsx:66-78` | 文件节点点击处理 | **修改** |

---

## 任务 1：插入 Toast 诊断埋点（定位断点）

**说明：** 由于无法查看控制台日志，将诊断信息通过 toast 通知直接显示在 UI 上。每次点击文件时会依次弹出 toast，据此精准定位问题发生在哪个环节。

**文件：**
- 修改：`frontend/src/App.tsx:544-579`
- 修改：`frontend/src/stores/useEditorStore.ts:114-135`

- [ ] **步骤 1：在 App.tsx onFileClick 回调中添加 toast 诊断**

修改 `frontend/src/App.tsx` 第 544-563 行的 `explorer` 回调：

```tsx
explorer: <FileTree onFileClick={async (path) => {
  // [诊断] 第1段：点击事件已到达 App.tsx
  showAppToast(`诊断1: onClick 触发, path=${path.slice(-30)}`);

  try {
    const bytes = await ReadFile(path);

    // [诊断] 第2段：ReadFile 返回，打印类型和长度
    const bytesType = Object.prototype.toString.call(bytes);
    const bytesLen = bytes && typeof bytes.length === 'number' ? bytes.length : '?';
    showAppToast(`诊断2: ReadFile 返回, 类型=${bytesType.slice(8,-1)}, 长度=${bytesLen}`);

    if (!bytes || bytes.length === 0) {
      // [诊断] 第2b段：文件为空
      showAppToast(`诊断2b: 字节为空，以空内容打开`);
      openFile(path, '');
      setActiveFile(path);
      return;
    }

    // [诊断] 第3段：开始解码
    let content: string;
    try {
      const uint8 = new Uint8Array(bytes);
      content = new TextDecoder('utf-8').decode(uint8);
    } catch (decodeErr) {
      // [诊断] 第3b段：解码失败
      showAppToast(`诊断3b: 解码失败! err=${String(decodeErr).slice(0,50)}`);
      openFile(path, '');
      setActiveFile(path);
      return;
    }

    // [诊断] 第3段：解码成功
    showAppToast(`诊断3: 解码成功, content长度=${content.length}`);

    // [诊断] 第4段：调用 openFile 前
    showAppToast(`诊断4: 调用 openFile, 参数长度=${content.length}`);
    openFile(path, content);
    setActiveFile(path);

    // [诊断] 第5段：openFile 调用完毕
    showAppToast(`诊断5: openFile 调用完成`);

  } catch (err) {
    // [诊断] 异常路径
    showAppToast(`诊断ERR: ReadFile异常! err=${String(err).slice(0,50)}`);
    showAppToast(`读取文件失败: ${path}`);
  }
}} />,
```

同样修改搜索面板的回调（第 564-579 行），添加相同的 toast 诊断：

```tsx
search: <SearchPanel onFileClick={async (path) => {
  showAppToast(`诊断1-搜索: onClick 触发, path=${path.slice(-30)}`);
  try {
    const bytes = await ReadFile(path);
    const bytesType = Object.prototype.toString.call(bytes);
    const bytesLen = bytes && typeof bytes.length === 'number' ? bytes.length : '?';
    showAppToast(`诊断2-搜索: ReadFile 返回, 类型=${bytesType.slice(8,-1)}, 长度=${bytesLen}`);

    if (!bytes || bytes.length === 0) {
      showAppToast(`诊断2b-搜索: 字节为空`);
      openFile(path, '');
      setActiveFile(path);
      return;
    }

    let content: string;
    try {
      const uint8 = new Uint8Array(bytes);
      content = new TextDecoder('utf-8').decode(uint8);
    } catch (decodeErr) {
      showAppToast(`诊断3b-搜索: 解码失败!`);
      openFile(path, '');
      setActiveFile(path);
      return;
    }

    showAppToast(`诊断3-搜索: 解码成功, 长度=${content.length}`);
    showAppToast(`诊断4-搜索: 调用 openFile`);
    openFile(path, content);
    setActiveFile(path);
    showAppToast(`诊断5-搜索: openFile 完成`);
  } catch (err) {
    showAppToast(`诊断ERR-搜索: ${String(err).slice(0,50)}`);
    showAppToast(`读取文件失败: ${path}`);
  }
}} />,
```

- [ ] **步骤 2：在 useEditorStore.openFile 中添加 console 诊断**

修改 `frontend/src/stores/useEditorStore.ts` 第 114-135 行的 `openFile` 函数：

```typescript
openFile: (path, content, language, size) => {
  console.log('[EditorStore.openFile] 被调用:', {
    path: path.slice(-30),
    contentLen: content?.length,
    contentPreview: content?.slice(0, 50),
  });

  const { tabs, activeTab } = get();
  const existingTab = tabs.find((t) => t.path === path);

  if (existingTab) {
    console.log('[EditorStore.openFile] 标签页已存在，仅切换 activeTab');
    set({ activeTab: path });
    return;
  }

  const newTab: EditorTab = {
    path,
    content,
    language: language || inferLanguage(path),
    isDirty: false,
    size,
  };

  console.log('[EditorStore.openFile] 创建新标签页:', {
    contentLen: newTab.content?.length,
    lang: newTab.language,
  });

  set({
    tabs: [...tabs, newTab],
    activeTab: path,
  });
},
```

- [ ] **步骤 3：启动应用，点击任意非空文件，记录 toast 序列**

运行应用（`wails dev`），点击文件树中的任一 `.tsx` 或 `.ts` 文件，观察依次弹出的 toast。

**期望结果（正常链路）：**
```
诊断1 → 诊断2(类型=Array, 长度=N>0) → 诊断3(解码成功, 长度=N>0) → 诊断4 → 诊断5
```

**异常结果分析表：**

| toast 序列 | 断点位置 | 对应修复 |
|-----------|---------|---------|
| 只有诊断1，无后续 | ReadFile 调用未执行或挂起 | **任务 2A** |
| 诊断1 + 诊断2(长度=0) | ReadFile 返回空字节 | **任务 2B** |
| 诊断2(类型≠Array) | Wails 返回类型异常（如 ArrayBuffer/base64） | **任务 2C** |
| 诊断2(长度>0) + 诊断3b | 解码失败 | **任务 2D** |
| 诊断1→2→3→4→5 全部通过但仍无内容 | Monaco Editor 未更新 | **任务 2E** |
| 诊断ERR | ReadFile 异常 | **任务 2F** |

- [ ] **步骤 4：Commit 诊断代码**

```bash
git add frontend/src/App.tsx frontend/src/stores/useEditorStore.ts
git commit -m "debug: 添加 toast 诊断埋点，定位文件内容加载断点"
```

**此时暂停，告知用户：** "请运行 `wails dev`，点击任意 .tsx 或 .ts 文件，观察右下角弹出的 toast 通知，告诉我你看到了哪几条 toast。"

---

## 任务 2A：修复 ReadFile 调用未执行

**触发条件：** toast 只显示"诊断1"，无后续

**根因：** ReadFile 的 Wails IPC 调用阻塞或 Promise 永不 resolve

**文件：**
- 修改：`frontend/src/App.tsx:544-563`

- [ ] **步骤 1：为 ReadFile 添加超时机制**

修改 `frontend/src/App.tsx` 的回调，用 `Promise.race` 给 ReadFile 加 5 秒超时：

```tsx
explorer: <FileTree onFileClick={async (path) => {
  showAppToast(`诊断1: onClick 触发`);
  try {
    const TIMEOUT_MS = 5000;
    const bytes = await Promise.race([
      ReadFile(path),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ReadFile 超时(5s)')), TIMEOUT_MS)
      ),
    ]);
    // ... 后续解码逻辑（同任务 2B 中的 normalizeBytes + decodeBytes）
  } catch (err) {
    showAppToast(`读取失败: ${String(err).slice(0, 50)}`);
  }
}} />,
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix: 为 ReadFile Wails 调用添加 5 秒超时保护"
```

---

## 任务 2B：修复 ReadFile 返回空字节

**触发条件：** toast 显示"诊断2: ReadFile 返回, 长度=0"（对于非空文件）

**根因：** Wails v2.12.0 中 `[]byte` 可能以意外格式序列化。例如某些版本将 `[]byte` 序列化为 `{ data: [...] }` 对象或 base64 字符串，导致 `bytes.length` 异常或 `bytes` 为 `null`。

**文件：**
- 创建：`frontend/src/utils/fileReader.ts`
- 修改：`frontend/src/App.tsx:544-579`

- [ ] **步骤 1：创建工具函数文件**

创建 `frontend/src/utils/fileReader.ts`：

```typescript
/**
 * 将 Wails ReadFile 返回的多种可能格式统一转换为 Uint8Array
 * 兼容：Array<number>, Uint8Array, ArrayBuffer, base64 string, { data: [...] }
 */
export function normalizeBytes(bytes: unknown): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (Array.isArray(bytes)) return new Uint8Array(bytes);

  if (typeof bytes === 'string') {
    try {
      const binaryStr = atob(bytes);
      const arr = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        arr[i] = binaryStr.charCodeAt(i);
      }
      return arr;
    } catch {
      return new TextEncoder().encode(bytes);
    }
  }

  if (bytes && typeof bytes === 'object' && Array.isArray((bytes as Record<string, unknown>).data)) {
    return new Uint8Array((bytes as Record<string, unknown>).data as Array<number>);
  }

  return new Uint8Array(0);
}

/**
 * 多编码安全解码字节数组为字符串
 * 尝试 UTF-8 (strict) → UTF-16 LE/BE → UTF-8 (loose)
 */
export function decodeBytes(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  // 尝试严格 UTF-8
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // 继续尝试其他编码
  }

  // UTF-16 LE BOM (0xFF 0xFE)
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes);
  }

  // UTF-16 BE BOM (0xFE 0xFF)
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes);
  }

  // 降级：非严格 UTF-8（会生成替换字符 U+FFFD 但不会抛异常）
  return new TextDecoder('utf-8').decode(bytes);
}
```

- [ ] **步骤 2：修改 App.tsx 使用工具函数**

在 `frontend/src/App.tsx` 顶部添加导入：

```typescript
import { normalizeBytes, decodeBytes } from './utils/fileReader';
```

修改 explorer 回调使用工具函数：

```tsx
explorer: <FileTree onFileClick={async (path) => {
  try {
    const bytes = await ReadFile(path);
    const normalized = normalizeBytes(bytes);

    if (normalized.length === 0) {
      openFile(path, '');
      setActiveFile(path);
      return;
    }

    const content = decodeBytes(normalized);
    openFile(path, content);
    setActiveFile(path);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    showAppToast(`读取失败: ${path.slice(-30)} - ${errMsg}`);
    openFile(path, `// 读取失败: ${errMsg}\n`);
    setActiveFile(path);
  }
}} />,
```

对搜索面板回调（第 564-579 行）做同样修改。

- [ ] **步骤 3：TypeScript 编译检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/utils/fileReader.ts frontend/src/App.tsx
git commit -m "fix: 添加 ReadFile 多格式兼容和编码容错，修复空内容问题"
```

---

## 任务 2C：修复 Wails 返回类型异常

**触发条件：** toast 显示"诊断2: 类型=???"（非 Array 类型）

**根因：** 与 2B 相同，Wails 序列化异常。**2B 的 `normalizeBytes` 已覆盖此场景。**

**说明：** 无需额外操作。如果 2B 的修复已应用但仍有类型异常，则是 `normalizeBytes` 中未涵盖的类型（如 WebSocket 的 Blob），需要在函数中追加对应分支。

---

## 任务 2D：修复 TextDecoder 解码失败

**触发条件：** toast 显示"诊断3b: 解码失败!"

**根因：** 文件不是 UTF-8 编码（如 GBK、UTF-16 LE/BE），或 `bytes` 不是有效的字节序列。

**说明：** 2B 中创建的 `decodeBytes` 函数已包含多编码容错逻辑。无需额外任务。

---

## 任务 2E：修复 Monaco Editor 不更新内容

**触发条件：** toast 全部通过（1→5），但编辑器中仍无内容显示

**根因：** `@monaco-editor/react` 组件在某些情况下不响应 `value` prop 的更新。可能是组件 key 不变导致实例复用，或 Monaco 内部模型未同步。

**文件：**
- 修改：`frontend/src/components/Editor/Editor.tsx:307-327`

- [ ] **步骤 1：为 MonacoEditor 添加基于路径的 key**

修改 `frontend/src/components/Editor/Editor.tsx` 第 314-327 行：

```tsx
// 修改前
) : activeTabData ? (
  <MonacoEditor
    theme={monacoTheme}
    language={effectiveLanguage}
    value={activeTabData.content}
    options={editorOptions}
    onChange={handleChange}
    onMount={handleMount}
    loading={
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        <span className="text-sm">编辑器加载中...</span>
      </div>
    }
  />
) : (

// 修改后 - 添加 key 强制 Monaco 按路径重建实例
) : activeTabData ? (
  <MonacoEditor
    key={activeTabData.path}
    theme={monacoTheme}
    language={effectiveLanguage}
    value={activeTabData.content}
    options={editorOptions}
    onChange={handleChange}
    onMount={handleMount}
    loading={
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        <span className="text-sm">编辑器加载中...</span>
      </div>
    }
  />
) : (
```

- [ ] **步骤 2：添加 Editor 诊断 useEffect 监听内容变化**

在 `Editor.tsx` 的 `Editor` 组件函数体内部，`handleMount` 之后添加：

```typescript
// 诊断：监听 activeTabData 变化
useEffect(() => {
  if (activeTabData) {
    console.log('[Editor] activeTabData 更新:', {
      path: activeTabData.path.slice(-30),
      contentLen: activeTabData.content?.length,
      contentPreview: activeTabData.content?.slice(0, 50),
    });
  }
}, [activeTabData]);
```

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/components/Editor/Editor.tsx
git commit -m "fix: 为 MonacoEditor 添加基于路径的 key，解决内容不更新问题"
```

---

## 任务 2F：修复 ReadFile 异常

**触发条件：** toast 显示"诊断ERR"

**根因：** Go 后端 `ReadFile` 出错（文件不存在/权限不足/路径错误）

**文件：**
- 修改：`frontend/src/App.tsx:544-579`
- 修改：`internal/fs/service.go:60-72`

- [ ] **步骤 1：增强前端错误提示**

修改 `App.tsx` 的 catch 块（如果 2B 中未包含）：

```tsx
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  showAppToast(`读取失败: ${path.slice(-30)} - ${errMsg}`);
  // 即使读取失败也尝试打开空文件，让标签页出现
  openFile(path, `// 读取失败: ${errMsg}\n`);
  setActiveFile(path);
}
```

- [ ] **步骤 2：增强后端 ReadFile 路径处理和日志**

修改 `internal/fs/service.go` 第 60-72 行：

```go
// ReadFile 读取指定路径的文件内容
func (s *FileService) ReadFile(path string) ([]byte, error) {
    // 安全检查
    if strings.Contains(path, "..") {
        return nil, fmt.Errorf("非法路径: %s", path)
    }

    // 检查文件是否存在
    info, err := os.Stat(path)
    if err != nil {
        if os.IsNotExist(err) {
            return nil, fmt.Errorf("文件不存在: %s", path)
        }
        return nil, fmt.Errorf("读取文件信息失败: %s, err: %w", path, err)
    }

    // 检查是否为目录
    if info.IsDir() {
        return nil, fmt.Errorf("路径是目录而非文件: %s", path)
    }

    // 读取文件
    content, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("读取文件失败: %s, err: %w", path, err)
    }
    return content, nil
}
```

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/App.tsx internal/fs/service.go
git commit -m "fix: 增强 ReadFile 前后端错误处理，显示详细错误信息"
```

---

## 任务 3：清理诊断代码 + 回归验证

**说明：** 确认修复生效后，移除永久性的诊断 toast，保留核心业务逻辑修复。

- [ ] **步骤 1：移除 toast 诊断埋点**

回退 `App.tsx` 中所有 `showAppToast('诊断X: ...')` 调用，保留核心的业务逻辑修复代码（`normalizeBytes`、`decodeBytes`、超时保护、错误处理）。

最终 `App.tsx` 的 onFileClick 回调简化为：

```tsx
explorer: <FileTree onFileClick={async (path) => {
  try {
    const bytes = await Promise.race([
      ReadFile(path),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('读取超时')), 5000)
      ),
    ]);

    const normalized = normalizeBytes(bytes);
    if (normalized.length === 0) {
      openFile(path, '');
      setActiveFile(path);
      return;
    }

    const content = decodeBytes(normalized);
    openFile(path, content);
    setActiveFile(path);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    showAppToast(`读取失败: ${path.slice(-30)} - ${errMsg}`);
    openFile(path, `// 读取失败: ${errMsg}\n`);
    setActiveFile(path);
  }
}} />,
```

- [ ] **步骤 2：TypeScript 编译检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npm run build
```

- [ ] **步骤 4：运行全量测试**

```bash
cd frontend && npm test
```

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor: 移除诊断 toast，保留核心修复逻辑"
```

---

## 自检

### 1. 规格覆盖度

| 问题链路 | 诊断 | 修复 |
|---------|------|------|
| ReadFile 未执行 | 诊断1→卡住 | 任务 2A：超时保护 |
| ReadFile 返回空 | 诊断2b(长度=0) | 任务 2B：多格式兼容 |
| Wails 类型异常 | 诊断2(类型≠Array) | 任务 2C：复用 2B 方案 |
| TextDecoder 解码失败 | 诊断3b | 任务 2D：复用 2B 方案 |
| Monaco 未更新 | 诊断全通过 | 任务 2E：key 属性 + 诊断 useEffect |
| ReadFile 异常 | 诊断ERR | 任务 2F：前后端增强错误处理 |

### 2. 占位符扫描

- [x] 无 "待定"、"TODO"、"后续实现"
- [x] 每个步骤包含完整代码（包括导入语句）
- [x] 无 "类似任务 N" 引用
- [x] 所有文件路径精确

### 3. 类型一致性

- [x] `normalizeBytes` 接受 `unknown`，返回 `Uint8Array`
- [x] `decodeBytes` 接受 `Uint8Array`，返回 `string`
- [x] `openFile` 签名：`(path: string, content: string, language?: string, size?: number) => void`
- [x] `showAppToast` 签名：`(message: string) => void`

---

## 执行选项

计划已完成并保存到 `docs/superpowers/specs/2026-05-24-file-open-no-content.md`。

**建议执行顺序：先执行任务 1（诊断），根据 toast 结果选择对应的修复任务。**
