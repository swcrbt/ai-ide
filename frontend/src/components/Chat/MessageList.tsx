import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, User, Sparkles } from 'lucide-react';
import { VariableSizeList, VariableSizeList as List } from 'react-window';
import { useChatStore, type Message } from '../../stores/useChatStore';
import { CodeBlock } from './CodeBlock';

interface MessageContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
  fileName?: string;
}

/**
 * 解析消息内容，提取文本和代码块
 * 支持带文件名的代码块格式：```filename.ext\n代码内容\n```
 */
function parseMessageContent(content: string): MessageContent[] {
  const parts: MessageContent[] = [];
  const codeBlockRegex = /```([\w./-]+\.\w+)(?::[^\n]*)?\n?([\s\S]*?)```/g;
  const plainCodeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1].split('.').pop() || 'text',
      fileName: match[1],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    while ((match = plainCodeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', content: match[2].trim(), language: match[1] || 'text' });
      lastIndex = match.index + match[0].length;
    }
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts;
}

function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse align-middle" />
  );
}

/**
 * 单条消息气泡组件
 */
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const parts = useMemo(() => parseMessageContent(message.content), [message.content]);

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="flex flex-col items-end">
            <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-primary text-primary-foreground">
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
            <User size={14} className="text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-2 max-w-[90%]">
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-1">
          <Bot size={14} className="text-accent-foreground" />
        </div>
        <div className="flex flex-col">
          <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 bg-muted border border-border">
            <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {parts.map((part, idx) =>
                part.type === 'code' ? (
                  <CodeBlock key={idx} code={part.content} language={part.language} fileName={part.fileName} />
                ) : (
                  <p key={idx} className="whitespace-pre-wrap">{part.content}</p>
                )
              )}
              {message.isStreaming && <StreamingCursor />}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 消息行组件（用于 react-window VariableSizeList）
 */
const MessageRow: React.FC<any> = ({ index, style, data }) => {
  const message = data[index] as Message | undefined;
  if (!message) return null;

  return (
    <div style={style} className="px-4">
      <MessageBubble message={message} />
    </div>
  );
};

/**
 * 消息列表组件
 *
 * 支持虚拟滚动优化：当消息数量超过 50 条时自动启用虚拟滚动，
 * 只渲染可视区域的消息，保持滚动位置稳定。
 * 支持滚动到底部自动跟随新消息。
 */
export function MessageList() {
  const { t } = useTranslation();
  const { messages } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VariableSizeList>(null);
  const shouldScrollToBottomRef = useRef(true);

  const enableVirtualization = messages.length > 50;

  // 监听消息变化，控制滚动行为
  useEffect(() => {
    if (!enableVirtualization && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    } else if (enableVirtualization && listRef.current) {
      if (shouldScrollToBottomRef.current) {
        listRef.current.scrollToItem(messages.length - 1, 'end');
      }
    }
  }, [messages, enableVirtualization, listRef]);

  // 计算消息高度（估算）
  const getRowHeight = useCallback(
    (index: number) => {
      const message = messages[index];
      if (!message) return 80;

      let height = 60;
      const contentLength = message.content.length;
      if (contentLength > 500) {
        height += Math.min(contentLength / 10, 300);
      } else if (contentLength > 100) {
        height += contentLength / 20;
      }

      const codeBlockCount = (message.content.match(/```/g) || []).length / 2;
      height += codeBlockCount * 40;

      return Math.min(height, 500);
    },
    [messages]
  );

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-3">
          <Sparkles size={20} className="text-accent-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">
          {t('ai.title')}
        </h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          {t('ai.emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      {enableVirtualization ? (
        <List
          ref={listRef}
          itemCount={messages.length}
          itemSize={getRowHeight}
          itemData={messages}
          height={scrollRef.current?.clientHeight || 600}
          width="100%"
          overscanCount={3}
        >
          {MessageRow}
        </List>
      ) : (
        <div className="p-4 space-y-1">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}
