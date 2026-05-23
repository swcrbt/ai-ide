import { create } from 'zustand';

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
  streamTimer: ReturnType<typeof setInterval> | null;

  setInputText: (text: string) => void;
  sendMessage: (content: string) => void;
  startStream: () => void;
  appendStream: (content: string) => void;
  endStream: () => void;
  clearMessages: () => void;
  stopStream: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const MOCK_RESPONSES = [
  `当然可以！以下是一个简单的冒泡排序算法实现：\n\n\`\`\`typescript\nfunction bubbleSort(arr: number[]): number[] {\n  const n = arr.length;\n  for (let i = 0; i < n - 1; i++) {\n    for (let j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];\n      }\n    }\n  }\n  return arr;\n}\n\nconst data = [64, 34, 25, 12, 22, 11, 90];\nconsole.log(bubbleSort(data));\n\`\`\`\n\n这个算法的时间复杂度是 O(n²)，适用于小规模数据排序。`,
  `这是一个很好的问题！React 的 useEffect Hook 用于处理副作用：\n\n\`\`\`tsx\nimport { useEffect, useState } from 'react';\n\nfunction Example() {\n  const [count, setCount] = useState(0);\n\n  useEffect(() => {\n    document.title = \`点击了 \${count} 次\`;\n    \n    return () => {\n      console.log('清理副作用');\n    };\n  }, [count]);\n\n  return <button onClick={() => setCount(c => c + 1)}>点击</button>;\n}\n\`\`\`\n\n关键点：\n1. 第一个参数是副作用函数\n2. 第二个参数是依赖数组\n3. 可以返回清理函数`,
  `你好！我可以帮你编写代码、解答技术问题、优化算法等。请告诉我你需要什么帮助。`,
];

function getMockResponse(): string {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
}

function splitIntoChunks(text: string, chunkSize: number = 3): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  inputText: '',
  isLoading: false,
  sessionId: null,
  streamTimer: null,

  setInputText: (text) => set({ inputText: text }),

  sendMessage: (content) => {
    const state = get();
    if (state.isLoading || !content.trim()) return;

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
    }));

    const responseText = getMockResponse();
    const chunks = splitIntoChunks(responseText);
    let currentIndex = 0;

    const assistantMessageId = generateId();
    set((state) => ({
      messages: [
        ...state.messages,
        userMessage,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ],
    }));

    const timer = setInterval(() => {
      if (currentIndex >= chunks.length) {
        clearInterval(timer);
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          ),
          isLoading: false,
          streamTimer: null,
        }));
        return;
      }

      const chunk = chunks[currentIndex];
      currentIndex++;

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + chunk }
            : msg
        ),
      }));
    }, 30);

    set({ streamTimer: timer });
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
          streamTimer: null,
        };
      }
      return { isLoading: false, streamTimer: null };
    });
  },

  clearMessages: () => {
    const state = get();
    if (state.streamTimer) {
      clearInterval(state.streamTimer);
    }
    set({ messages: [], isLoading: false, streamTimer: null });
  },

  stopStream: () => {
    const state = get();
    if (state.streamTimer) {
      clearInterval(state.streamTimer);
    }
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
          streamTimer: null,
        };
      }
      return { isLoading: false, streamTimer: null };
    });
  },
}));
