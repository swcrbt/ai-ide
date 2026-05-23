import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, PanelRightOpen, PanelRightClose, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { DiffPreview } from '../Diff/DiffPreview';

export function ChatPanel() {
  const { t } = useTranslation();
  const { messages, clearMessages } = useChatStore();
  const [isOpen, setIsOpen] = useState(true);
  const [width, setWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(280, Math.min(600, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) {
    return (
      <div className="flex-shrink-0 border-l border-border bg-background">
        <button
          onClick={togglePanel}
          className="w-10 h-full flex flex-col items-center justify-start pt-4 hover:bg-accent transition-colors"
          title={t('ai.openPanel')}
        >
          <PanelRightOpen size={18} className="text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l border-border bg-background relative"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-10"
        onMouseDown={handleMouseDown}
        style={{ transform: 'translateX(-50%)' }}
      />

      <div className="h-10 flex items-center justify-between px-3 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{t('ai.title')}</span>
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
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={togglePanel}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title={t('ai.closePanel')}
          >
            <PanelRightClose size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <MessageList />
      <MessageInput />
      <DiffPreview />
    </div>
  );
}
