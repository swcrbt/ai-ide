import { useEffect, useCallback, useRef, useState } from 'react';
import {
  type Shortcut,
  type ShortcutCommand,
  getAllDefaultShortcuts,
  loadShortcutsFromStorage,
  saveShortcutsToStorage,
  adaptShortcutForPlatform,
  parseShortcut,
  matchKeyboardEvent,
  matchModifiers,
  isInputFocused,
} from '../config/shortcuts';

/** 快捷键执行函数类型 */
export type ShortcutHandler = (command: ShortcutCommand, shortcut: Shortcut) => void;

/** Toast 通知接口 */
export interface ShortcutToast {
  id: string;
  message: string;
  type: 'success' | 'info';
}

/** 快捷键 hook 返回值 */
export interface UseShortcutsReturn {
  /** 当前注册的快捷键列表 */
  shortcuts: Shortcut[];
  /** 注册命令处理器 */
  registerHandler: (command: ShortcutCommand, handler: () => void) => void;
  /** 注销命令处理器 */
  unregisterHandler: (command: ShortcutCommand) => void;
  /** Toast 通知列表 */
  toasts: ShortcutToast[];
  /** 移除 Toast */
  removeToast: (id: string) => void;
  /** 显示快捷键提示 */
  showToast: (message: string, type?: 'success' | 'info') => void;
}

/**
 * 快捷键系统 Hook
 *
 * 注册全局键盘事件监听，匹配快捷键并执行对应命令。
 * 支持平台适配（macOS 使用 Cmd 代替 Ctrl）。
 * 支持快捷键持久化到 localStorage。
 */
export function useShortcuts(): UseShortcutsReturn {
  // 加载或初始化快捷键配置
  const [shortcuts] = useState<Shortcut[]>(() => {
    const stored = loadShortcutsFromStorage();
    if (stored) return stored;
    const defaults = getAllDefaultShortcuts();
    saveShortcutsToStorage(defaults);
    return defaults;
  });

  // 命令处理器映射
  const handlersRef = useRef<Map<string, () => void>>(new Map());

  // Toast 通知状态
  const [toasts, setToasts] = useState<ShortcutToast[]>([]);
  const toastIdRef = useRef(0);

  /** 显示 Toast 提示 */
  const showToast = useCallback((message: string, type: 'success' | 'info' = 'info') => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // 2秒后自动移除
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);
  }, []);

  /** 手动移除 Toast */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** 注册命令处理器 */
  const registerHandler = useCallback((command: ShortcutCommand, handler: () => void) => {
    handlersRef.current.set(command, handler);
  }, []);

  /** 注销命令处理器 */
  const unregisterHandler = useCallback((command: ShortcutCommand) => {
    handlersRef.current.delete(command);
  }, []);

  /** 执行匹配的快捷键命令 */
  const executeCommand = useCallback(
    (shortcut: Shortcut) => {
      const handler = handlersRef.current.get(shortcut.command);
      if (handler) {
        handler();
        // 显示操作提示（仅针对部分命令）
        if (['file.save', 'file.newFile', 'file.closeTab'].includes(shortcut.command)) {
          showToast(shortcut.description, 'success');
        }
      } else {
        // 命令未实现时显示提示
        if (!shortcut.command.includes('switchToTab')) {
          showToast(`${shortcut.description}（预留）`, 'info');
        }
      }
    },
    [showToast]
  );

  /** 处理键盘按下事件 */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 跳过仅包含修饰键的事件
      if (
        ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(event.key) &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        return;
      }

      // 遍历所有快捷键进行匹配
      for (const shortcut of shortcuts) {
        const platformKey = adaptShortcutForPlatform(shortcut.key);
        const parsed = parseShortcut(platformKey);

        // 检查修饰键是否匹配
        if (!matchModifiers(event, parsed)) {
          continue;
        }

        // 检查按键是否匹配
        if (!matchKeyboardEvent(event, parsed)) {
          continue;
        }

        // 如果当前焦点在输入框内，且该快捷键标记为需要禁用
        if (shortcut.disableWhenInputFocused && isInputFocused()) {
          continue;
        }

        // 阻止默认浏览器行为
        event.preventDefault();
        event.stopPropagation();

        // 处理切换到第 N 个标签页的特殊逻辑
        if (shortcut.command === 'navigate.switchToTab') {
          const tabIndex = parseInt(shortcut.key.replace(/[^0-9]/g, ''), 10) - 1;
          const switchHandler = handlersRef.current.get('navigate.switchToTab');
          if (switchHandler) {
            // 使用闭包存储标签页索引
            (switchHandler as (index: number) => void)(tabIndex);
          }
          return;
        }

        // 执行命令
        executeCommand(shortcut);
        return;
      }
    },
    [shortcuts, executeCommand]
  );

  // 注册全局键盘事件监听
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown]);

  return {
    shortcuts,
    registerHandler,
    unregisterHandler,
    toasts,
    removeToast,
    showToast,
  };
}
