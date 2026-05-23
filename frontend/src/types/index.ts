export interface Project {
  id: number;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  key: string;
  value: string;
  updatedAt: string;
}

// 编辑器配置
export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  enableMinimap: boolean;
  formatOnSave: boolean;
  lineHeight: number;
  cursorStyle: string;
  cursorBlinking: string;
  renderWhitespace: string;
}

// 终端配置
export interface TerminalSettings {
  shell: string;
  fontSize: number;
  fontFamily: string;
  cursorStyle: string;
  scrollback: number;
}

// AI 配置
export interface AISettings {
  model: string;
  apiKey: string;
  baseUrl: string;
}

// 应用全局配置
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  autoSave: boolean;
  editor: EditorSettings;
  terminal: TerminalSettings;
  ai: AISettings;
}
