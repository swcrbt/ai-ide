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
});
