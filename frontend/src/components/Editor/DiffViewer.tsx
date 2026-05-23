import { useCallback, useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { Columns2, Rows3, X } from 'lucide-react';

/**
 * DiffViewer 组件 Props 接口
 */
interface DiffViewerProps {
  /** 原始内容 */
  original: string;
  /** 修改后内容 */
  modified: string;
  /** 文件语言类型 */
  language?: string;
}

/**
 * Monaco Diff Editor 组件
 *
 * 提供左右分屏和内联两种模式的代码对比功能，支持主题同步。
 */
export function DiffViewer({ original, modified, language = 'typescript' }: DiffViewerProps) {
  const { resolvedTheme } = useThemeStore();
  const { diff, toggleDiffInlineMode, closeDiff } = useEditorStore();

  const monacoTheme = useMemo(() => {
    return resolvedTheme === 'dark' ? 'vs-dark' : 'vs';
  }, [resolvedTheme]);

  const editorOptions = useMemo(
    () => ({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on' as const,
      lineNumbers: 'on' as const,
      renderWhitespace: 'selection' as const,
      smoothScrolling: true,
      cursorStyle: 'line' as const,
      cursorBlinking: 'smooth' as const,
      folding: true,
      foldingHighlight: true,
      renderLineHighlight: 'all' as const,
      roundedSelection: false,
      lineHeight: 22,
      letterSpacing: 0.5,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      padding: { top: 16, bottom: 16 },
      scrollbar: {
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        vertical: 'auto' as const,
        horizontal: 'auto' as const,
      },
      renderSideBySide: !diff.inlineMode,
      readOnly: true,
    }),
    [diff.inlineMode]
  );

  const handleMount = useCallback(() => {
  }, []);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Diff 工具栏 */}
      <div className="flex items-center justify-between h-9 px-3 border-b border-border bg-background">
        <span className="text-sm font-medium text-foreground">代码对比</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDiffInlineMode}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-secondary-foreground"
            title={diff.inlineMode ? '切换到分屏模式' : '切换到内联模式'}
          >
            {diff.inlineMode ? <Columns2 size={14} /> : <Rows3 size={14} />}
            <span>{diff.inlineMode ? '分屏' : '内联'}</span>
          </button>
          <button
            onClick={closeDiff}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="关闭对比"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {/* Diff 编辑器区域 */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          theme={monacoTheme}
          language={language}
          original={original}
          modified={modified}
          options={editorOptions}
          onMount={handleMount}
          loading={
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              <span className="text-sm">对比编辑器加载中...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
