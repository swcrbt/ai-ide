import { create } from 'zustand';

/**
 * 编辑器标签页数据接口
 */
export interface EditorTab {
  /** 文件路径（作为唯一标识） */
  path: string;
  /** 文件内容 */
  content: string;
  /** 文件语言类型 */
  language: string;
  /** 是否为未保存状态 */
  isDirty: boolean;
  /** 文件大小（字节），用于大文件降级策略 */
  size?: number;
}

/**
 * Diff 编辑器状态接口
 */
export interface DiffState {
  /** 是否显示 Diff 编辑器 */
  isOpen: boolean;
  /** 原始内容 */
  original: string;
  /** 修改后内容 */
  modified: string;
  /** 文件语言类型 */
  language: string;
  /** 是否使用内联模式 */
  inlineMode: boolean;
}

/**
 * 编辑器状态接口
 */
interface EditorState {
  /** 已打开的标签页列表 */
  tabs: EditorTab[];
  /** 当前激活的标签页路径 */
  activeTab: string | null;
  /** Diff 编辑器状态 */
  diff: DiffState;

  /** 打开文件 */
  openFile: (path: string, content: string, language?: string, size?: number) => void;
  /** 关闭文件 */
  closeFile: (path: string) => void;
  /** 切换标签页 */
  switchTab: (path: string) => void;
  /** 更新文件内容 */
  updateContent: (path: string, content: string) => void;
  /** 标记文件为未保存 */
  markDirty: (path: string) => void;
  /** 标记文件为已保存 */
  markClean: (path: string) => void;
  /** 打开 Diff 编辑器 */
  openDiff: (original: string, modified: string, language?: string) => void;
  /** 关闭 Diff 编辑器 */
  closeDiff: () => void;
  /** 切换 Diff 内联模式 */
  toggleDiffInlineMode: () => void;
}

/**
 * 从文件路径推断语言类型
 */
function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    dockerfile: 'dockerfile',
    vue: 'vue',
    svelte: 'svelte',
  };
  return languageMap[ext] || 'plaintext';
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  tabs: [],
  activeTab: null,
  diff: {
    isOpen: false,
    original: '',
    modified: '',
    language: 'typescript',
    inlineMode: false,
  },

  openFile: (path, content, language, size) => {
    const { tabs, activeTab } = get();
    const existingTab = tabs.find((t) => t.path === path);

    if (existingTab) {
      // 如果提供了新内容且与现有内容不同，刷新内容
      if (content !== undefined && content !== existingTab.content) {
        const newTabs = tabs.map((t) =>
          t.path === path ? { ...t, content, isDirty: false } : t
        );
        set({ tabs: newTabs, activeTab: path });
      } else {
        set({ activeTab: path });
      }
      return;
    }

    const newTab: EditorTab = {
      path,
      content,
      language: language || inferLanguage(path),
      isDirty: false,
      size,
    };

    set({
      tabs: [...tabs, newTab],
      activeTab: path,
    });
  },

  closeFile: (path) => {
    const { tabs, activeTab } = get();
    const newTabs = tabs.filter((t) => t.path !== path);

    let newActiveTab = activeTab;
    if (activeTab === path) {
      const closedIndex = tabs.findIndex((t) => t.path === path);
      if (newTabs.length > 0) {
        const newIndex = Math.min(closedIndex, newTabs.length - 1);
        newActiveTab = newTabs[Math.max(0, newIndex)].path;
      } else {
        newActiveTab = null;
      }
    }

    set({
      tabs: newTabs,
      activeTab: newActiveTab,
    });
  },

  switchTab: (path) => {
    set({ activeTab: path });
  },

  updateContent: (path, content) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) =>
      t.path === path ? { ...t, content, isDirty: true } : t
    );
    set({ tabs: newTabs });
  },

  markDirty: (path) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) =>
      t.path === path ? { ...t, isDirty: true } : t
    );
    set({ tabs: newTabs });
  },

  markClean: (path) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) =>
      t.path === path ? { ...t, isDirty: false } : t
    );
    set({ tabs: newTabs });
  },

  openDiff: (original, modified, language) => {
    set({
      diff: {
        isOpen: true,
        original,
        modified,
        language: language || 'typescript',
        inlineMode: false,
      },
    });
  },

  closeDiff: () => {
    set({
      diff: {
        isOpen: false,
        original: '',
        modified: '',
        language: 'typescript',
        inlineMode: false,
      },
    });
  },

  toggleDiffInlineMode: () => {
    const { diff } = get();
    set({
      diff: { ...diff, inlineMode: !diff.inlineMode },
    });
  },
}));
