import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { AlertTriangle } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { TabBar } from './TabBar';
import { DiffViewer } from './DiffViewer';
import { useLSP } from './LSPProvider';

/**
 * 编辑器模式类型
 */
type EditorMode = 'full' | 'basic' | 'highlight-only' | 'plaintext';

/**
 * 大文件降级配置
 */
const MODE_CONFIG: Record<
  EditorMode,
  {
    label: string;
    description: string;
    maxSize: number;
    enableLSP: boolean;
    enableComplexAnalysis: boolean;
    enableHighlight: boolean;
  }
> = {
  full: {
    label: '完整模式',
    description: '完整的 LSP 功能，包括自动补全、跳转定义、查找引用',
    maxSize: 10 * 1024 * 1024, // 10MB
    enableLSP: true,
    enableComplexAnalysis: true,
    enableHighlight: true,
  },
  basic: {
    label: '基础模式',
    description: '基础 LSP 功能，禁用复杂分析',
    maxSize: 50 * 1024 * 1024, // 50MB
    enableLSP: true,
    enableComplexAnalysis: false,
    enableHighlight: true,
  },
  'highlight-only': {
    label: '语法高亮模式',
    description: '仅语法高亮，禁用 LSP',
    maxSize: 100 * 1024 * 1024, // 100MB
    enableLSP: false,
    enableComplexAnalysis: false,
    enableHighlight: true,
  },
  plaintext: {
    label: '纯文本模式',
    description: '纯文本编辑，无语法高亮和 LSP',
    maxSize: Infinity,
    enableLSP: false,
    enableComplexAnalysis: false,
    enableHighlight: false,
  },
};

/**
 * 根据文件大小获取编辑器模式
 */
function getEditorMode(fileSize?: number): EditorMode {
  if (!fileSize || fileSize < MODE_CONFIG.full.maxSize) {
    return 'full';
  }
  if (fileSize < MODE_CONFIG.basic.maxSize) {
    return 'basic';
  }
  if (fileSize < MODE_CONFIG['highlight-only'].maxSize) {
    return 'highlight-only';
  }
  return 'plaintext';
}

/**
 * 多标签 Monaco Editor 组件
 *
 * 支持多文件标签页管理和 Diff 对比功能。
 * 集成 LSP 功能：自动补全、跳转定义、查找引用、诊断显示。
 *
 * 大文件降级策略：
 * - <10MB: 完整 LSP 功能
 * - 10-50MB: 基础 LSP，禁用复杂分析
 * - 50-100MB: 仅语法高亮，禁用 LSP
 * - >100MB: 纯文本模式
 */
