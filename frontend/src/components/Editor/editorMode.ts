/**
 * 编辑器模式类型
 */
export type EditorMode = 'full' | 'basic' | 'highlight-only' | 'plaintext';

/**
 * 大文件降级配置
 */
export const MODE_CONFIG: Record<
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
    maxSize: 10 * 1024 * 1024,
    enableLSP: true,
    enableComplexAnalysis: true,
    enableHighlight: true,
  },
  basic: {
    label: '基础模式',
    description: '基础 LSP 功能，禁用复杂分析',
    maxSize: 50 * 1024 * 1024,
    enableLSP: true,
    enableComplexAnalysis: false,
    enableHighlight: true,
  },
  'highlight-only': {
    label: '语法高亮模式',
    description: '仅语法高亮，禁用 LSP',
    maxSize: 100 * 1024 * 1024,
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
export function getEditorMode(fileSize?: number): EditorMode {
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
 * 大文件警告阈值（5MB）
 */
export const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;