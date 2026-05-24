/**
 * LSP (Language Server Protocol) 服务
 *
 * 封装与后端 LSP 客户端的通信，提供语言服务器功能。
 * 支持自动补全、跳转定义、查找引用、诊断显示等核心功能。
 */

import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import * as wailsApp from './wailsApp';

// ============================================================
// LSP 类型定义
// ============================================================

/** LSP 位置（0-based） */
export interface LSPPosition {
  line: number;
  character: number;
}

/** LSP 范围 */
export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

/** LSP 位置信息 */
export interface LSPLocation {
  uri: string;
  range: LSPRange;
}

/** LSP 诊断严重程度 */
export enum LSPDiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/** LSP 诊断信息 */
export interface LSPDiagnostic {
  range: LSPRange;
  severity?: LSPDiagnosticSeverity;
  code?: string;
  source?: string;
  message: string;
}

/** LSP 补全项类型 */
export enum LSPCompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

/** LSP 补全项 */
export interface LSPCompletionItem {
  label: string;
  kind?: LSPCompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
  filterText?: string;
}

/** LSP 补全列表 */
export interface LSPCompletionList {
  isIncomplete: boolean;
  items: LSPCompletionItem[];
}

/** 语言服务器配置 */
export interface LanguageServerConfig {
  command: string;
  args: string[];
}

/** LSP 客户端状态 */
export enum LSPClientState {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
}

/** 诊断回调函数类型 */
export type DiagnosticsCallback = (uri: string, diagnostics: LSPDiagnostic[]) => void;

// ============================================================
// 语言服务器配置映射
// ============================================================

/** 支持的语言到语言服务器的映射 */
const LANGUAGE_SERVER_MAP: Record<string, LanguageServerConfig> = {
  go: {
    command: 'gopls',
    args: [],
  },
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
  },
  javascript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
  },
  python: {
    command: 'python-lsp-server',
    args: [],
  },
};

/** 获取语言服务器配置 */
export function getLanguageServerConfig(language: string): LanguageServerConfig | undefined {
  return LANGUAGE_SERVER_MAP[language];
}

/** 检查语言是否支持 LSP */
export function isLanguageSupported(language: string): boolean {
  return language in LANGUAGE_SERVER_MAP;
}



// ============================================================
// LSP 服务类
// ============================================================

/**
 * LSP 服务类
 *
 * 封装与后端 LSP 客户端的通信，管理语言服务器生命周期。
 */
export class LSPService {
  /** 客户端状态 */
  private state: LSPClientState = LSPClientState.Stopped;
  /** 已打开的文档集合 */
  private openDocuments = new Set<string>();
  /** 文档版本号映射 */
  private documentVersions = new Map<string, number>();
  /** 诊断回调列表 */
  private diagnosticsCallbacks: DiagnosticsCallback[] = [];
  /** 当前工作区路径 */
  private workspacePath = '';
  /** 当前语言 */
  private currentLanguage = '';
  /** 事件监听器清理函数 */
  private eventCleanup?: () => void;

  /**
   * 检查后端 LSP 绑定是否可用
   */
  private async checkBackendAvailable(): Promise<boolean> {
    try {
      // 动态导入 Wails 绑定，检查是否存在 LSP 方法
      const app = await import('../../wailsjs/go/main/App');
      return typeof (app as Record<string, unknown>).LSPInitialize === 'function';
    } catch {
      return false;
    }
  }

  /**
   * 初始化 LSP 客户端
   *
   * @param workspacePath 工作区路径
   * @param language 语言类型
   */
  async initialize(workspacePath: string, language: string): Promise<boolean> {
    if (this.state === LSPClientState.Running) {
      return true;
    }

    this.state = LSPClientState.Starting;
    this.workspacePath = workspacePath;
    this.currentLanguage = language;

    // 检查后端是否可用
    const backendAvailable = await this.checkBackendAvailable();
    if (!backendAvailable) {
      console.warn(`[LSP] 后端不可用，无法初始化: ${language}`);
      this.state = LSPClientState.Stopped;
      return false;
    }

    try {
      const config = getLanguageServerConfig(language);
      if (!config) {
        console.warn(`[LSP] 不支持的语言: ${language}`);
        this.state = LSPClientState.Stopped;
        return false;
      }

      await wailsApp.LSPInitialize(workspacePath, language, config.command, config.args);

      // 注册诊断事件监听
      this.setupDiagnosticsListener();

      this.state = LSPClientState.Running;
      console.log(`[LSP] 初始化成功: ${language}`);
      return true;
    } catch (error) {
      console.error('[LSP] 初始化失败:', error);
      this.state = LSPClientState.Stopped;
      return false;
    }
  }

  /**
   * 停止 LSP 客户端
   */
  async shutdown(): Promise<void> {
    if (this.state !== LSPClientState.Running) {
      return;
    }

    this.state = LSPClientState.Stopping;

    // 清理事件监听
    if (this.eventCleanup) {
      this.eventCleanup();
      this.eventCleanup = undefined;
    }

    try {
      await wailsApp.LSPShutdown();
    } catch (error) {
      console.error('[LSP] 关闭失败:', error);
    }

    this.openDocuments.clear();
    this.documentVersions.clear();
    this.state = LSPClientState.Stopped;
  }

