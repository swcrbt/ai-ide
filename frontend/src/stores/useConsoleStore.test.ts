import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore, resetNextId } from './useConsoleStore';

describe('useConsoleStore', () => {
  beforeEach(() => {
    // 重置 id 计数器
    resetNextId();
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

  // ==================== 边界条件测试 ====================

  it('addEntry 应处理空消息', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'log', message: '', timestamp: 1000, source: 'console', args: [] });

    const state = useConsoleStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].message).toBe('');
  });

  it('addEntry 应处理 null 和 undefined 参数', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'warn', message: 'null test', timestamp: 2000, source: 'console', args: [null, undefined] });

    const state = useConsoleStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].args).toEqual([null, undefined]);
  });

  it('error 级别的 addEntry 应递增 errorCount', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'error', message: '错误1', timestamp: 1000, source: 'console', args: [] });
    store.addEntry({ level: 'error', message: '错误2', timestamp: 2000, source: 'console', args: [] });
    store.addEntry({ level: 'warn', message: '警告', timestamp: 3000, source: 'console', args: [] });

    const state = useConsoleStore.getState();
    expect(state.errorCount).toBe(2);
    expect(state.warnCount).toBe(1);
  });

  it('过滤 + 搜索应同时生效', () => {
    const store = useConsoleStore.getState();
    store.addEntry({ level: 'log', message: '初始化完成', timestamp: 1000, source: 'console', args: [] });
    store.addEntry({ level: 'error', message: '初始化错误', timestamp: 2000, source: 'console', args: [] });
    store.addEntry({ level: 'log', message: '渲染完成', timestamp: 3000, source: 'console', args: [] });

    // 只显示 error 级别 + 搜索 "错误"
    store.setFilterLevel('log', false);
    store.setFilterLevel('info', false);
    store.setFilterLevel('debug', false);
    store.setSearchQuery('错误');

    const state = useConsoleStore.getState();
    const filtered = state.entries.filter((e) => {
      return state.filterLevel.has(e.level)
        && e.message.toLowerCase().includes(state.searchQuery.toLowerCase());
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('初始化错误');
  });

  // ==================== 劫持兼容性测试 ====================
  // 验证 console.log 通过 .bind(console) 后安全调用（WebKit 兼容）

  it('模拟劫持：通过 .bind(console) 调用原始 console 不应崩溃', () => {
    // 保存原始 console.log
    const originalLog = console.log.bind(console);

    // 替换 console.log 为劫持版本（模拟 App.tsx useEffect 的行为）
    const capturedEntries: string[] = [];
    const mockAddEntry = (entry: { message: string }) => {
      capturedEntries.push(entry.message);
    };

    const hijackedLog = (...args: unknown[]) => {
      // 通过绑定后的函数调用原始 console（这就是 .bind(console) 保护的地方）
      originalLog(...args);
      // 模拟 addEntry 调用
      mockAddEntry({ message: args.map(String).join(' ') });
    };

    // 替换 console.log
    const previousLog = console.log;
    console.log = hijackedLog as typeof console.log;

    try {
      // 调用 console.log 不应崩溃
      console.log('劫持测试消息');
      console.log('第二条消息', 42, true);

      // 验证消息被捕获
      expect(capturedEntries).toHaveLength(2);
      expect(capturedEntries[0]).toBe('劫持测试消息');
      expect(capturedEntries[1]).toBe('第二条消息 42 true');
    } finally {
      // 恢复原始 console.log
      console.log = previousLog;
    }
  });

  it('模拟劫持：多级 log 调用不应崩溃', () => {
    const originalLog = console.log.bind(console);
    const logs: string[] = [];

    const hijackedLog = (...args: unknown[]) => {
      originalLog(...args);
      logs.push(args.map(String).join(' '));
    };

    const prev = console.log;
    console.log = hijackedLog as typeof console.log;

    try {
      // 连续快速调用
      for (let i = 0; i < 100; i++) {
        console.log(`消息 ${i}`);
      }
      expect(logs).toHaveLength(100);
      expect(logs[0]).toBe('消息 0');
      expect(logs[99]).toBe('消息 99');
    } finally {
      console.log = prev;
    }
  });
});
