import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from './useChatStore';

// 存储所有注册的事件回调，用于手动触发流式事件
const eventCallbacks: Record<string, Array<(data: unknown) => void>> = {};

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((event: string, callback: (data: unknown) => void) => {
    if (!eventCallbacks[event]) {
      eventCallbacks[event] = [];
    }
    eventCallbacks[event].push(callback);
    return vi.fn(); // 返回取消订阅函数
  }),
}));

vi.mock('../../wailsjs/go/main/App', () => ({
  CreateChatSession: vi.fn(() => Promise.resolve('test-session-id')),
  SendChatMessage: vi.fn(() => Promise.resolve()),
  ClearChatMessages: vi.fn(() => Promise.resolve()),
}));

function triggerEvent(event: string, data: unknown) {
  const callbacks = eventCallbacks[event] || [];
  callbacks.forEach((cb) => cb(data));
}

describe('useChatStore', () => {
  beforeEach(() => {
    // 清空事件回调
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);

    // 重置 store 状态
    const store = useChatStore.getState();
    store.clearMessages();
    useChatStore.setState({
      messages: [],
      inputText: '',
      isLoading: false,
      sessionId: null,
      error: null,
    });

    vi.clearAllMocks();
  });

  describe('消息发送', () => {
    it('应能发送消息', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('你好');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2); // 用户消息 + 助手消息
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('你好');
      expect(state.messages[1].role).toBe('assistant');
      expect(state.inputText).toBe('');
      expect(state.isLoading).toBe(true);
    });

    it('不应发送空消息', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('不应发送仅空白字符的消息', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('   \n\t  ');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(0);
    });

    it('发送消息时 inputText 应被清空', async () => {
      const store = useChatStore.getState();

      store.setInputText('测试消息');
      await store.sendMessage('测试消息');

      expect(useChatStore.getState().inputText).toBe('');
    });

    it('正在加载时不应发送新消息', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('第一条');
      const beforeCount = useChatStore.getState().messages.length;

      await store.sendMessage('第二条');
      const afterCount = useChatStore.getState().messages.length;

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('输入文本', () => {
    it('应能设置输入文本', () => {
      const store = useChatStore.getState();

      store.setInputText('Hello World');

      expect(useChatStore.getState().inputText).toBe('Hello World');
    });

    it('应能设置空输入文本', () => {
      const store = useChatStore.getState();

      store.setInputText('');

      expect(useChatStore.getState().inputText).toBe('');
    });
  });

  describe('流式消息', () => {
    it('应能开始流式输出', () => {
      const store = useChatStore.getState();

      store.startStream();

      expect(useChatStore.getState().isLoading).toBe(true);
    });

    it('应能追加流式内容', async () => {
      const store = useChatStore.getState();

      // 先发送一条消息以创建助手消息
      await store.sendMessage('测试');

      // 模拟流式追加
      store.appendStream('新内容');

      const state = useChatStore.getState();
      const lastMsg = state.messages[state.messages.length - 1];
      expect(lastMsg.content).toContain('新内容');
      expect(lastMsg.isStreaming).toBe(true);
    });

    it('没有流式消息时不应追加内容', () => {
      const store = useChatStore.getState();

      // 没有发送消息直接追加
      store.appendStream('内容');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(0);
    });

    it('应能结束流式输出', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('测试');
      store.endStream();

      const state = useChatStore.getState();
      const lastMsg = state.messages[state.messages.length - 1];
      expect(lastMsg.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('应能停止流式输出', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('测试');
      store.stopStream();

      const state = useChatStore.getState();
      const lastMsg = state.messages[state.messages.length - 1];
      expect(lastMsg.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('消息管理', () => {
    it('应能清空所有消息', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('消息1');
      store.clearMessages();

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('清空消息时应停止流式输出', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('测试');
      store.clearMessages();

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('消息应有唯一ID', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('消息1');
      store.stopStream(); // 确保第一条消息完成
      await store.sendMessage('消息2');

      const state = useChatStore.getState();
      const ids = state.messages.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('消息应有时间戳', async () => {
      const store = useChatStore.getState();
      const beforeTime = Date.now();

      await store.sendMessage('测试');

      const state = useChatStore.getState();
      expect(state.messages[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(state.messages[0].timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('边界情况', () => {
    it('重复发送相同内容的消息', async () => {
      const store = useChatStore.getState();

      await store.sendMessage('相同内容');
      store.stopStream();
      await store.sendMessage('相同内容');

      const state = useChatStore.getState();
      const userMessages = state.messages.filter((m) => m.role === 'user');
      expect(userMessages).toHaveLength(2);
    });

    it('长时间消息不应导致问题', async () => {
      const store = useChatStore.getState();
      const longContent = 'a'.repeat(10000);

      await store.sendMessage(longContent);

      const state = useChatStore.getState();
      const userMsg = state.messages.find((m) => m.role === 'user');
      expect(userMsg?.content).toBe(longContent);
    });
  });
});
