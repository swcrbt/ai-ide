import { useEffect, useRef } from 'react';
import { Terminal as XTerm, type ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { EventsOn, EventsOff, EventsEmit } from '../../../wailsjs/runtime';
import '@xterm/xterm/css/xterm.css';

// 终端事件名称常量
const EVENT_OUTPUT = 'terminal:output';
const EVENT_INPUT = 'terminal:input';
const EVENT_RESIZE = 'terminal:resize';
const EVENT_READY = 'terminal:ready';
const EVENT_CLOSED = 'terminal:closed';

/**
 * 终端组件 Props
 */
interface TerminalProps {
  /** 当前主题：light 或 dark */
  theme: 'light' | 'dark';
}

/**
 * 单个 xterm.js 终端组件
 *
 * 负责创建和管理 xterm.js 实例，处理与后端的输入输出通信，
 * 并支持主题同步和终端大小自适应。
 */
export function Terminal({ theme }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 创建 xterm.js 实例
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace",
      theme: getXTermTheme(theme),
      scrollback: 10000,
      allowProposedApi: true,
    });

    // 创建自适应大小插件
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // 创建链接检测插件
    term.loadAddon(new WebLinksAddon());

    // 挂载到 DOM
    term.open(container);

    // 保存引用
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // 初始适配大小
    fitAddon.fit();

    // 通知后端终端已就绪，触发 shell 启动
    EventsEmit(EVENT_READY);

    // 通知后端当前终端大小
    const dims = term.cols + ',' + term.rows;
    EventsEmit(EVENT_RESIZE, term.cols, term.rows);

    // 监听用户输入并发送到后端
    term.onData((data: string) => {
      // 使用 base64 编码发送，避免特殊字符问题
      const encoded = btoa(data);
      EventsEmit(EVENT_INPUT, encoded);
    });

    // 监听后端输出的终端数据
    EventsOn(EVENT_OUTPUT, (encodedData: string) => {
      try {
        const decoded = atob(encodedData);
        term.write(decoded);
      } catch {
        term.write(encodedData);
      }
    });

    // 监听终端关闭事件
    EventsOn(EVENT_CLOSED, () => {
      term.writeln('\r\n\x1b[31m[终端已关闭]\x1b[0m');
    });

    // 使用 ResizeObserver 监听容器大小变化
    resizeObserverRef.current = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const t = terminalRef.current;
        if (t) {
          EventsEmit(EVENT_RESIZE, t.cols, t.rows);
        }
      }
    });
    resizeObserverRef.current.observe(container);

    return () => {
      EventsOff(EVENT_OUTPUT);
      EventsOff(EVENT_CLOSED);
      resizeObserverRef.current?.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // 主题变化时更新终端主题
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    term.options.theme = getXTermTheme(theme);
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: 4 }}
    />
  );
}

/**
 * 根据应用主题生成 xterm.js 主题配置
 */
function getXTermTheme(theme: 'light' | 'dark'): ITerminalOptions['theme'] {
  if (theme === 'dark') {
    return {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      black: '#484f58',
      red: '#ff7b72',
      green: '#7ee787',
      yellow: '#e3b341',
      blue: '#79c0ff',
      magenta: '#d2a8ff',
      cyan: '#56d4dd',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#39c5cf',
      brightWhite: '#f0f6fc',
    };
  }

  return {
    background: '#ffffff',
    foreground: '#1f2328',
    cursor: '#0969da',
    cursorAccent: '#ffffff',
    selectionBackground: '#b4d5fe',
    black: '#24292f',
    red: '#cf222e',
    green: '#1a7f37',
    yellow: '#9a6700',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#2da44e',
    brightYellow: '#7d4e00',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#319aad',
    brightWhite: '#8c959f',
  };
}
