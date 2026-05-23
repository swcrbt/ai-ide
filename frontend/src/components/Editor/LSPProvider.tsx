/**
 * LSP Provider 组件
 *
 * 提供 Monaco Editor 与 LSP 服务的集成。
 * 注册自动补全、跳转定义、查找引用等语言功能。
 *
 * 延迟加载策略：
 * - 文件打开后延迟 500ms 启动 LSP 连接
 * - 文件关闭后延迟 30s 关闭 LSP 连接
 * - 避免频繁启停语言服务器
 */

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import {
  lspService,
  LSPService,
  LSPPosition,
  LSPDiagnostic,
  LSPDiagnosticSeverity,
  LSPCompletionItemKind,
  isLanguageSupported,
} from '../../services/lsp';

// ============================================================
// Context 定义
// ============================================================

/** LSP Context 值 */
interface LSPContextValue {
  /** LSP 服务实例 */
  service: LSPService;
  /** 当前是否已初始化 */
  isInitialized: boolean;
  /** 初始化 LSP */
  initialize: (workspacePath: string, language: string) => Promise<void>;
  /** 打开文档 */
  openDocument: (uri: string, language: string, content: string) => Promise<void>;
  /** 关闭文档 */
  closeDocument: (uri: string) => Promise<void>;
  /** 文档内容变更 */
  changeDocument: (uri: string, content: string) => Promise<void>;
  /** 注册编辑器实例的 LSP 功能 */
  registerEditor: (
    monacoInstance: typeof monaco,
    editor: monaco.editor.IStandaloneCodeEditor,
    language: string
  ) => (() => void);
  /** 清理所有 LSP 资源 */
  cleanup: () => void;
}

const LSPContext = createContext<LSPContextValue | null>(null);

/** 使用 LSP Context */
export function useLSP(): LSPContextValue {
  const context = useContext(LSPContext);
  if (!context) {
    throw new Error('useLSP 必须在 LSPProvider 内部使用');
  }
  return context;
}

// ============================================================
// 延迟加载管理器
// ============================================================

/**
 * LSP 延迟加载管理器
 *
 * 管理 LSP 的延迟初始化和延迟关闭，避免频繁启停语言服务器。
 */
class LSPDelayManager {
  /** 延迟初始化定时器 */
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  /** 延迟关闭定时器 */
  private shutdownTimer: ReturnType<typeof setTimeout> | null = null;
  /** 初始化延迟（毫秒） */
  private readonly INIT_DELAY = 500;
  /** 关闭延迟（毫秒） */
  private readonly SHUTDOWN_DELAY = 30000;
  /** 是否已初始化 */
  isInitialized = false;
  /** 当前语言 */
  currentLanguage = '';

  /**
   * 延迟初始化 LSP
   */
  async delayInitialize(
    initialize: (workspacePath: string, language: string) => Promise<boolean | void>,
    workspacePath: string,
    language: string
  ): Promise<void> {
    // 如果已经是相同语言且已初始化，跳过
    if (this.isInitialized && this.currentLanguage === language) {
      return;
    }

    // 取消之前的关闭定时器
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
    }

    // 取消之前的初始化定时器
    if (this.initTimer) {
      clearTimeout(this.initTimer);
    }

    // 延迟初始化
    return new Promise((resolve) => {
      this.initTimer = setTimeout(async () => {
        if (!isLanguageSupported(language)) {
          resolve();
          return;
        }

        const success = await initialize(workspacePath, language);
        if (success) {
          this.isInitialized = true;
          this.currentLanguage = language;
        }
        resolve();
      }, this.INIT_DELAY);
    });
  }

  /**
   * 延迟关闭 LSP
   */
  delayShutdown(shutdown: () => void): void {
    // 取消之前的初始化定时器
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }

    // 取消之前的关闭定时器
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
    }

    // 延迟关闭
    this.shutdownTimer = setTimeout(() => {
      shutdown();
      this.isInitialized = false;
      this.currentLanguage = '';
      this.shutdownTimer = null;
    }, this.SHUTDOWN_DELAY);
  }

  /**
   * 立即清理所有定时器
   */
  clearTimers(): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
    }
  }
}

