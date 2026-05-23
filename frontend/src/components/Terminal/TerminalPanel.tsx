import { Terminal } from './Terminal';
import { TerminalSquare, Bot, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { MessageList } from '../Chat/MessageList';
import { MessageInput } from '../Chat/MessageInput';

/**
 * 底部面板标签类型
 */
type BottomTab = 'terminal' | 'ai';

/**
 * 终端面板 Props
 */
interface TerminalPanelProps {
  /** 当前主题 */
  theme: 'light' | 'dark';
  /** 当前激活的标签 */
  activeTab: BottomTab;
  /** 标签切换回调 */
  onTabChange: (tab: BottomTab) => void;
}

/**
 * 底部面板容器组件
 *
 * 与 AI 面板共享底部区域，提供标签切换功能。
 * 包含标题栏和终端显示区域。
 */
export default function TerminalPanel({ theme, activeTab, onTabChange }: TerminalPanelProps) {
  const isTerminal = activeTab === 'terminal';
  const { messages, clearMessages } = useChatStore();

  return (
    <div className="flex flex-col h-full border-t border-border bg-background">
      {/* 标题栏和标签切换 */}
      <div className="flex items-center justify-between h-8 px-2 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange('terminal')}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-t text-xs font-medium transition-colors
              ${isTerminal
                ? 'bg-background text-foreground border-t border-l border-r border-border'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <TerminalSquare size={14} />
            <span>终端</span>
          </button>
          <button
            onClick={() => onTabChange('ai')}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-t text-xs font-medium transition-colors
              ${!isTerminal
                ? 'bg-background text-foreground border-t border-l border-r border-border'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <Bot size={14} />
            <span>AI 助手</span>
            {messages.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded-full">
                {messages.length}
              </span>
            )}
          </button>
        </div>

        {/* AI 面板工具栏 */}
        {!isTerminal && messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="清空对话"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {isTerminal ? (
          <Terminal theme={theme} />
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              <MessageList />
            </div>
            <MessageInput />
          </div>
        )}
      </div>
    </div>
  );
}
