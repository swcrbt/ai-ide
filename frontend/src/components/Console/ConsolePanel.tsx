import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Trash2, Pause, Play } from 'lucide-react';
import { useConsoleStore, type ConsoleEntry } from '../../stores/useConsoleStore';

/** 级别颜色映射 */
const LEVEL_STYLES: Record<ConsoleEntry['level'], { bg: string; text: string; label: string }> = {
  error: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'text-red-500' },
  warn: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'text-yellow-500' },
  info: { bg: '', text: 'text-blue-400', label: 'text-blue-500' },
  debug: { bg: '', text: 'text-gray-500', label: 'text-gray-500' },
  log: { bg: '', text: 'text-foreground', label: 'text-muted-foreground' },
};

/** 级别显示标签 */
const LEVEL_LABELS: Record<ConsoleEntry['level'], string> = {
  log: 'LOG',
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
};

/** 时间戳格式化 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 所有可过滤级别 */
const ALL_LEVELS: ConsoleEntry['level'][] = ['log', 'error', 'warn', 'info', 'debug'];

/**
 * 内嵌控制台面板
 *
 * 捕获 console.* 输出并实时显示，支持按级别过滤、关键词搜索、
 * 清空、自动滚动等功能。
 */
export function ConsolePanel() {
  const entries = useConsoleStore((s) => s.entries);
  const filterLevel = useConsoleStore((s) => s.filterLevel);
  const searchQuery = useConsoleStore((s) => s.searchQuery);
  const autoScroll = useConsoleStore((s) => s.autoScroll);
  const clear = useConsoleStore((s) => s.clear);
  const setFilterLevel = useConsoleStore((s) => s.setFilterLevel);
  const setSearchQuery = useConsoleStore((s) => s.setSearchQuery);
  const setAutoScroll = useConsoleStore((s) => s.setAutoScroll);

  const listRef = useRef<HTMLDivElement>(null);

  // 过滤 + 搜索
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!filterLevel.has(e.level)) return false;
      if (searchQuery && !e.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterLevel, searchQuery]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (autoScroll && filteredEntries.length > 0) {
      scrollToBottom();
    }
  }, [filteredEntries.length, autoScroll, scrollToBottom]);

  const handleClear = () => {
    clear();
  };

  const handleToggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
  };

  const filteredCount = entries.length - filteredEntries.length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 过滤栏 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border flex-shrink-0 flex-wrap">
        {ALL_LEVELS.map((level) => {
          const active = filterLevel.has(level);
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(level, !active)}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer ${
                active
                  ? `${LEVEL_STYLES[level].bg} ${LEVEL_STYLES[level].label} font-medium`
                  : 'text-muted-foreground opacity-40 hover:opacity-70'
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>

      {/* 搜索 + 操作栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border flex-shrink-0">
        <Search size={12} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索控制台输出..."
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={handleToggleAutoScroll}
          className="p-1 rounded hover:bg-accent transition-colors cursor-pointer"
          title={autoScroll ? '停止自动滚动' : '开启自动滚动'}
        >
          {autoScroll ? <Pause size={12} className="text-muted-foreground" /> : <Play size={12} className="text-muted-foreground" />}
        </button>
        <button
          onClick={handleClear}
          className="p-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
          title="清空"
        >
          <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 overflow-auto font-mono text-xs leading-5">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            控制台就绪，暂无输出
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const style = LEVEL_STYLES[entry.level];
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-2 px-2 py-0.5 ${style.bg} hover:brightness-110 transition-colors`}
              >
                <span className="text-muted-foreground flex-shrink-0 select-none">
                  {formatTime(entry.timestamp)}
                </span>
                <span className={`font-semibold flex-shrink-0 select-none ${style.label}`}>
                  {LEVEL_LABELS[entry.level]}
                </span>
                <span className={`break-all ${style.text}`}>
                  {entry.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border text-[11px] text-muted-foreground flex-shrink-0">
        <span>共 {entries.length} 条</span>
        {filteredCount > 0 && (
          <span>已过滤 {filteredCount} 条</span>
        )}
      </div>
    </div>
  );
}
