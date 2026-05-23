import { create } from 'zustand';

/**
 * Diff块类型
 */
export type DiffBlockType = 'add' | 'delete' | 'modify';

/**
 * 单个Diff块接口
 */
export interface DiffBlock {
  /** 块ID */
  id: string;
  /** 块类型：新增/删除/修改 */
  type: DiffBlockType;
  /** 原始代码行列表（删除和修改时有值） */
  oldLines: string[];
  /** 修改后代码行列表（新增和修改时有值） */
  newLines: string[];
  /** 原始起始行号 */
  oldStartLine: number;
  /** 修改后起始行号 */
  newStartLine: number;
  /** 是否被选中应用 */
  selected: boolean;
}

/**
 * 文件修改记录接口
 */
export interface FileChange {
  /** 文件路径 */
  file: string;
  /** 原始内容 */
  original: string;
  /** 修改后内容 */
  modified: string;
  /** Diff块列表 */
  blocks: DiffBlock[];
  /** 是否已应用 */
  applied: boolean;
  /** 应用时间戳 */
  appliedAt?: number;
}

/**
 * 历史记录项接口（用于撤销）
 */
export interface HistoryEntry {
  /** 历史记录ID */
  id: string;
  /** 文件路径 */
  file: string;
  /** 撤销前的内容 */
  previousContent: string;
  /** 应用时间戳 */
  timestamp: number;
}

/**
 * Diff状态接口
 */
interface DiffState {
  /** 当前待应用的修改列表 */
  changes: FileChange[];
  /** 修改历史栈（用于撤销） */
  history: HistoryEntry[];
  /** 是否显示Diff预览面板 */
  isPreviewOpen: boolean;
  /** 当前选中的文件索引 */
  selectedFileIndex: number;
  /** 危险操作白名单（不再询问的文件） */
  permissionWhitelist: Set<string>;

  /** 设置修改列表 */
  setChanges: (changes: FileChange[]) => void;
  /** 添加单个修改 */
  addChange: (change: FileChange) => void;
  /** 移除单个修改 */
  removeChange: (index: number) => void;
  /** 切换块的选中状态 */
  toggleBlockSelection: (changeIndex: number, blockId: string) => void;
  /** 选中所有块 */
  selectAllBlocks: (changeIndex: number) => void;
  /** 取消选中所有块 */
  deselectAllBlocks: (changeIndex: number) => void;
  /** 应用指定修改 */
  applyChange: (index: number) => void;
  /** 应用所有修改 */
  applyAll: () => void;
  /** 撤销指定修改 */
  revertChange: (index: number) => void;
  /** 撤销所有修改 */
  revertAll: () => void;
  /** 撤销最后一次应用 */
  undoLast: () => void;
  /** 打开Diff预览面板 */
  openPreview: () => void;
  /** 关闭Diff预览面板 */
  closePreview: () => void;
  /** 设置选中的文件 */
  setSelectedFile: (index: number) => void;
  /** 添加到权限白名单 */
  addToWhitelist: (file: string) => void;
  /** 从权限白名单移除 */
  removeFromWhitelist: (file: string) => void;
  /** 清空所有修改 */
  clearChanges: () => void;
  /** 计算Diff统计 */
  getStats: (change: FileChange) => { additions: number; deletions: number };
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 解析Diff文本，生成Diff块列表
 * 支持统一Diff格式解析
 */
export function parseDiffBlocks(original: string, modified: string): DiffBlock[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const blocks: DiffBlock[] = [];

  // 使用简单的LCS（最长公共子序列）算法找出差异
  // 实际项目中可以使用更高效的diff库如diff-match-patch
  let i = 0;
  let j = 0;
  let oldStart = 0;
  let newStart = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length && originalLines[i] === modifiedLines[j]) {
      i++;
      j++;
      oldStart = i;
      newStart = j;
      continue;
    }

    // 收集连续的删除行
    const oldBlock: string[] = [];
    const newBlock: string[] = [];
    const blockOldStart = oldStart + 1;
    const blockNewStart = newStart + 1;

    while (i < originalLines.length && (j >= modifiedLines.length || originalLines[i] !== modifiedLines[j])) {
      oldBlock.push(originalLines[i]);
      i++;
    }

