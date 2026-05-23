import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalSquare, Bot, X, Minus } from 'lucide-react';

export interface BottomPanelProps {
  activeTab: 'terminal' | 'ai';
  onTabChange: (tab: 'terminal' | 'ai') => void;
  onHide: () => void;
  children: {
    terminal: React.ReactNode;
    aiChat: React.ReactNode;
  };
}

const DEFAULT_HEIGHT = 200;
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 600;

export const BottomPanel: React.FC<BottomPanelProps> = ({
  activeTab,
  onTabChange,
  onHide,
  children,
}) => {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(height);

  const handleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = isMinimized ? DEFAULT_HEIGHT : height;
      e.preventDefault();
    },
    [height, isMinimized]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY;
      const rawHeight = startHeightRef.current + delta;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, rawHeight));

      setHeight(newHeight);
      setIsMinimized(newHeight <= MIN_HEIGHT + 5);
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

  const displayHeight = isMinimized ? MIN_HEIGHT : height;
  const isTerminal = activeTab === 'terminal';

  const tabs = [
    { key: 'terminal' as const, label: '终端', icon: TerminalSquare },
    { key: 'ai' as const, label: 'AI 助手', icon: Bot },
  ];

  return (
    <div
      className="flex flex-col bg-background border-t border-border shrink-0 relative"
      style={{ height: displayHeight }}
    >
      <div
        className="absolute -top-0.5 left-0 right-0 h-1.5 cursor-ns-resize z-20 hover:bg-primary/40 transition-colors"
        onMouseDown={handleMouseDown}
      />

      <div className="flex items-center justify-between h-10 px-2 border-b border-border bg-muted/30 flex-shrink-0 select-none">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => {
                  onTabChange(tab.key);
                  if (isMinimized) {
                    setIsMinimized(false);
                  }
                }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-background text-foreground border-t border-l border-r border-border'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={handleMinimize}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={isMinimized ? '展开' : '最小化'}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={onHide}
            className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            title="隐藏"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-hidden">
          {isTerminal ? children.terminal : children.aiChat}
        </div>
      )}
    </div>
  );
};
