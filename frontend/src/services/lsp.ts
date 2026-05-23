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
// 模拟数据（用于测试，当后端绑定不可用时）
// ============================================================

/** Go 语言模拟补全数据 */
const GO_MOCK_COMPLETIONS: LSPCompletionItem[] = [
  { label: 'fmt', kind: LSPCompletionItemKind.Module, detail: 'package fmt', documentation: '格式化输入输出包' },
  { label: 'fmt.Println', kind: LSPCompletionItemKind.Function, detail: 'func(...interface{})', insertText: 'fmt.Println($0)', documentation: '打印并换行' },
  { label: 'fmt.Printf', kind: LSPCompletionItemKind.Function, detail: 'func(string, ...interface{})', insertText: 'fmt.Printf("$0")', documentation: '格式化打印' },
  { label: 'func', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'func $0() {\n\t\n}', documentation: '定义函数' },
  { label: 'package', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '定义包名' },
  { label: 'import', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'import "$0"', documentation: '导入包' },
  { label: 'struct', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'struct {\n\t$0\n}', documentation: '定义结构体' },
  { label: 'interface', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'interface {\n\t$0\n}', documentation: '定义接口' },
  { label: 'return', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '返回语句' },
  { label: 'if', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'if $0 {\n\t\n}', documentation: '条件语句' },
  { label: 'for', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'for $0 {\n\t\n}', documentation: '循环语句' },
  { label: 'range', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '范围迭代' },
  { label: 'make', kind: LSPCompletionItemKind.Function, detail: 'builtin', insertText: 'make($0)', documentation: '创建切片、映射或通道' },
  { label: 'len', kind: LSPCompletionItemKind.Function, detail: 'builtin', insertText: 'len($0)', documentation: '获取长度' },
  { label: 'append', kind: LSPCompletionItemKind.Function, detail: 'builtin', insertText: 'append($0)', documentation: '追加元素到切片' },
];

/** TypeScript 模拟补全数据 */
const TS_MOCK_COMPLETIONS: LSPCompletionItem[] = [
  { label: 'console', kind: LSPCompletionItemKind.Variable, detail: 'Console', documentation: '控制台对象' },
  { label: 'console.log', kind: LSPCompletionItemKind.Method, detail: 'method', insertText: 'console.log($0)', documentation: '输出日志' },
  { label: 'const', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '声明常量' },
  { label: 'let', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '声明变量' },
  { label: 'function', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'function $0() {\n\t\n}', documentation: '定义函数' },
  { label: 'interface', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'interface $0 {\n\t\n}', documentation: '定义接口' },
  { label: 'type', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'type $0 = ', documentation: '定义类型别名' },
  { label: 'import', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'import { $0 } from ""', documentation: '导入模块' },
  { label: 'export', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '导出模块' },
  { label: 'return', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '返回语句' },
  { label: 'async', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '异步函数修饰符' },
  { label: 'await', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '等待 Promise' },
  { label: 'Promise', kind: LSPCompletionItemKind.Class, detail: 'Promise<T>', insertText: 'Promise<$0>', documentation: 'Promise 对象' },
  { label: 'Array', kind: LSPCompletionItemKind.Class, detail: 'Array<T>', insertText: 'Array<$0>', documentation: '数组类型' },
  { label: 'string', kind: LSPCompletionItemKind.TypeParameter, detail: '基本类型', documentation: '字符串类型' },
  { label: 'number', kind: LSPCompletionItemKind.TypeParameter, detail: '基本类型', documentation: '数字类型' },
  { label: 'boolean', kind: LSPCompletionItemKind.TypeParameter, detail: '基本类型', documentation: '布尔类型' },
];