    while (j < modifiedLines.length && (i >= originalLines.length || originalLines[i] !== modifiedLines[j])) {
      newBlock.push(modifiedLines[j]);
      j++;
    }

    if (oldBlock.length > 0 && newBlock.length > 0) {
      blocks.push({
        id: generateId(),
        type: 'modify',
        oldLines: oldBlock,
        newLines: newBlock,
        oldStartLine: blockOldStart,
        newStartLine: blockNewStart,
        selected: true,
      });
    } else if (oldBlock.length > 0) {
      blocks.push({
        id: generateId(),
        type: 'delete',
        oldLines: oldBlock,
        newLines: [],
        oldStartLine: blockOldStart,
        newStartLine: blockNewStart,
        selected: true,
      });
    } else if (newBlock.length > 0) {
      blocks.push({
        id: generateId(),
        type: 'add',
        oldLines: [],
        newLines: newBlock,
        oldStartLine: blockOldStart,
        newStartLine: blockNewStart,
        selected: true,
      });
    }

    oldStart = i;
    newStart = j;
  }

  return blocks;
}

/**
 * 从AI回复中提取代码修改
 * 支持格式：```filename.ext\n代码内容\n```
 */
export function extractCodeChanges(content: string): Array<{ file: string; code: string }> {
  const changes: Array<{ file: string; code: string }> = [];
  // 匹配带文件名的代码块：```filename.ext 或 ```filename.ext:描述
  const codeBlockRegex = /```([\w./-]+\.\w+)(?::[^:]+)?\n?([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    changes.push({
      file: match[1],
      code: match[2].trim(),
    });
  }

  return changes;
}

/**
 * 检查操作是否危险（删除大量代码或修改关键文件）
 */
export function isDangerousOperation(change: FileChange): boolean {
  // 删除超过50%的代码视为危险操作
  const originalLines = change.original.split('\n').length;
  const deletedLines = change.blocks
    .filter((b) => b.type === 'delete' || b.type === 'modify')
    .reduce((sum, b) => sum + b.oldLines.length, 0);

  if (originalLines > 0 && deletedLines / originalLines > 0.5) {
    return true;
  }

  // 修改配置文件视为危险操作
  const dangerousPatterns = [
    /\.env/i,
    /config\./i,
    /package\.json/i,
    /tsconfig\.json/i,
    /go\.mod/i,
    /Dockerfile/i,
    /\.yaml$/i,
    /\.yml$/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(change.file));
}

export const useDiffStore = create<DiffState>()((set, get) => ({
  changes: [],
  history: [],
  isPreviewOpen: false,
  selectedFileIndex: 0,
  permissionWhitelist: new Set(),

  setChanges: (changes) => {
    set({ changes, isPreviewOpen: true, selectedFileIndex: 0 });
  },

  addChange: (change) => {
    const { changes } = get();
    const existingIndex = changes.findIndex((c) => c.file === change.file);

    if (existingIndex >= 0) {
      // 更新已有修改
      const newChanges = [...changes];
      newChanges[existingIndex] = change;
      set({ changes: newChanges });
    } else {
      set({ changes: [...changes, change] });
    }
  },

  removeChange: (index) => {
    const { changes } = get();
    set({ changes: changes.filter((_, i) => i !== index) });
  },

  toggleBlockSelection: (changeIndex, blockId) => {
    const { changes } = get();
    const newChanges = [...changes];
    const change = { ...newChanges[changeIndex] };
    const newBlocks = change.blocks.map((block) =>
      block.id === blockId ? { ...block, selected: !block.selected } : block
    );
    change.blocks = newBlocks;
    newChanges[changeIndex] = change;
    set({ changes: newChanges });
  },

  selectAllBlocks: (changeIndex) => {
    const { changes } = get();
    const newChanges = [...changes];
    const change = { ...newChanges[changeIndex] };
    change.blocks = change.blocks.map((block) => ({ ...block, selected: true }));
    newChanges[changeIndex] = change;
    set({ changes: newChanges });
  },

  deselectAllBlocks: (changeIndex) => {
    const { changes } = get();
    const newChanges = [...changes];
    const change = { ...newChanges[changeIndex] };
    change.blocks = change.blocks.map((block) => ({ ...block, selected: false }));
    newChanges[changeIndex] = change;
    set({ changes: newChanges });
  },

  applyChange: (index) => {
    const { changes, history } = get();
    const change = changes[index];

    if (!change || change.applied) return;

    // 将原始内容压入历史栈
    const historyEntry: HistoryEntry = {
      id: generateId(),
      file: change.file,
      previousContent: change.original,
      timestamp: Date.now(),
    };

    // 构建应用后的内容（只应用选中的块）
    const selectedBlocks = change.blocks.filter((b) => b.selected);
    let newContent = change.modified;

    // 如果只有部分块被选中，需要重新构建内容
    if (selectedBlocks.length !== change.blocks.length) {
      // 使用原始内容为基础，应用选中的修改块
      const lines = change.original.split('\n');
      const result: string[] = [];
      let currentLine = 0;

      // 按顺序处理每个块
      for (const block of change.blocks) {
        // 复制块之前的未修改内容
        const blockStart = block.oldStartLine - 1;
        while (currentLine < blockStart && currentLine < lines.length) {
          result.push(lines[currentLine]);
          currentLine++;
        }

        if (block.selected) {
          // 应用该块：跳过旧行，添加新行
          currentLine += block.oldLines.length;
          result.push(...block.newLines);
        } else {
          // 不应用该块：保留旧行
          for (let i = 0; i < block.oldLines.length && currentLine < lines.length; i++) {
            result.push(lines[currentLine]);
            currentLine++;
          }
        }
      }

      // 添加剩余内容
      while (currentLine < lines.length) {
        result.push(lines[currentLine]);
        currentLine++;
      }

      newContent = result.join('\n');
    }

    const newChanges = [...changes];
    newChanges[index] = {
      ...change,
      modified: newContent,
      applied: true,
      appliedAt: Date.now(),
    };

    set({
      changes: newChanges,
      history: [...history, historyEntry],
    });
  },

  applyAll: () => {
    const { changes } = get();
    changes.forEach((_, index) => {
      get().applyChange(index);
    });
  },

  revertChange: (index) => {
    const { changes, history } = get();
    const change = changes[index];

    if (!change || !change.applied) return;

    // 从历史栈中查找该文件的最后一条记录
    const fileHistory = history.filter((h) => h.file === change.file);
    if (fileHistory.length === 0) return;

    const lastEntry = fileHistory[fileHistory.length - 1];

    const newChanges = [...changes];
    newChanges[index] = {
      ...change,
      original: lastEntry.previousContent,
      modified: lastEntry.previousContent,
      applied: false,
      appliedAt: undefined,
    };

    // 从历史栈中移除该记录
    const newHistory = history.filter((h) => h.id !== lastEntry.id);

    set({
      changes: newChanges,
      history: newHistory,
    });
  },

  revertAll: () => {
    const { changes } = get();
    changes.forEach((_, index) => {
      get().revertChange(index);
    });
  },

  undoLast: () => {
    const { history } = get();
    if (history.length === 0) return;

    const lastEntry = history[history.length - 1];
    const { changes } = get();
    const changeIndex = changes.findIndex((c) => c.file === lastEntry.file);

    if (changeIndex >= 0) {
      get().revertChange(changeIndex);
    }
  },

  openPreview: () => set({ isPreviewOpen: true }),

  closePreview: () => set({ isPreviewOpen: false }),

  setSelectedFile: (index) => set({ selectedFileIndex: index }),

  addToWhitelist: (file) => {
    const { permissionWhitelist } = get();
    const newWhitelist = new Set(permissionWhitelist);
    newWhitelist.add(file);
    set({ permissionWhitelist: newWhitelist });
  },

  removeFromWhitelist: (file) => {
    const { permissionWhitelist } = get();
    const newWhitelist = new Set(permissionWhitelist);
    newWhitelist.delete(file);
    set({ permissionWhitelist: newWhitelist });
  },

  clearChanges: () => set({ changes: [], history: [], isPreviewOpen: false, selectedFileIndex: 0 }),

  getStats: (change) => {
    const additions = change.blocks
      .filter((b) => b.selected && (b.type === 'add' || b.type === 'modify'))
      .reduce((sum, b) => sum + b.newLines.length, 0);
    const deletions = change.blocks
      .filter((b) => b.selected && (b.type === 'delete' || b.type === 'modify'))
      .reduce((sum, b) => sum + b.oldLines.length, 0);
    return { additions, deletions };
  },
}));
