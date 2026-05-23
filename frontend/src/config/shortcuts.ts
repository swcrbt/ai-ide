/**
 * 快捷键系统配置模块
 *
 * 定义 VS Code 兼容的快捷键映射、接口和分类。
 * 支持 macOS 平台自动适配（Ctrl -> Cmd）。
 */

/** 快捷键分类枚举 */
export type ShortcutCategory = 'file' | 'edit' | 'navigate' | 'view' | 'terminal';

/** 快捷键分类显示名称 */
export const CATEGORY_NAMES: Record<ShortcutCategory, string> = {
  file: '文件',
  edit: '编辑',
  navigate: '导航',
  view: '视图',
  terminal: '终端',
};

/** 快捷键接口 */
export interface Shortcut {
  /** 唯一标识 */
  id: string;
  /** 快捷键组合（使用 VS Code 风格，如 "ctrl+s"） */
  key: string;
  /** 命令标识 */
  command: string;
  /** 命令描述 */
  description: string;
  /** 所属分类 */
  category: ShortcutCategory;
  /** 是否在输入框聚焦时禁用 */
  disableWhenInputFocused?: boolean;
}

/** 快捷键命令枚举 */
export type ShortcutCommand =
  | 'file.save'
  | 'file.open'
  | 'file.closeTab'
  | 'file.newFile'
  | 'file.newWindow'
  | 'file.closeWindow'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.find'
  | 'edit.toggleLineComment'
  | 'navigate.nextTab'
  | 'navigate.prevTab'
  | 'navigate.switchToTab'
  | 'view.commandPalette'
  | 'view.globalSearch'
  | 'view.toggleSidebar'
  | 'view.toggleBottomPanel'
  | 'view.showExplorer'
  | 'view.showGit'
  | 'view.showExtensions'
  | 'view.showProblems'
  | 'view.toggleTerminal'
  | 'view.showOutput'
  | 'settings.open'
  | 'general.escape';

/** 默认快捷键映射 */
export const DEFAULT_SHORTCUTS: Shortcut[] = [
  // 文件操作
  {
    id: 'save',
    key: 'ctrl+s',
    command: 'file.save',
    description: '保存文件',
    category: 'file',
    disableWhenInputFocused: true,
  },
  {
    id: 'open',
    key: 'ctrl+o',
    command: 'file.open',
    description: '打开文件',
    category: 'file',
  },
  {
    id: 'closeTab',
    key: 'ctrl+w',
    command: 'file.closeTab',
    description: '关闭当前标签页',
    category: 'file',
  },
  {
    id: 'newFile',
    key: 'ctrl+n',
    command: 'file.newFile',
    description: '新建文件',
    category: 'file',
  },
  {
    id: 'newWindow',
    key: 'ctrl+shift+n',
    command: 'file.newWindow',
    description: '新建窗口',
    category: 'file',
  },
  {
    id: 'closeWindow',
    key: 'ctrl+shift+w',
    command: 'file.closeWindow',
    description: '关闭窗口',
    category: 'file',
  },

  // 编辑操作
  {
    id: 'undo',
    key: 'ctrl+z',
    command: 'edit.undo',
    description: '撤销',
    category: 'edit',
    disableWhenInputFocused: true,
  },
  {
    id: 'redo',
    key: 'ctrl+shift+z',
    command: 'edit.redo',
    description: '重做',
    category: 'edit',
    disableWhenInputFocused: true,
  },
  {
    id: 'find',
    key: 'ctrl+f',
    command: 'edit.find',
    description: '查找',
    category: 'edit',
  },
  {
    id: 'toggleLineComment',
    key: 'ctrl+/',
    command: 'edit.toggleLineComment',
    description: '切换行注释',
    category: 'edit',
    disableWhenInputFocused: true,
  },

  // 导航操作
  {
    id: 'nextTab',
    key: 'ctrl+tab',
    command: 'navigate.nextTab',
    description: '切换到下一个标签页',
    category: 'navigate',
  },
  {
    id: 'prevTab',
    key: 'ctrl+shift+tab',
    command: 'navigate.prevTab',
    description: '切换到上一个标签页',
    category: 'navigate',
  },

  // 视图操作
  {
    id: 'commandPalette',
    key: 'ctrl+shift+p',
    command: 'view.commandPalette',
    description: '显示命令面板',
    category: 'view',
  },
  {
    id: 'commandPaletteF1',
    key: 'f1',
    command: 'view.commandPalette',
    description: '显示命令面板',
    category: 'view',
  },
  {
    id: 'globalSearch',
    key: 'ctrl+shift+f',
    command: 'view.globalSearch',
    description: '全局搜索',
    category: 'view',
  },
  {
    id: 'toggleSidebar',
    key: 'ctrl+b',
    command: 'view.toggleSidebar',
    description: '切换侧边栏显示',
    category: 'view',
  },
  {
    id: 'toggleBottomPanel',
    key: 'ctrl+j',
    command: 'view.toggleBottomPanel',
    description: '切换底部面板',
    category: 'view',
  },
  {
    id: 'showExplorer',
    key: 'ctrl+shift+e',
    command: 'view.showExplorer',
    description: '显示文件浏览器',
    category: 'view',
  },
  {
    id: 'showGit',
    key: 'ctrl+shift+g',
    command: 'view.showGit',
    description: '显示 Git 面板',
    category: 'view',
  },
  {
    id: 'showExtensions',
    key: 'ctrl+shift+x',
    command: 'view.showExtensions',
    description: '显示扩展面板',
    category: 'view',
  },
  {
    id: 'showProblems',
    key: 'ctrl+shift+m',
    command: 'view.showProblems',
    description: '显示问题面板',
    category: 'view',
  },
  {
    id: 'toggleTerminal',
    key: 'ctrl+`',
    command: 'view.toggleTerminal',
    description: '切换终端',
    category: 'terminal',
  },
  {
    id: 'showOutput',
    key: 'ctrl+shift+u',
    command: 'view.showOutput',
    description: '显示输出面板',
    category: 'view',
  },

  // 设置
  {
    id: 'openSettings',
    key: 'ctrl+,',
    command: 'settings.open',
    description: '打开设置',
    category: 'view',
  },

  // 通用操作
  {
    id: 'escape',
    key: 'escape',
    command: 'general.escape',
    description: '关闭面板/取消操作',
    category: 'view',
  },
];

