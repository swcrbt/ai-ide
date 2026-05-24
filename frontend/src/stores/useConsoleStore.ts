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

export let nextId = 1;

export function resetNextId() {
  nextId = 1;
}

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