/** Python 模拟补全数据 */
const PY_MOCK_COMPLETIONS: LSPCompletionItem[] = [
  { label: 'print', kind: LSPCompletionItemKind.Function, detail: 'builtin', insertText: 'print($0)', documentation: '打印输出' },
  { label: 'len', kind: LSPCompletionItemKind.Function, detail: 'builtin', insertText: 'len($0)', documentation: '获取长度' },
  { label: 'range', kind: LSPCompletionItemKind.Function, detail: 'builtin', insertText: 'range($0)', documentation: '生成整数序列' },
  { label: 'def', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'def $0():\n    pass', documentation: '定义函数' },
  { label: 'class', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'class $0:\n    pass', documentation: '定义类' },
  { label: 'import', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'import $0', documentation: '导入模块' },
  { label: 'from', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'from $0 import ', documentation: '从模块导入' },
  { label: 'return', kind: LSPCompletionItemKind.Keyword, detail: '关键字', documentation: '返回语句' },
  { label: 'if', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'if $0:\n    pass', documentation: '条件语句' },
  { label: 'for', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'for $0 in :\n    pass', documentation: '循环语句' },
  { label: 'while', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'while $0:\n    pass', documentation: 'while 循环' },
  { label: 'try', kind: LSPCompletionItemKind.Keyword, detail: '关键字', insertText: 'try:\n    $0\nexcept Exception as e:\n    pass', documentation: '异常处理' },
  { label: 'list', kind: LSPCompletionItemKind.Class, detail: 'builtin', insertText: 'list($0)', documentation: '列表类型' },
  { label: 'dict', kind: LSPCompletionItemKind.Class, detail: 'builtin', insertText: 'dict($0)', documentation: '字典类型' },
  { label: 'str', kind: LSPCompletionItemKind.Class, detail: 'builtin', insertText: 'str($0)', documentation: '字符串类型' },
  { label: 'int', kind: LSPCompletionItemKind.Class, detail: 'builtin', insertText: 'int($0)', documentation: '整数类型' },
];

/** 获取模拟补全数据 */
function getMockCompletions(language: string): LSPCompletionItem[] {
  switch (language) {
    case 'go':
      return GO_MOCK_COMPLETIONS;
    case 'typescript':
    case 'javascript':
      return TS_MOCK_COMPLETIONS;
    case 'python':
      return PY_MOCK_COMPLETIONS;
    default:
      return [];
  }
}

/** 模拟诊断数据 */
function getMockDiagnostics(uri: string, language: string): LSPDiagnostic[] {
  const diagnostics: LSPDiagnostic[] = [];

  // 仅对部分 URI 返回模拟诊断
  if (uri.includes('error')) {
    diagnostics.push({
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
      },
      severity: LSPDiagnosticSeverity.Error,
      message: '模拟错误: 语法错误',
      source: 'lsp-mock',
    });
  }

  if (language === 'go' && uri.includes('main')) {
    diagnostics.push({
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 20 },
      },
      severity: LSPDiagnosticSeverity.Warning,
      message: '未使用的导入',
      source: 'gopls-mock',
    });
  }

  return diagnostics;
}

/** 模拟定义跳转数据 */
function getMockDefinition(uri: string, _position: LSPPosition): LSPLocation[] {
  // 返回当前文件内的模拟定义位置
  return [
    {
      uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
      },
    },
  ];
}

/** 模拟引用查找数据 */
function getMockReferences(uri: string, _position: LSPPosition): LSPLocation[] {
  // 返回当前文件内的模拟引用位置
  return [
    {
      uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
      },
    },
    {
      uri,
      range: {
        start: { line: 2, character: 5 },
        end: { line: 2, character: 15 },
      },
    },
  ];
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
  /** 是否使用模拟数据 */
  private useMock = true;
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
    this.useMock = !(await this.checkBackendAvailable());

    if (this.useMock) {
      console.log(`[LSP] 使用模拟模式: ${language}`);
      this.state = LSPClientState.Running;
      return true;
    }

    // 真实后端模式
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
      this.useMock = true;
      this.state = LSPClientState.Running;
      return true;
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

    if (!this.useMock) {
      try {
          await wailsApp.LSPShutdown();
      } catch (error) {
        console.error('[LSP] 关闭失败:', error);
      }
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

    if (this.useMock) {
      // 模拟模式下发送模拟诊断
      const diagnostics = getMockDiagnostics(uri, language);
      if (diagnostics.length > 0) {
        setTimeout(() => {
          this.notifyDiagnostics(uri, diagnostics);
        }, 500);
      }
      return;
    }

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

    if (this.useMock) {
      return;
    }

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

    if (this.useMock) {
      // 模拟模式下更新诊断
      const language = this.currentLanguage;
      const diagnostics = getMockDiagnostics(uri, language);
      setTimeout(() => {
        this.notifyDiagnostics(uri, diagnostics);
      }, 300);
      return;
    }

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

    if (this.useMock) {
      const items = getMockCompletions(this.currentLanguage);
      return { isIncomplete: false, items };
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

    if (this.useMock) {
      return getMockDefinition(uri, position);
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

    if (this.useMock) {
      return getMockReferences(uri, position);
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