/** 切换到第 N 个标签页的快捷键（Ctrl+1 到 Ctrl+9） */
export const TAB_SWITCH_SHORTCUTS: Shortcut[] = Array.from({ length: 9 }, (_, i) => ({
  id: `switchToTab${i + 1}`,
  key: `ctrl+${i + 1}`,
  command: 'navigate.switchToTab',
  description: `切换到第 ${i + 1} 个标签页`,
  category: 'navigate' as ShortcutCategory,
}));

/** 获取所有默认快捷键（包括标签页切换） */
export function getAllDefaultShortcuts(): Shortcut[] {
  return [...DEFAULT_SHORTCUTS, ...TAB_SWITCH_SHORTCUTS];
}

/** localStorage 键名 */
const STORAGE_KEY = 'ai-ide-shortcuts';

/** 从 localStorage 加载快捷键配置 */
export function loadShortcutsFromStorage(): Shortcut[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Shortcut[];
    }
  } catch (err) {
    console.error('加载快捷键配置失败:', err);
  }
  return null;
}

/** 保存快捷键配置到 localStorage */
export function saveShortcutsToStorage(shortcuts: Shortcut[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (err) {
    console.error('保存快捷键配置失败:', err);
  }
}

/** 检测当前平台是否为 macOS */
export function isMacOS(): boolean {
  return navigator.platform.toLowerCase().includes('mac');
}

/** 将快捷键中的 ctrl 替换为 macOS 的 cmd（meta） */
export function adaptShortcutForPlatform(key: string): string {
  if (isMacOS()) {
    // 将 ctrl+ 替换为 cmd+（使用 meta 表示）
    return key.replace(/^ctrl\+/, 'meta+').replace(/\+ctrl\+/g, '+meta+');
  }
  return key;
}

/** 获取显示用的快捷键字符串（macOS 显示为 ⌘） */
export function getShortcutDisplay(key: string): string {
  const adapted = adaptShortcutForPlatform(key);
  return adapted
    .replace('meta+', '⌘')
    .replace('ctrl+', 'Ctrl+')
    .replace('shift+', 'Shift+')
    .replace('alt+', 'Alt+')
    .toUpperCase();
}

/** 解析快捷键字符串为按键对象 */
export interface ParsedShortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

/** 解析快捷键字符串 */
export function parseShortcut(shortcutKey: string): ParsedShortcut {
  const parts = shortcutKey.toLowerCase().split('+');
  const key = parts.pop() || '';

  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key,
  };
}

/** 匹配键盘事件与快捷键 */
export function matchKeyboardEvent(
  event: KeyboardEvent,
  parsed: ParsedShortcut
): boolean {
  // 特殊键匹配
  const eventKey = event.key.toLowerCase();

  if (parsed.key === 'escape') {
    return eventKey === 'escape';
  }

  // 功能键匹配
  if (parsed.key.startsWith('f') && parsed.key.length > 1) {
    return eventKey === parsed.key;
  }

  // 反引号键匹配
  if (parsed.key === '`') {
    return eventKey === '`';
  }

  // 数字键匹配
  if (/^[0-9]$/.test(parsed.key)) {
    return eventKey === parsed.key;
  }

  // 字母键匹配
  if (/^[a-z]$/.test(parsed.key)) {
    return eventKey === parsed.key;
  }

  // 符号键匹配
  const symbolMap: Record<string, string> = {
    '/': '/',
    '.': '.',
    ',': ',',
    ';': ';',
    '[': '[',
    ']': ']',
    '\\': '\\',
    '-': '-',
    '=': '=',
    '`': '`',
  };

  if (parsed.key in symbolMap) {
    return eventKey === symbolMap[parsed.key];
  }

  return false;
}

/** 检查修饰键是否匹配 */
export function matchModifiers(
  event: KeyboardEvent,
  parsed: ParsedShortcut
): boolean {
  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta
  );
}

/** 检查当前焦点是否在输入框内 */
export function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isEditable =
    tagName === 'input' ||
    tagName === 'textarea' ||
    activeElement.getAttribute('contenteditable') === 'true';

  // Monaco Editor 的输入区域
  const isMonacoEditor = activeElement.classList.contains('monaco-editor') ||
    activeElement.closest('.monaco-editor') !== null;

  return isEditable || isMonacoEditor;
}
