import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Command, X } from 'lucide-react';
import {
  type Shortcut,
  CATEGORY_NAMES,
  getAllDefaultShortcuts,
  getShortcutDisplay,
} from '../config/shortcuts';
import { type ShortcutCommand } from '../config/shortcuts';

/** 命令面板选项接口 */
export interface CommandPaletteItem {
  command: ShortcutCommand;
  label: string;
  shortcut: string;
  category: string;
  action: () => void;
}

/** 命令面板组件 Props */
interface CommandPaletteProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 命令列表 */
  items: CommandPaletteItem[];
}

/**
 * 命令面板组件
 *
 * 显示所有可用命令，支持搜索过滤和快捷键显示。
 * 按 Enter 执行选中的命令，按 Escape 关闭。
 */
export function CommandPalette({ isOpen, onClose, items }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 根据搜索词过滤命令
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.shortcut.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // 重置选中索引当过滤结果变化时
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      // 短暂延迟确保渲染完成
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, selectedIndex, onClose]
  );

  // 确保选中项在可视区域内
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-popover rounded-lg shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入命令名称或快捷键..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
            <Command size={10} />
            <span>Esc</span>
          </div>
        </div>

        {/* 命令列表 */}
        <div
          ref={listRef}
          className="max-h-96 overflow-y-auto py-2"
        >
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search size={32} className="mb-2 opacity-50" />
              <span className="text-sm">未找到匹配的命令</span>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={`${item.command}-${index}`}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 text-left
                  transition-colors duration-100
                  ${
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.category}
                  </span>
                </div>
                <kbd className="text-xs font-mono bg-secondary px-2 py-0.5 rounded text-secondary-foreground border border-border">
                  {item.shortcut}
                </kbd>
              </button>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span>↑↓ 选择</span>
          <span>↵ 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 从快捷键列表生成命令面板项
 */
export function createCommandPaletteItems(
  shortcuts: Shortcut[],
  handlerMap: Map<string, () => void>
): CommandPaletteItem[] {
  return shortcuts
    .filter((shortcut) => handlerMap.has(shortcut.command))
    .map((shortcut) => ({
      command: shortcut.command as ShortcutCommand,
      label: shortcut.description,
      shortcut: getShortcutDisplay(shortcut.key),
      category: CATEGORY_NAMES[shortcut.category],
      action:
        handlerMap.get(shortcut.command) ||
        (() => console.warn(`未实现的命令: ${shortcut.command}`)),
    }));
}
