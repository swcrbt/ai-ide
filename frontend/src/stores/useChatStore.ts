import { create } from 'zustand';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { CreateChatSession, SendChatMessage, ClearChatMessages } from '../../wailsjs/go/main/App';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatState {
  messages: Message[];
  inputText: string;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;

  setInputText: (text: string) => void;
  sendMessage: (content: string) => Promise<void>;
  startStream: () => void;
  appendStream: (content: string) => void;
  endStream: () => void;
  clearMessages: () => void;
  stopStream: () => void;
  initSession: () => Promise<void>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  inputText: '',
  isLoading: false,
  sessionId: null,
  error: null,

  initSession: async () => {
    const state = get();
    if (state.sessionId) return;
    try {
      const id = await CreateChatSession();
      set({ sessionId: id, error: null });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ error: errMsg });
    }
  },

  setInputText: (text) => set({ inputText: text }),

  sendMessage: async (content) => {
    const state = get();
    if (state.isLoading || !content.trim()) return;

    // 确保会话已创建
    if (!state.sessionId) {
      try {
        const id = await CreateChatSession();
        set({ sessionId: id, error: null });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // 将错误作为 assistant 消息显示，让用户能看到反馈
        set({
          messages: [
            ...state.messages,
            {
              id: generateId(),
              role: 'assistant',
              content: `⚠️ 无法发送消息：${errMsg}`,
              timestamp: Date.now(),
            },
          ],
          error: errMsg,
          isLoading: false,
        });
        return;
      }
    }

    const sessionId = get().sessionId!;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      inputText: '',
      isLoading: true,
      error: null,
    }));

    const assistantMessageId = generateId();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ],
    }));

    // 注册 Wails 事件监听，保存取消订阅函数
    const chunkEvent = `ai:chunk:${sessionId}`;
    const doneEvent = `ai:done:${sessionId}`;
    const errorEvent = `ai:error:${sessionId}`;

    const unsubscribeChunk = EventsOn(chunkEvent, (chunk: string) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + chunk }
            : msg
        ),
      }));
    });

    const unsubscribeDone = EventsOn(doneEvent, () => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false }
            : msg
        ),
        isLoading: false,
      }));
      unsubscribeChunk();
      unsubscribeDone();
    });

    const unsubscribeError = EventsOn(errorEvent, (errMsg: string) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + `\n\n[错误: ${errMsg}]`, isStreaming: false }
            : msg
        ),
        isLoading: false,
        error: errMsg,
      }));
      unsubscribeChunk();
      unsubscribeDone();
      unsubscribeError();
    });

    try {
      await SendChatMessage(sessionId, content.trim());
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + `\n\n[错误: ${errMsg}]`, isStreaming: false }
            : msg
        ),
        isLoading: false,
        error: errMsg,
      }));
      unsubscribeChunk();
      unsubscribeDone();
      unsubscribeError();
    }
  },

  startStream: () => {
    set({ isLoading: true });
  },

  appendStream: (content) => {
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        return {
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, content: msg.content + content }
              : msg
          ),
        };
      }
      return state;
    });
  },

  endStream: () => {
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        return {
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, isStreaming: false }
              : msg
          ),
          isLoading: false,
        };
      }
      return { isLoading: false };
    });
  },

  clearMessages: () => {
    const state = get();
    if (state.sessionId) {
      ClearChatMessages(state.sessionId).catch(() => {});
    }
    set({ messages: [], isLoading: false, error: null });
  },

  stopStream: () => {
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        return {
          messages: state.messages.map((msg, idx) =>
            idx === state.messages.length - 1
              ? { ...msg, isStreaming: false }
              : msg
          ),
          isLoading: false,
        };
      }
      return { isLoading: false };
    });
  },
}));
