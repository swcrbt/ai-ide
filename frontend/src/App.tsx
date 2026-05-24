import { useEffect, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from './stores/useThemeStore';
import { useEditorStore } from './stores/useEditorStore';
import { useExplorerStore } from './stores/useExplorerStore';
import { useAppStore } from './stores/useAppStore';
import { useTaskStore } from './stores/useTaskStore';
import { useGitStore } from './stores/useGitStore';
import { LSPProvider } from './components/Editor/LSPProvider';
import { CommandPalette, type CommandPaletteItem } from './components/CommandPalette';
import { useShortcuts } from './hooks/useShortcuts';
import {
  Sun,
  Moon,
  Monitor,
  Languages,
  Settings,
  X,
  Check,
  Plus,
} from 'lucide-react';
import { GitPanel } from './components/Git/GitPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { LeftPanel } from './components/Layout/LeftPanel';
import { RightPanel } from './components/Layout/RightPanel';
import { BottomPanel } from './components/Layout/BottomPanel';
import { StatusBar } from './components/Layout/StatusBar';
import { FileTree } from './components/Explorer/FileTree';
import { ChatPanel } from './components/Chat/ChatPanel';
import { TaskCard } from './components/Task/TaskCard';
import { TaskCreateDialog } from './components/Task/TaskCreateDialog';
import { BranchExists, CreateBranch } from './types/wails';
import { ReadFile } from '../wailsjs/go/fs/FileService';

// 动态导入大型组件，减少初始加载时间
const Editor = lazy(() => import('./components/Editor/Editor'));
const Terminal = lazy(() => import('./components/Terminal/Terminal').then(m => ({ default: m.Terminal })));

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



type LeftTab = 'task' | 'git';
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
  const { selectedPath, selectNode } = useExplorerStore();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const {
    tasks,
    activeTaskId,
    addTask,
    deleteTask,
    setActiveTask,
  } = useTaskStore();
  const { currentBranch, status: gitStatus } = useGitStore();

  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>('task');
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [rightTool, setRightTool] = useState<'explorer' | 'editor' | 'search' | 'git' | 'settings'>('explorer');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
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

  useEffect(() => {
    if (selectedPath && !selectedPath.endsWith('/')) {
      setActiveFile(selectedPath);
    }
  }, [selectedPath]);

  const taskCompleted = tasks.filter((t) => t.status === 'completed').length;
  const taskTotal = tasks.length;

  const gitChangeCount = gitStatus
    ? (gitStatus.staged?.length || 0) +
      (gitStatus.modified?.length || 0) +
      (gitStatus.untracked?.length || 0) +
      (gitStatus.deleted?.length || 0)
    : 0;

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
      showAppToast('请从文件资源管理器中选择文件');
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
      setBottomPanelOpen((prev) => !prev);
    });

    registerHandler('view.showExplorer', () => {
      if (!sidebarOpen) toggleSidebar();
      setFileTreeOpen(true);
    });

    registerHandler('view.showGit', () => {
      setLeftTab('git');
    });

    registerHandler('view.showExtensions', () => {
      showAppToast('扩展面板功能预留');
    });

    registerHandler('view.showProblems', () => {
      showAppToast('问题面板功能预留');
    });

    registerHandler('view.toggleTerminal', () => {
      setBottomPanelOpen((prev) => !prev);
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
      } else if (taskCreateOpen) {
        setTaskCreateOpen(false);
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
    activeTab,
    closeFile,
    openFile,
    switchTab,
    registerHandler,
    unregisterHandler,
    toggleSidebar,
    sidebarOpen,
    commandPaletteOpen,
    settingsPanelOpen,
    taskCreateOpen,
    showAppToast,
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
    handlerMap.set('file.open', () => {
      showAppToast('请从文件资源管理器中选择文件');
    });
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
    handlerMap.set('view.toggleBottomPanel', () => setBottomPanelOpen((p) => !p));
    handlerMap.set('view.showGit', () => setLeftTab('git'));
    handlerMap.set('view.toggleTerminal', () => {
      setBottomPanelOpen((p) => !p);
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
        category:
          s.category === 'file'
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

  async function handleCreateTask(task: {
    title: string;
    branch: string;
    tag: string;
    tagColor: string;
  }) {
    try {
      const exists = await BranchExists(task.branch);
      if (exists) {
        const shouldSwitch = window.confirm(
          `分支 "${task.branch}" 已存在。\n\n是否切换到该分支？\n（取消则重新输入）`
        );
        if (shouldSwitch) {
          await CreateBranch(task.branch);
        } else {
          return;
        }
      } else {
        await CreateBranch(task.branch);
      }
      
      addTask({ ...task, status: 'pending' });
      setTaskCreateOpen(false);
      showAppToast(`任务已创建: ${task.title}`);
    } catch (error) {
      showAppToast(`创建分支失败: ${error}`);
    }
  }

  useEffect(() => {
    initTheme();
  }, []);



  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-lg">
          <Check size={16} />
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground shadow-lg"
          style={{
            marginTop: `${(toasts.indexOf(toast) + (toastMessage ? 1 : 0)) * 48}px`,
          }}
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
        <LeftPanel
          taskCount={taskTotal}
          gitChangeCount={gitChangeCount}
          activeTab={leftTab}
          onTabChange={setLeftTab}
        >
          {{
            taskPanel: (
              <div className="p-3 space-y-3">
                <button
                  onClick={() => setTaskCreateOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground hover:bg-accent transition-colors"
                >
                  <Plus size={16} />
                  <span>新建任务</span>
                </button>

                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isActive={task.id === activeTaskId}
                      onClick={() => setActiveTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </div>

                {tasks.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <p>暂无任务</p>
                    <p className="text-xs mt-1">点击上方按钮创建新任务</p>
                  </div>
                )}
              </div>
            ),
            gitPanel: <GitPanel />,
          }}
        </LeftPanel>

        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab ? (
            <LSPProvider>
              <Suspense fallback={<LoadingFallback message="编辑器加载中..." />}>
                <Editor />
              </Suspense>
            </LSPProvider>
          ) : (
            <ChatPanel centered />
          )}
        </main>

        <RightPanel
          isOpen={fileTreeOpen}
          onToggle={() => setFileTreeOpen(!fileTreeOpen)}
          activeTool={rightTool}
          onToolChange={setRightTool}
        >
          {{
            explorer: <FileTree onFileClick={async (path) => {
              try {
                const bytes = await ReadFile(path);
                if (!bytes || bytes.length === 0) {
                  openFile(path, '');
                  setActiveFile(path);
                  return;
                }
                const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
                openFile(path, content);
                setActiveFile(path);
              } catch (err) {
                console.error('读取文件失败:', err);
                showAppToast(`读取文件失败: ${path}`);
              }
            }} />,
          }}
        </RightPanel>
      </div>

      {activeFile && bottomPanelOpen && (
        <BottomPanel
          activeTab={bottomTab}
          onTabChange={setBottomTab}
          onHide={() => setBottomPanelOpen(false)}
        >
          {{
            terminal: (
              <Suspense fallback={<LoadingFallback message="终端加载中..." />}>
                <Terminal theme={resolvedTheme} />
              </Suspense>
            ),
            aiChat: <ChatPanel />,
          }}
        </BottomPanel>
      )}

      <StatusBar
        branch={currentBranch || 'main'}
        taskCompleted={taskCompleted}
        taskTotal={taskTotal}
        aiStatus="就绪"
        language={activeTab ? activeTab.split('.').pop() || '' : undefined}
      />

      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandPaletteItems}
      />

      <TaskCreateDialog
        isOpen={taskCreateOpen}
        onClose={() => setTaskCreateOpen(false)}
        onCreate={handleCreateTask}
      />
    </div>
  );
}

export default App;