  /**
   * 设置诊断事件监听器
   */
  private setupDiagnosticsListener(): void {
    const handleDiagnostics = (data: unknown): void => {
      try {
        const payload = data as { uri: string; diagnostics: LSPDiagnostic[] };
        if (payload.uri && payload.diagnostics) {
          this.notifyDiagnostics(payload.uri, payload.diagnostics);
        }
      } catch (error) {
        console.error('[LSP] 处理诊断事件失败:', error);
      }
    };

    EventsOn('lsp:diagnostics', handleDiagnostics);
    this.eventCleanup = () => {
      EventsOff('lsp:diagnostics');
    };
  }

  /**
   * 打开文档
   *
   * @param uri 文档 URI
   * @param language 语言类型
   * @param content 文档内容
   */
  async openDocument(uri: string, language: string, content: string): Promise<void> {
    if (this.state !== LSPClientState.Running) {
      return;
    }

    this.openDocuments.add(uri);
    this.documentVersions.set(uri, 1);

    try {
      await wailsApp.LSPOpenDocument(uri, language, content);
    } catch (error) {
      console.error('[LSP] 打开文档失败:', error);
    }
  }

  /**
   * 关闭文档
   *
   * @param uri 文档 URI
   */
  async closeDocument(uri: string): Promise<void> {
    if (this.state !== LSPClientState.Running) {
      return;
    }

    this.openDocuments.delete(uri);
    this.documentVersions.delete(uri);

    try {
      await wailsApp.LSPCloseDocument(uri);
    } catch (error) {
      console.error('[LSP] 关闭文档失败:', error);
    }
  }

  /**
   * 文档内容变更
   *
   * @param uri 文档 URI
   * @param content 新内容
   */
  async changeDocument(uri: string, content: string): Promise<void> {
    if (this.state !== LSPClientState.Running) {
      return;
    }

    if (!this.openDocuments.has(uri)) {
      return;
    }

    const currentVersion = this.documentVersions.get(uri) || 1;
    const newVersion = currentVersion + 1;
    this.documentVersions.set(uri, newVersion);

    try {
      await wailsApp.LSPChangeDocument(uri, content, newVersion);
    } catch (error) {
      console.error('[LSP] 变更文档失败:', error);
    }
  }

  /**
   * 获取自动补全
   *
   * @param uri 文档 URI
   * @param position 光标位置
   * @returns 补全列表
   */
  async getCompletions(uri: string, position: LSPPosition): Promise<LSPCompletionList> {
    if (this.state !== LSPClientState.Running) {
      return { isIncomplete: false, items: [] };
    }

    try {
      const result = await wailsApp.LSPCompletion(uri, position.line, position.character);
      return result as LSPCompletionList;
    } catch (error) {
      console.error('[LSP] 获取补全失败:', error);
      return { isIncomplete: false, items: [] };
    }
  }

  /**
   * 跳转定义
   *
   * @param uri 文档 URI
   * @param position 光标位置
   * @returns 定义位置列表
   */
  async getDefinition(uri: string, position: LSPPosition): Promise<LSPLocation[]> {
    if (this.state !== LSPClientState.Running) {
      return [];
    }

    try {
      const result = await wailsApp.LSPDefinition(uri, position.line, position.character);
      return result as LSPLocation[];
    } catch (error) {
      console.error('[LSP] 获取定义失败:', error);
      return [];
    }
  }

  /**
   * 查找引用
   *
   * @param uri 文档 URI
   * @param position 光标位置
   * @returns 引用位置列表
   */
  async getReferences(uri: string, position: LSPPosition): Promise<LSPLocation[]> {
    if (this.state !== LSPClientState.Running) {
      return [];
    }

    try {
      const result = await wailsApp.LSPReferences(uri, position.line, position.character);
      return result as LSPLocation[];
    } catch (error) {
      console.error('[LSP] 获取引用失败:', error);
      return [];
    }
  }

  /**
   * 注册诊断回调
   *
   * @param callback 诊断回调函数
   * @returns 取消注册的函数
   */
  onDiagnostics(callback: DiagnosticsCallback): () => void {
    this.diagnosticsCallbacks.push(callback);
    return () => {
      const index = this.diagnosticsCallbacks.indexOf(callback);
      if (index !== -1) {
        this.diagnosticsCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有诊断回调
   */
  private notifyDiagnostics(uri: string, diagnostics: LSPDiagnostic[]): void {
    for (const callback of this.diagnosticsCallbacks) {
      try {
        callback(uri, diagnostics);
      } catch (error) {
        console.error('[LSP] 诊断回调执行失败:', error);
      }
    }
  }

  /**
   * 获取客户端状态
   */
  getState(): LSPClientState {
    return this.state;
  }

  /**
   * 检查文档是否已打开
   */
  isDocumentOpen(uri: string): boolean {
    return this.openDocuments.has(uri);
  }

  /**
   * 获取文档版本号
   */
  getDocumentVersion(uri: string): number {
    return this.documentVersions.get(uri) || 1;
  }
}

/** 全局 LSP 服务实例 */
export const lspService = new LSPService();
