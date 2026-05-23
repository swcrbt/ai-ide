/**
 * Wails App 绑定封装
 *
 * 封装对后端 LSP 方法的调用，提供类型安全的接口。
 * 当后端方法不可用时，自动降级到模拟模式。
 */

import * as App from '../../wailsjs/go/main/App';

/** 检查后端方法是否存在 */
function hasMethod(obj: Record<string, unknown>, method: string): boolean {
  return typeof obj[method] === 'function';
}

/** 获取 App 模块 */
async function getApp(): Promise<typeof App> {
  return App;
}

/** 初始化 LSP 客户端 */
export async function LSPInitialize(
  workspacePath: string,
  language: string,
  serverCommand: string,
  serverArgs: string[]
): Promise<boolean> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPInitialize')) {
    return false;
  }
  return (app as unknown as Record<string, (a: string, b: string, c: string, d: string[]) => Promise<boolean>>).LSPInitialize(
    workspacePath,
    language,
    serverCommand,
    serverArgs
  );
}

/** 关闭 LSP 客户端 */
export async function LSPShutdown(): Promise<void> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPShutdown')) {
    return;
  }
  return (app as unknown as Record<string, () => Promise<void>>).LSPShutdown();
}

/** 打开文档 */
export async function LSPOpenDocument(uri: string, language: string, content: string): Promise<void> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPOpenDocument')) {
    return;
  }
  return (app as unknown as Record<string, (a: string, b: string, c: string) => Promise<void>>).LSPOpenDocument(
    uri,
    language,
    content
  );
}

/** 关闭文档 */
export async function LSPCloseDocument(uri: string): Promise<void> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPCloseDocument')) {
    return;
  }
  return (app as unknown as Record<string, (a: string) => Promise<void>>).LSPCloseDocument(uri);
}

/** 文档内容变更 */
export async function LSPChangeDocument(uri: string, content: string, version: number): Promise<void> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPChangeDocument')) {
    return;
  }
  return (app as unknown as Record<string, (a: string, b: string, c: number) => Promise<void>>).LSPChangeDocument(
    uri,
    content,
    version
  );
}

/** 获取自动补全 */
export async function LSPCompletion(
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
}> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPCompletion')) {
    return { isIncomplete: false, items: [] };
  }
  return (app as unknown as Record<string, (a: string, b: number, c: number) => Promise<unknown>>).LSPCompletion(
    uri,
    line,
    character
  ) as Promise<{
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
}

/** 跳转定义 */
export async function LSPDefinition(
  uri: string,
  line: number,
  character: number
): Promise<
  Array<{
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>
> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPDefinition')) {
    return [];
  }
  return (app as unknown as Record<string, (a: string, b: number, c: number) => Promise<unknown>>).LSPDefinition(
    uri,
    line,
    character
  ) as Promise<
    Array<{
      uri: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    }>
  >;
}

/** 查找引用 */
export async function LSPReferences(
  uri: string,
  line: number,
  character: number
): Promise<
  Array<{
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>
> {
  const app = await getApp();
  if (!hasMethod(app as Record<string, unknown>, 'LSPReferences')) {
    return [];
  }
  return (app as unknown as Record<string, (a: string, b: number, c: number) => Promise<unknown>>).LSPReferences(
    uri,
    line,
    character
  ) as Promise<
    Array<{
      uri: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    }>
  >;
}
