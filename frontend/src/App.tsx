import { useEffect, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from './stores/useThemeStore';
import { useEditorStore } from './stores/useEditorStore';
import { useExplorerStore } from './stores/useExplorerStore';
import { useAppStore } from './stores/useAppStore';
import { LSPProvider } from './components/Editor/LSPProvider';
import { CommandPalette, type CommandPaletteItem } from './components/CommandPalette';
import { useShortcuts } from './hooks/useShortcuts';
import { Sun, Moon, Monitor, Languages, FilePlus, GitBranch, X, Check, Settings } from 'lucide-react';
import { GitPanel } from './components/Git/GitPanel';

// 动态导入大型组件，减少初始加载时间
const Editor = lazy(() => import('./components/Editor/Editor'));
const TerminalPanel = lazy(() => import('./components/Terminal/TerminalPanel'));

/**
 * 加载中占位组件
 */
function LoadingFallback({ message = '加载中...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center w-full h-full text-muted-foreground">
      <span className="text-sm">{message}</span>
    </div>
  );
}
import { SettingsPanel } from './components/Settings/SettingsPanel';

const demoFiles = [
  {
    path: 'src/main.ts',
    content: `import { app, BrowserWindow } from 'electron';
import path from 'path';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});`,
    language: 'typescript',
  },
  {
    path: 'src/utils/helper.js',
    content: `export function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}`,
    language: 'javascript',
  },
  {
    path: 'package.json',
    content: `{
  "name": "ai-ide",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^5.0.13"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^3.0.7"
  }
}`,
    language: 'json',
  },
];

type BottomTab = 'terminal' | 'ai';

const themeCycle: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

function getThemeIcon(theme: string) {
  switch (theme) {
    case 'dark':
      return <Moon size={18} />;
    case 'system':
      return <Monitor size={18} />;
    default:
      return <Sun size={18} />;
  }
}

function getThemeTitle(theme: string) {
  switch (theme) {
    case 'dark':
      return '暗色主题';
    case 'system':
      return '跟随系统';
    default:
      return '亮色主题';
  }
}

function App() {
  const { t, i18n } = useTranslation();
  const { theme, resolvedTheme, initTheme, setTheme } = useThemeStore();
  const { tabs, activeTab, openFile, closeFile, switchTab } = useEditorStore();
  const { toggleVisibility } = useExplorerStore();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    shortcuts,
    registerHandler,
    unregisterHandler,
    toasts,
    removeToast,
  } = useShortcuts();

  const showAppToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  // 注册快捷键命令处理器
  useEffect(() => {
    registerHandler('file.save', () => {
      if (activeTab) {
        const { markClean } = useEditorStore.getState();
        markClean(activeTab);
        showAppToast(`已保存: ${activeTab}`);
      }
    });

    registerHandler('file.open', () => {
      handleOpenDemoFile(0);
    });

    registerHandler('file.closeTab', () => {
      if (activeTab) closeFile(activeTab);
    });

    registerHandler('file.newFile', () => {
      const newPath = `untitled-${Date.now()}.txt`;
      openFile(newPath, '', 'plaintext');
    });

    registerHandler('file.newWindow', () => {
      showAppToast('新建窗口功能预留');
    });

    registerHandler('file.closeWindow', () => {
      showAppToast('关闭窗口功能预留');
    });

    registerHandler('edit.undo', () => {
      showAppToast('撤销（Monaco 内置）');
    });

    registerHandler('edit.redo', () => {
      showAppToast('重做（Monaco 内置）');
    });

    registerHandler('edit.find', () => {
      showAppToast('查找（Monaco 内置 Ctrl+F）');
    });

    registerHandler('edit.toggleLineComment', () => {
      showAppToast('切换行注释（Monaco 内置）');
    });

    registerHandler('navigate.nextTab', () => {
      const { tabs: ct, activeTab: ca } = useEditorStore.getState();
      if (ct.length > 1 && ca) {
        const idx = ct.findIndex((t) => t.path === ca);
        switchTab(ct[(idx + 1) % ct.length].path);
      }
    });

    registerHandler('navigate.prevTab', () => {
      const { tabs: ct, activeTab: ca } = useEditorStore.getState();
      if (ct.length > 1 && ca) {
        const idx = ct.findIndex((t) => t.path === ca);
        switchTab(ct[(idx - 1 + ct.length) % ct.length].path);
      }
    });

    registerHandler('navigate.switchToTab', ((index: number) => {
      const { tabs: ct } = useEditorStore.getState();
      if (index >= 0 && index < ct.length) {
        switchTab(ct[index].path);
      }
    }) as unknown as () => void);

    registerHandler('view.commandPalette', () => {
      setCommandPaletteOpen(true);
    });

    registerHandler('view.globalSearch', () => {
      showAppToast('全局搜索功能预留');
    });

    registerHandler('view.toggleSidebar', () => {
      toggleSidebar();
    });

    registerHandler('view.toggleBottomPanel', () => {
      setBottomPanelVisible((prev) => !prev);
    });

    registerHandler('view.showExplorer', () => {
      if (!sidebarOpen) toggleSidebar();
    });

    registerHandler('view.showGit', () => {
      setGitPanelOpen(true);
    });

    registerHandler('view.showExtensions', () => {
      showAppToast('扩展面板功能预留');
    });

    registerHandler('view.showProblems', () => {
      showAppToast('问题面板功能预留');
    });

    registerHandler('view.toggleTerminal', () => {
      setBottomPanelVisible((prev) => !prev);
      setBottomTab('terminal');
    });

    registerHandler('view.showOutput', () => {
      showAppToast('输出面板功能预留');
    });

    registerHandler('settings.open', () => {
      setSettingsPanelOpen(true);
    });

    registerHandler('general.escape', () => {
      if (settingsPanelOpen) {
        setSettingsPanelOpen(false);
      } else if (commandPaletteOpen) {
        setCommandPaletteOpen(false);
      } else if (gitPanelOpen) {
        setGitPanelOpen(false);
      }
    });

    return () => {
      unregisterHandler('file.save');
      unregisterHandler('file.open');
      unregisterHandler('file.closeTab');
      unregisterHandler('file.newFile');
      unregisterHandler('file.newWindow');
      unregisterHandler('file.closeWindow');
      unregisterHandler('edit.undo');
      unregisterHandler('edit.redo');
      unregisterHandler('edit.find');
      unregisterHandler('edit.toggleLineComment');
      unregisterHandler('navigate.nextTab');
      unregisterHandler('navigate.prevTab');
      unregisterHandler('navigate.switchToTab');
      unregisterHandler('view.commandPalette');
      unregisterHandler('view.globalSearch');
      unregisterHandler('view.toggleSidebar');
      unregisterHandler('view.toggleBottomPanel');
      unregisterHandler('view.showExplorer');
      unregisterHandler('view.showGit');
      unregisterHandler('view.showExtensions');
      unregisterHandler('view.showProblems');
      unregisterHandler('view.toggleTerminal');
      unregisterHandler('view.showOutput');
      unregisterHandler('settings.open');
      unregisterHandler('general.escape');
    };
  }, [
    activeTab, closeFile, openFile, switchTab,
    registerHandler, unregisterHandler, toggleSidebar,
    sidebarOpen, gitPanelOpen, commandPaletteOpen, settingsPanelOpen, showAppToast,
  ]);

  // 生成命令面板数据
  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const handlerMap = new Map<string, () => void>();

    handlerMap.set('file.save', () => {
      if (activeTab) {
        const { markClean } = useEditorStore.getState();
        markClean(activeTab);
        showAppToast(`已保存: ${activeTab}`);
      }
    });
    handlerMap.set('file.open', () => handleOpenDemoFile(0));
    handlerMap.set('file.closeTab', () => {
      if (activeTab) closeFile(activeTab);
    });
    handlerMap.set('file.newFile', () => {
      const newPath = `untitled-${Date.now()}.txt`;
      openFile(newPath, '', 'plaintext');
    });
    handlerMap.set('navigate.nextTab', () => {
      const { tabs: ct, activeTab: ca } = useEditorStore.getState();
      if (ct.length > 1 && ca) {
        const idx = ct.findIndex((t) => t.path === ca);
        switchTab(ct[(idx + 1) % ct.length].path);
      }
    });
    handlerMap.set('navigate.prevTab', () => {
      const { tabs: ct, activeTab: ca } = useEditorStore.getState();
      if (ct.length > 1 && ca) {
        const idx = ct.findIndex((t) => t.path === ca);
        switchTab(ct[(idx - 1 + ct.length) % ct.length].path);
      }
    });
    handlerMap.set('view.commandPalette', () => setCommandPaletteOpen(true));
    handlerMap.set('view.toggleSidebar', () => toggleSidebar());
    handlerMap.set('view.toggleBottomPanel', () => setBottomPanelVisible((p) => !p));
    handlerMap.set('view.showGit', () => setGitPanelOpen(true));
    handlerMap.set('view.toggleTerminal', () => {
      setBottomPanelVisible((p) => !p);
      setBottomTab('terminal');
    });
    handlerMap.set('settings.open', () => setSettingsPanelOpen(true));

    return shortcuts
      .filter((s) => handlerMap.has(s.command))
      .map((s) => ({
        command: s.command as import('./config/shortcuts').ShortcutCommand,
        label: s.description,
        shortcut: s.key
          .replace('ctrl+', 'Ctrl+')
          .replace('shift+', 'Shift+')
          .replace('meta+', '⌘')
          .toUpperCase(),
        category: s.category === 'file'
          ? '文件'
          : s.category === 'edit'
          ? '编辑'
          : s.category === 'navigate'
          ? '导航'
          : s.category === 'view'
          ? '视图'
          : '终端',
        action: handlerMap.get(s.command)!,
      }));
  }, [shortcuts, activeTab, closeFile, openFile, switchTab, toggleSidebar, showAppToast]);

  function toggleTheme() {
    const currentIndex = themeCycle.indexOf(theme as 'light' | 'dark' | 'system');
    const nextTheme = themeCycle[(currentIndex + 1) % themeCycle.length];
    setTheme(nextTheme);
  }

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  }

  function handleOpenDemoFile(index: number) {
    const file = demoFiles[index];
    openFile(file.path, file.content, file.language);
  }

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (tabs.length === 0) {
      const file = demoFiles[0];
      openFile(file.path, file.content, file.language);
    }
  }, []);

  return (
    <div id="App" className="min-h-screen flex flex-col">
      {/* Toast 通知 */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-lg">
          <Check size={16} />
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {/* 快捷键 Toast 通知 */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground shadow-lg"
          style={{ marginTop: `${(toasts.indexOf(toast) + (toastMessage ? 1 : 0)) * 48}px` }}
        >
          <Check size={16} className="text-success" />
          <span className="text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-1 hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{t('app.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGitPanelOpen(!gitPanelOpen)}
            className={`p-2 rounded-lg transition-colors ${
              gitPanelOpen
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
            title="Git"
          >
            <GitBranch size={18} />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            title={getThemeTitle(theme)}
          >
            {getThemeIcon(theme)}
          </button>
          <button
            onClick={toggleLanguage}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            title="切换语言"
          >
            <Languages size={18} />
          </button>
          <button
            onClick={() => setSettingsPanelOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              settingsPanelOpen
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
            title="设置"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Git 面板 */}
        {gitPanelOpen && (
          <aside className="w-72 border-r border-border bg-background flex-shrink-0 overflow-hidden">
            <GitPanel />
          </aside>
        )}

        {/* 文件浏览器侧边栏 */}
        {sidebarOpen && (
          <aside className="w-60 border-r border-border bg-background flex-shrink-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="h-9 flex items-center px-3 border-b border-border text-xs font-medium text-muted-foreground">
                资源管理器
              </div>
              <div className="flex-1 overflow-auto p-2">
                <div className="text-sm text-muted-foreground">
                  <p className="px-2 py-1">📁 src</p>
                  <p className="px-2 py-1 pl-4">📁 components</p>
                  <p className="px-2 py-1 pl-8">📄 Editor.tsx</p>
                  <p className="px-2 py-1 pl-4">📁 stores</p>
                  <p className="px-2 py-1 pl-4">📄 App.tsx</p>
                </div>
              </div>
            </div>
          </aside>
        )}

        <aside className="w-12 flex flex-col items-center gap-1 py-2 border-r border-border bg-background shrink-0">
          <button
            onClick={() => handleOpenDemoFile(0)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="打开 main.ts"
          >
            <FilePlus size={18} />
          </button>
          <button
            onClick={() => handleOpenDemoFile(1)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="打开 helper.js"
          >
            <FilePlus size={18} />
          </button>
          <button
            onClick={() => handleOpenDemoFile(2)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="打开 package.json"
          >
            <FilePlus size={18} />
          </button>
        </aside>

        <main className="flex-1 overflow-hidden">
          <LSPProvider>
            <Suspense fallback={<LoadingFallback message="编辑器加载中..." />}>
              <Editor />
            </Suspense>
          </LSPProvider>
        </main>
      </div>

      {/* 底部面板：终端 / AI 助手 */}
      {bottomPanelVisible && (
        <div className="h-64 border-t border-border">
          <Suspense fallback={<LoadingFallback message="面板加载中..." />}>
            <TerminalPanel
              theme={resolvedTheme}
              activeTab={bottomTab}
              onTabChange={setBottomTab}
            />
          </Suspense>
        </div>
      )}

      <footer className="h-6 flex items-center px-3 border-t border-border bg-background text-xs text-muted-foreground shrink-0">
        <span>AI IDE</span>
        <span className="mx-2">|</span>
        <span>{tabs.length > 0 ? `${tabs.length} 个文件已打开` : '就绪'}</span>
        <span className="mx-2">|</span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 rounded bg-secondary text-secondary-foreground border border-border">Ctrl+Shift+P</kbd>
          <span>命令面板</span>
        </span>
      </footer>

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
      />

      {/* 命令面板 */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandPaletteItems}
      />
    </div>
  );
}

export default App;