export default function Editor() {
  const { resolvedTheme } = useThemeStore();
  const { tabs, activeTab, diff, updateContent } = useEditorStore();
  const { initialize, openDocument, closeDocument, changeDocument, registerEditor, cleanup } =
    useLSP();

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const lspCleanupRef = useRef<(() => void) | null>(null);
  const prevTabRef = useRef<string | null>(null);

  const activeTabData = useMemo(
    () => tabs.find((t) => t.path === activeTab),
    [tabs, activeTab]
  );

  // 根据文件大小确定编辑器模式
  const editorMode = useMemo<EditorMode>(
    () => getEditorMode(activeTabData?.size),
    [activeTabData?.size]
  );

  const modeConfig = MODE_CONFIG[editorMode];

  // 是否显示降级提示
  const [showDegradeHint, setShowDegradeHint] = useState(true);

  const monacoTheme = useMemo(() => {
    return resolvedTheme === 'dark' ? 'vs-dark' : 'vs';
  }, [resolvedTheme]);

  // 根据编辑器模式动态调整选项
  const editorOptions = useMemo(
    () => ({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
      minimap: { enabled: editorMode === 'full' },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on' as const,
      lineNumbers: 'on' as const,
      renderWhitespace: 'selection' as const,
      smoothScrolling: true,
      cursorStyle: 'line' as const,
      cursorBlinking: 'smooth' as const,
      folding: editorMode !== 'plaintext',
      foldingHighlight: editorMode !== 'plaintext',
      renderLineHighlight: editorMode === 'full' ? ('all' as const) : ('line' as const),
      roundedSelection: false,
      lineHeight: 22,
      letterSpacing: 0.5,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      padding: { top: 16, bottom: 16 },
      bracketPairColorization: { enabled: editorMode !== 'plaintext' },
      guides: {
        bracketPairs: editorMode !== 'plaintext',
        indentation: editorMode !== 'plaintext',
      },
      scrollbar: {
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        vertical: 'auto' as const,
        horizontal: 'auto' as const,
      },
      quickSuggestions: {
        other: modeConfig.enableLSP,
        comments: false,
        strings: false,
      },
      quickSuggestionsDelay: 100,
      autoClosingBrackets: editorMode !== 'plaintext' ? ('always' as const) : ('never' as const),
      autoClosingQuotes: editorMode !== 'plaintext' ? ('always' as const) : ('never' as const),
      autoIndent: editorMode !== 'plaintext' ? ('full' as const) : ('none' as const),
      formatOnPaste: editorMode === 'full',
      formatOnType: editorMode === 'full',
      renderIndentGuides: editorMode !== 'plaintext',
      'semanticHighlighting.enabled': editorMode === 'full',
      readOnly: false,
      // 大文件优化选项
      largeFileOptimizations: editorMode !== 'full',
      maxTokenizationLineLength: editorMode === 'plaintext' ? 0 : 20000,
    }),
    [editorMode, modeConfig.enableLSP]
  );

  /** 处理编辑器内容变更 */
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (activeTab && newValue !== undefined) {
        updateContent(activeTab, newValue);
        // 仅在 LSP 启用时发送文档变更通知
        if (modeConfig.enableLSP) {
          const uri = `file://${activeTab}`;
          changeDocument(uri, newValue);
        }
      }
    },
    [activeTab, updateContent, changeDocument, modeConfig.enableLSP]
  );

  /** 处理编辑器挂载 */
  const handleMount = useCallback<OnMount>(
    (editor, monacoInstance) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;

      if (activeTabData) {
        const language = activeTabData.language;
        const uri = `file://${activeTabData.path}`;

        // 仅在需要时初始化 LSP
        if (modeConfig.enableLSP) {
          // 初始化 LSP（使用空工作区路径，后续可从配置中获取）
          initialize('', language);

          // 注册编辑器 LSP 功能
          const lspCleanup = registerEditor(
            monacoInstance as unknown as typeof import('monaco-editor'),
            editor,
            language
          );
          lspCleanupRef.current = lspCleanup;

          // 发送文档打开通知
          openDocument(uri, language, activeTabData.content);
        }
      }
    },
    [activeTabData, initialize, registerEditor, openDocument, modeConfig.enableLSP]
  );

  /** 监听标签页切换，发送 didOpen/didClose */
  useEffect(() => {
    if (!activeTab) return;

    const uri = `file://${activeTab}`;
    const prevUri = prevTabRef.current ? `file://${prevTabRef.current}` : null;

    // 关闭旧文档（仅在 LSP 启用时）
    if (prevUri && prevUri !== uri && modeConfig.enableLSP) {
      closeDocument(prevUri);
    }

    // 打开新文档（仅在 LSP 启用时）
    if (activeTabData && modeConfig.enableLSP) {
      openDocument(uri, activeTabData.language, activeTabData.content);

      // 如果编辑器已挂载，重新注册 LSP（语言可能变化）
      if (editorRef.current && monacoRef.current) {
        // 清理旧的 LSP 注册
        if (lspCleanupRef.current) {
          lspCleanupRef.current();
        }

        // 重新注册
        const lspCleanup = registerEditor(
          monacoRef.current as unknown as typeof import('monaco-editor'),
          editorRef.current,
          activeTabData.language
        );
        lspCleanupRef.current = lspCleanup;
      }
    }

    prevTabRef.current = activeTab;

    return () => {
      // 组件卸载时清理
      if (lspCleanupRef.current) {
        lspCleanupRef.current();
        lspCleanupRef.current = null;
      }
      cleanup();
    };
  }, [activeTab, activeTabData, closeDocument, openDocument, registerEditor, cleanup, modeConfig.enableLSP]);

  // 切换标签页时显示降级提示
  useEffect(() => {
    setShowDegradeHint(true);
  }, [activeTab]);

  // 确定实际使用的语言（纯文本模式下强制使用 plaintext）
  const effectiveLanguage = useMemo(() => {
    if (editorMode === 'plaintext') {
      return 'plaintext';
    }
    return activeTabData?.language || 'plaintext';
  }, [editorMode, activeTabData?.language]);

  return (
    <div data-testid="editor-container" className="flex flex-col w-full h-full">
      <TabBar />

      {/* 大文件降级提示 */}
      {showDegradeHint && editorMode !== 'full' && activeTabData && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-warning text-xs">
          <AlertTriangle size={14} />
          <span className="flex-1">
            <strong>{modeConfig.label}</strong>：{modeConfig.description}
            {activeTabData.size && (
              <span className="ml-1 opacity-80">
                （文件大小：{(activeTabData.size / 1024 / 1024).toFixed(2)} MB）
              </span>
            )}
          </span>
          <button
            onClick={() => setShowDegradeHint(false)}
            className="hover:opacity-70 transition-opacity"
          >
            关闭
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {diff.isOpen ? (
          <DiffViewer
            original={diff.original}
            modified={diff.modified}
            language={diff.language}
          />
        ) : activeTabData ? (
          <MonacoEditor
            theme={monacoTheme}
            language={effectiveLanguage}
            value={activeTabData.content}
            options={editorOptions}
            onChange={handleChange}
            onMount={handleMount}
            loading={
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                <span className="text-sm">编辑器加载中...</span>
              </div>
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground bg-background">
            <span className="text-lg font-medium mb-2">欢迎使用 AI IDE</span>
            <span className="text-sm">打开文件开始编辑</span>
          </div>
        )}
      </div>
    </div>
  );
}