// ============================================================
// Monaco 类型映射
// ============================================================

/** 将 LSP 补全类型映射为 Monaco 补全类型 */
function mapCompletionItemKind(kind: LSPCompletionItemKind): monaco.languages.CompletionItemKind {
  const map: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };
  return map[kind] ?? monaco.languages.CompletionItemKind.Text;
}

/** 将 LSP 诊断严重度映射为 Monaco Marker 严重度 */
function mapDiagnosticSeverity(severity: LSPDiagnosticSeverity): monaco.MarkerSeverity {
  switch (severity) {
    case LSPDiagnosticSeverity.Error:
      return monaco.MarkerSeverity.Error;
    case LSPDiagnosticSeverity.Warning:
      return monaco.MarkerSeverity.Warning;
    case LSPDiagnosticSeverity.Information:
      return monaco.MarkerSeverity.Info;
    case LSPDiagnosticSeverity.Hint:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Error;
  }
}

/** 将 Monaco 位置转换为 LSP 位置 */
function monacoPositionToLSP(position: monaco.Position): LSPPosition {
  return {
    line: position.lineNumber - 1,
    character: position.column - 1,
  };
}

// ============================================================
// Provider 注册
// ============================================================

/** 注册 Monaco 语言提供器 */
function registerLanguageProviders(
  monacoInstance: typeof monaco,
  language: string,
  service: LSPService
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  // 注册自动补全提供器
  const completionProvider = monacoInstance.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['.', ':', '>', '"', "'", '/', '@'],
    provideCompletionItems: async (model, position, _context, _token) => {
      const uri = model.uri.toString();
      const lspPosition = monacoPositionToLSP(position);

      try {
        const result = await service.getCompletions(uri, lspPosition);

        const suggestions = result.items.map((item) => ({
          label: item.label,
          kind: item.kind ? mapCompletionItemKind(item.kind) : monacoInstance.languages.CompletionItemKind.Text,
          detail: item.detail,
          documentation: item.documentation
            ? { value: item.documentation, isTrusted: true }
            : undefined,
          insertText: item.insertText || item.label,
          sortText: item.sortText,
          filterText: item.filterText,
          range: undefined as unknown as monaco.IRange,
        }));

        return { suggestions, incomplete: result.isIncomplete };
      } catch (error) {
        console.error('[LSPProvider] 补全请求失败:', error);
        return { suggestions: [], incomplete: false };
      }
    },
  });
  disposables.push(completionProvider);

  // 注册定义跳转提供器
  const definitionProvider = monacoInstance.languages.registerDefinitionProvider(language, {
    provideDefinition: async (model, position, _token) => {
      const uri = model.uri.toString();
      const lspPosition = monacoPositionToLSP(position);

      try {
        const locations = await service.getDefinition(uri, lspPosition);

        return locations.map((loc) => ({
          uri: monacoInstance.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (error) {
        console.error('[LSPProvider] 定义跳转请求失败:', error);
        return [];
      }
    },
  });
  disposables.push(definitionProvider);

  // 注册引用查找提供器
  const referenceProvider = monacoInstance.languages.registerReferenceProvider(language, {
    provideReferences: async (model, position, _context, _token) => {
      const uri = model.uri.toString();
      const lspPosition = monacoPositionToLSP(position);

      try {
        const locations = await service.getReferences(uri, lspPosition);

        return locations.map((loc) => ({
          uri: monacoInstance.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (error) {
        console.error('[LSPProvider] 引用查找请求失败:', error);
        return [];
      }
    },
  });
  disposables.push(referenceProvider);

  return disposables;
}

// ============================================================
// LSPProvider 组件
// ============================================================

interface LSPProviderProps {
  children: React.ReactNode;
}

/** LSP Provider 组件 */
export function LSPProvider({ children }: LSPProviderProps) {
  const isInitializedRef = useRef(false);
  const providerDisposablesRef = useRef<monaco.IDisposable[]>([]);
  const diagnosticsCleanupRef = useRef<(() => void) | undefined>(undefined);
  const delayManagerRef = useRef(new LSPDelayManager());

  /** 初始化 LSP（延迟 500ms） */
  const initialize = useCallback(async (workspacePath: string, language: string) => {
    const manager = delayManagerRef.current;

    await manager.delayInitialize(
      async (wp, lang) => {
        if (!isLanguageSupported(lang)) {
          return false;
        }

        const success = await lspService.initialize(wp, lang);
        if (success) {
          isInitializedRef.current = true;
        }
        return success;
      },
      workspacePath,
      language
    );
  }, []);

  /** 打开文档 */
  const openDocument = useCallback(async (uri: string, language: string, content: string) => {
    if (!isInitializedRef.current) {
      return;
    }
    await lspService.openDocument(uri, language, content);
  }, []);

  /** 关闭文档 */
  const closeDocument = useCallback(async (uri: string) => {
    if (!isInitializedRef.current) {
      return;
    }
    await lspService.closeDocument(uri);
  }, []);

  /** 文档内容变更 */
  const changeDocument = useCallback(async (uri: string, content: string) => {
    if (!isInitializedRef.current) {
      return;
    }
    await lspService.changeDocument(uri, content);
  }, []);

  /** 注册编辑器实例的 LSP 功能 */
  const registerEditor = useCallback(
    (monacoInstance: typeof monaco, editor: monaco.editor.IStandaloneCodeEditor, language: string) => {
      if (!isLanguageSupported(language)) {
        return () => {};
      }

      // 注册语言提供器
      const disposables = registerLanguageProviders(monacoInstance, language, lspService);
      providerDisposablesRef.current.push(...disposables);

      // 注册诊断监听器
      const handleDiagnostics = (uri: string, diagnostics: LSPDiagnostic[]) => {
        const model = editor.getModel();
        if (!model) return;

        const modelUri = model.uri.toString();
        if (modelUri !== uri) return;

        const markers = diagnostics.map((d) => ({
          severity: mapDiagnosticSeverity(d.severity ?? LSPDiagnosticSeverity.Error),
          message: d.message,
          startLineNumber: d.range.start.line + 1,
          startColumn: d.range.start.character + 1,
          endLineNumber: d.range.end.line + 1,
          endColumn: d.range.end.character + 1,
          code: d.code,
          source: d.source || 'LSP',
        }));

        monacoInstance.editor.setModelMarkers(model, 'lsp', markers);
      };

      const cleanup = lspService.onDiagnostics(handleDiagnostics);
      diagnosticsCleanupRef.current = cleanup;

      // 返回清理函数
      return () => {
        cleanup();
        disposables.forEach((d) => d.dispose());
      };
    },
    []
  );

  /** 清理所有资源（延迟 30s 关闭） */
  const cleanup = useCallback(() => {
    const manager = delayManagerRef.current;

    manager.delayShutdown(() => {
      if (diagnosticsCleanupRef.current) {
        diagnosticsCleanupRef.current();
        diagnosticsCleanupRef.current = undefined;
      }
      providerDisposablesRef.current.forEach((d) => d.dispose());
      providerDisposablesRef.current = [];
      lspService.shutdown();
      isInitializedRef.current = false;
    });
  }, []);

  // 组件卸载时立即清理
  useEffect(() => {
    return () => {
      delayManagerRef.current.clearTimers();
      if (diagnosticsCleanupRef.current) {
        diagnosticsCleanupRef.current();
        diagnosticsCleanupRef.current = undefined;
      }
      providerDisposablesRef.current.forEach((d) => d.dispose());
      providerDisposablesRef.current = [];
      lspService.shutdown();
      isInitializedRef.current = false;
    };
  }, []);

  const value: LSPContextValue = {
    service: lspService,
    isInitialized: isInitializedRef.current,
    initialize,
    openDocument,
    closeDocument,
    changeDocument,
    registerEditor,
    cleanup,
  };

  return <LSPContext.Provider value={value}>{children}</LSPContext.Provider>;
}

// ============================================================
// 类型导出
// ============================================================

export type { LSPContextValue };
