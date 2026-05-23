import { useCallback, useRef } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { X, FileCode } from 'lucide-react';

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

export function TabBar() {
  const { tabs, activeTab, switchTab, closeFile } = useEditorStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback(
    (path: string) => {
      switchTab(path);
    },
    [switchTab]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      closeFile(path);
    },
    [closeFile]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.preventDefault();
      closeFile(path);
    },
    [closeFile]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      className="flex items-center h-9 min-h-9 overflow-x-auto overflow-y-hidden border-b border-border bg-background scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.path === activeTab;
        const fileName = getFileName(tab.path);

        return (
          <div
            key={tab.path}
            onClick={() => handleTabClick(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
            className={`
              group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer
              border-r border-border select-none whitespace-nowrap
              transition-colors duration-150
              ${isActive
                ? 'bg-[hsl(var(--tab-active-bg))] text-[hsl(var(--tab-active-fg))]'
                : 'bg-[hsl(var(--tab-bg))] text-[hsl(var(--tab-fg))] hover:bg-accent hover:text-accent-foreground'
              }
            `}
            style={{ minWidth: 'fit-content' }}
          >
            <FileCode size={14} className="flex-shrink-0 opacity-70" />
            <span className="text-xs font-medium">{fileName}</span>
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 ml-0.5" title="未保存" />
            )}
            <button
              onClick={(e) => handleCloseClick(e, tab.path)}
              className={`
                flex items-center justify-center w-4 h-4 rounded-sm flex-shrink-0 ml-1
                opacity-0 group-hover:opacity-100 transition-opacity
                ${isActive ? 'opacity-100' : ''}
                hover:bg-destructive/10 hover:text-destructive
              `}
              title="关闭"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
