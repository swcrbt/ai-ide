import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { DiffPreview } from '../Diff/DiffPreview';

export interface ChatPanelProps {
  isCompact?: boolean;
}

export function ChatPanel({ isCompact = false }: ChatPanelProps) {
  const { t } = useTranslation();
  const { messages, clearMessages, sendMessage } = useChatStore();
  const activeTaskId = useTaskStore((state) => state.activeTaskId);

  useEffect(() => {
    const activeTask = useTaskStore.getState().getActiveTask();
    if (activeTask) {
      console.log(`[ChatPanel] 上下文已绑定任务: ${activeTask.title} (${activeTask.branch})`);
    }
  }, [activeTaskId]);

  const handleSendMessage = useCallback(
    (content: string) => {
      const activeTask = useTaskStore.getState().getActiveTask();
      if (activeTask) {
        const contextPrompt = `[任务: ${activeTask.title}](分支: ${activeTask.branch})\n${content}`;
        sendMessage(contextPrompt);
      } else {
        sendMessage(content);
      }
    },
    [sendMessage]
  );

  return (
    <div className="flex-shrink-0 flex flex-col bg-background relative h-full w-full">
      <div
        className={`flex items-center justify-between px-3 border-b border-border bg-muted/30 flex-shrink-0 ${
          isCompact ? 'h-8' : 'h-10'
        }`}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={isCompact ? 14 : 16} className="text-muted-foreground" />
          <span
            className={`font-medium text-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}
          >
            {t('ai.title')}
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
              title={t('ai.clearChat')}
            >
              <Trash2 size={isCompact ? 12 : 14} />
            </button>
          )}
        </div>
      </div>

      <MessageList />
      <MessageInput onSend={handleSendMessage} isCompact={isCompact} />
      <DiffPreview />
    </div>
  );
}
