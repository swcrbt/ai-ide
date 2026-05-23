/**
 * Wails 运行时类型扩展
 *
 * 为前端声明后端暴露的 LSP 相关方法。
 * 这些方法将在后端实现后通过 Wails 绑定自动生成。
 */

declare module '../../wailsjs/go/main/App' {
  /** 初始化 LSP 客户端 */
  export function LSPInitialize(
    workspacePath: string,
    language: string,
    serverCommand: string,
    serverArgs: string[]
  ): Promise<boolean>;

  /** 关闭 LSP 客户端 */
  export function LSPShutdown(): Promise<void>;

  /** 打开文档 */
  export function LSPOpenDocument(
    uri: string,
    language: string,
    content: string
  ): Promise<void>;

  /** 关闭文档 */
  export function LSPCloseDocument(uri: string): Promise<void>;

  /** 文档内容变更 */
  export function LSPChangeDocument(
    uri: string,
    content: string,
    version: number
  ): Promise<void>;

  /** 获取自动补全 */
  export function LSPCompletion(
    uri: string,
    line: number,
    character: number
  ): Promise<{
    isIncomplete: boolean;
    items: Array<{
      label: string;
      kind?: number;
      detail?: string;
      documentation?: string;
      insertText?: string;
      sortText?: string;
      filterText?: string;
    }>;
  }>;

  /** 跳转定义 */
  export function LSPDefinition(
    uri: string,
    line: number,
    character: number
  ): Promise<Array<{
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>>;

  /** 查找引用 */
  export function LSPReferences(
    uri: string,
    line: number,
    character: number
  ): Promise<Array<{
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>>;
}
