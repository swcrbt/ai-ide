import { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Square } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';

export function MessageInput() {
  const { t } = useTranslation();
  const { inputText, isLoading, setInputText, sendMessage, stopStream } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (isLoading) {
      stopStream();
      return;
    }
    if (inputText.trim()) {
      sendMessage(inputText);
    }
  }, [inputText, isLoading, sendMessage, stopStream]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
    },
    [setInputText]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, [inputText]);

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/50 p-2">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('ai.inputPlaceholder')}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none max-h-[200px] min-h-[20px] py-1 px-1"
        />
        <button
          onClick={handleSend}
          className={`p-2 rounded-md transition-colors flex-shrink-0 ${
            isLoading
              ? 'bg-destructive/10 hover:bg-destructive/20 text-destructive'
              : inputText.trim()
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
          disabled={!isLoading && !inputText.trim()}
          title={isLoading ? t('ai.stop') : t('ai.send')}
        >
          {isLoading ? <Square size={16} /> : <Send size={16} />}
        </button>
      </div>
      <div className="mt-1.5 text-center">
        <span className="text-[10px] text-muted-foreground">
          {t('ai.shiftEnterHint')}
        </span>
      </div>
    </div>
  );
}
