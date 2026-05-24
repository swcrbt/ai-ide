/**
 * Wails 运行时模拟辅助模块
 *
 * 在 Playwright 浏览器环境中注入模拟的 Wails 运行时，
 * 使应用能够在没有 Go 后端的情况下正常渲染。
 */

import { Page } from '@playwright/test';

/**
 * 在页面加载前注入 Wails 运行时模拟
 */
export async function mockWailsRuntime(page: Page): Promise<void> {
  await page.route('**/assets/TerminalPanel.*.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        import { j as jsx } from './index.66371d27.js';
        function TerminalPanelStub({ activeTab, onTabChange }) {
          const isTerminal = activeTab === 'terminal';
          return jsx('div', {
            className: 'flex flex-col h-full border-t border-border bg-background',
            children: [
              jsx('div', {
                className: 'flex items-center justify-between h-8 px-2 border-b border-border bg-secondary/50',
                children: jsx('div', {
                  className: 'flex items-center gap-1',
                  children: [
                    jsx('button', {
                      key: 'terminal',
                      onClick: () => onTabChange('terminal'),
                      className: 'flex items-center gap-1.5 px-3 py-1 rounded-t text-xs font-medium ' + (isTerminal ? 'bg-background text-foreground border-t border-l border-r border-border' : 'text-muted-foreground hover:text-foreground'),
                      children: '终端'
                    }),
                    jsx('button', {
                      key: 'ai',
                      onClick: () => onTabChange('ai'),
                      className: 'flex items-center gap-1.5 px-3 py-1 rounded-t text-xs font-medium ' + (!isTerminal ? 'bg-background text-foreground border-t border-l border-r border-border' : 'text-muted-foreground hover:text-foreground'),
                      children: 'AI 助手'
                    })
                  ]
                })
              }),
              jsx('div', {
                className: 'flex-1 flex items-center justify-center text-muted-foreground text-sm',
                children: isTerminal ? '终端面板（测试模式）' : 'AI 助手面板（测试模式）'
              })
            ]
          });
        }
        export default TerminalPanelStub;
      `,
    });
  });

  await page.addInitScript(() => {
    const eventListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    const defaultSettings = {
      theme: 'system',
      language: 'zh',
      autoSave: false,
      editor: {
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
        tabSize: 2,
        wordWrap: true,
        showLineNumbers: true,
        enableMinimap: false,
        formatOnSave: true,
        lineHeight: 22,
        cursorStyle: 'line',
        cursorBlinking: 'smooth',
        renderWhitespace: 'selection',
      },
      terminal: {
        shell: '/bin/zsh',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        cursorStyle: 'block',
        scrollback: 10000,
      },
      ai: {
        model: 'gpt-4o',
        apiKey: '',
        baseUrl: '',
      },
    };

    const mockGitStatus = {
      branch: 'main',
      staged: [],
      modified: [],
      untracked: [],
      deleted: [],
      isClean: true,
    };

    const mockGitSummary = {
      totalChanges: 0,
      ahead: 0,
      behind: 0,
    };

    (window as unknown as Record<string, unknown>).go = {
      main: {
        App: {
          GetSettings: () => Promise.resolve(JSON.stringify(defaultSettings)),
          SaveSettings: () => Promise.resolve(),
          ResetSettings: () => Promise.resolve(),
          Greet: (name: string) => Promise.resolve(`Hello ${name}`),
          ListProjects: () => Promise.resolve([
            {
              id: 1,
              name: 'ai-ide',
              path: '/project',
              createdAt: '2026-05-23T10:00:00Z',
              updatedAt: '2026-05-23T10:00:00Z',
            },
          ]),
          AddProject: () => Promise.resolve({ project: null, needsInit: false }),
          SetCurrentProject: () => Promise.resolve(),
          RemoveProject: () => Promise.resolve(),
          InitGitAndSave: () => Promise.resolve({ id: 1, name: 'test', path: '/project', createdAt: '', updatedAt: '' }),
          CreateChatSession: () => Promise.resolve('mock-session-' + Date.now()),
          SendChatMessage: (_sessionID: string, content: string) => {
            // 模拟流式回复：通过 EventsEmit 分块发送
            setTimeout(() => {
              const mockReply = `收到你的消息: "${content}"。这是一个模拟的 AI 回复，用于测试环境。`;
              const chunks = mockReply.split('');
              let idx = 0;
              const interval = setInterval(() => {
                if (idx >= chunks.length) {
                  clearInterval(interval);
                  (window as unknown as Record<string, unknown>).runtime.EventsEmit(
                    'ai:done:' + _sessionID, ''
                  );
                  return;
                }
                const chunk = chunks.slice(idx, idx + 3).join('');
                idx += 3;
                (window as unknown as Record<string, unknown>).runtime.EventsEmit(
                  'ai:chunk:' + _sessionID, chunk
                );
              }, 10);
            }, 100);
            return Promise.resolve();
          },
          ClearChatMessages: () => Promise.resolve(),
        },
      },
      git: {
        GitService: {
          Status: () => Promise.resolve(mockGitStatus),
          Summary: () => Promise.resolve(mockGitSummary),
          Branch: () => Promise.resolve('main'),
          Branches: () => Promise.resolve([]),
          Checkout: () => Promise.resolve(),
          Commit: () => Promise.resolve(),
          Diff: () => Promise.resolve({ content: '' }),
          DiffAll: () => Promise.resolve(''),
          DiscardChanges: () => Promise.resolve(),
          GetRepoPath: () => Promise.resolve(''),
          GetRoot: () => Promise.resolve(''),
          Init: () => Promise.resolve(),
          IsGitRepo: () => Promise.resolve(false),
          Log: () => Promise.resolve([]),
          Pull: () => Promise.resolve(),
          Push: () => Promise.resolve(),
          SetRepoPath: () => Promise.resolve(),
          Stage: () => Promise.resolve(),
          Stash: () => Promise.resolve(),
          StashPop: () => Promise.resolve(),
          Unstage: () => Promise.resolve(),
        },
      },
      fs: {
        FileService: {
          Close: () => Promise.resolve(),
          CreateFile: () => Promise.resolve(),
          DeleteFile: () => Promise.resolve(),
          GetEventChannel: () => Promise.resolve(),
          GetFileTree: () => Promise.resolve({
            name: 'ai-ide',
            path: '/project',
            isDir: true,
            modTime: '2026-05-23T10:00:00Z',
            size: 0,
            children: [
              {
                name: 'src',
                path: '/project/src',
                isDir: true,
                modTime: '2026-05-23T10:00:00Z',
                size: 0,
                children: [
                  {
                    name: 'App.tsx',
                    path: '/project/src/App.tsx',
                    isDir: false,
                    modTime: '2026-05-23T12:00:00Z',
                    size: 2345,
                  },
                  {
                    name: 'main.tsx',
                    path: '/project/src/main.tsx',
                    isDir: false,
                    modTime: '2026-05-20T09:00:00Z',
                    size: 345,
                  },
                ],
              },
              {
                name: 'package.json',
                path: '/project/package.json',
                isDir: false,
                modTime: '2026-05-20T09:00:00Z',
                size: 890,
              },
              {
                name: 'README.md',
                path: '/project/README.md',
                isDir: false,
                modTime: '2026-05-20T09:00:00Z',
                size: 1234,
              },
              {
                name: '.gitignore',
                path: '/project/.gitignore',
                isDir: false,
                modTime: '2026-05-20T09:00:00Z',
                size: 234,
              },
            ],
          }),
          ReadFile: (path: string) => {
            const contents: Record<string, string> = {
              '/project/src/main.tsx': 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);',
              '/project/package.json': '{\n  "name": "ai-ide",\n  "version": "0.1.0"\n}',
              '/project/README.md': '# AI IDE\n\n一款 AI 驱动的桌面 IDE。',
              '/project/.gitignore': 'node_modules/\ndist/\n',
              '/project/src/App.tsx': 'import { useState } from "react";\n\nfunction App() {\n  return <div>Hello</div>;\n}\n\nexport default App;',
            };
            return Promise.resolve(contents[path] || '');
          },
          RenameFile: () => Promise.resolve(),
          SetWatcher: () => Promise.resolve(),
          Unwatch: () => Promise.resolve(),
          Watch: () => Promise.resolve(),
          WriteFile: () => Promise.resolve(),
        },
      },
    };

    (window as unknown as Record<string, unknown>).runtime = {
      LogPrint: () => {},
      LogTrace: () => {},
      LogDebug: () => {},
      LogInfo: () => {},
      LogWarning: () => {},
      LogError: () => {},
      LogFatal: () => {},
      EventsOnMultiple: (eventName: string, callback: (...args: unknown[]) => void) => {
        if (!eventListeners[eventName]) {
          eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(callback);
        return () => {
          const idx = eventListeners[eventName].indexOf(callback);
          if (idx > -1) eventListeners[eventName].splice(idx, 1);
        };
      },
      EventsOn: (eventName: string, callback: (...args: unknown[]) => void) => {
        if (!eventListeners[eventName]) {
          eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(callback);
        return () => {
          const idx = eventListeners[eventName].indexOf(callback);
          if (idx > -1) eventListeners[eventName].splice(idx, 1);
        };
      },
      EventsOff: () => {},
      EventsOffAll: () => {},
      EventsOnce: (eventName: string, callback: (...args: unknown[]) => void) => {
        if (!eventListeners[eventName]) {
          eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(callback);
        return () => {
          const idx = eventListeners[eventName].indexOf(callback);
          if (idx > -1) eventListeners[eventName].splice(idx, 1);
        };
      },
      EventsEmit: (eventName: string, ...args: unknown[]) => {
        const listeners = eventListeners[eventName] || [];
        listeners.forEach((cb) => cb(...args));
      },
      WindowReload: () => window.location.reload(),
      WindowReloadApp: () => window.location.reload(),
      WindowSetAlwaysOnTop: () => {},
      WindowSetSystemDefaultTheme: () => {},
      WindowSetLightTheme: () => {},
      WindowSetDarkTheme: () => {},
      WindowCenter: () => {},
      WindowSetTitle: () => {},
      WindowFullscreen: () => {},
      WindowUnfullscreen: () => {},
      WindowIsFullscreen: () => Promise.resolve(false),
      WindowSetSize: () => {},
      WindowGetSize: () => Promise.resolve({ w: 1280, h: 720 }),
      WindowSetMaxSize: () => {},
      WindowSetMinSize: () => {},
      WindowSetPosition: () => {},
      WindowGetPosition: () => Promise.resolve({ x: 0, y: 0 }),
      WindowHide: () => {},
      WindowShow: () => {},
      WindowMaximise: () => {},
      WindowToggleMaximise: () => {},
      WindowUnmaximise: () => {},
      WindowIsMaximised: () => Promise.resolve(false),
      WindowMinimise: () => {},
      WindowUnminimise: () => {},
      WindowIsMinimised: () => Promise.resolve(false),
      WindowIsNormal: () => Promise.resolve(true),
      WindowSetBackgroundColour: () => {},
      ScreenGetAll: () => Promise.resolve([]),
      BrowserOpenURL: (url: string) => window.open(url, '_blank'),
      Environment: () =>
        Promise.resolve({
          buildType: 'dev',
          platform: 'darwin',
          arch: 'amd64',
        }),
      Quit: () => {},
      Hide: () => {},
      Show: () => {},
      ClipboardGetText: () => Promise.resolve(''),
      ClipboardSetText: () => Promise.resolve(true),
      OnFileDrop: () => {},
      OnFileDropOff: () => {},
      CanResolveFilePaths: () => false,
      ResolveFilePaths: () => {},
      InitializeNotifications: () => Promise.resolve(),
      CleanupNotifications: () => Promise.resolve(),
      IsNotificationAvailable: () => Promise.resolve(false),
      RequestNotificationAuthorization: () => Promise.resolve(false),
      CheckNotificationAuthorization: () => Promise.resolve(false),
      SendNotification: () => Promise.resolve(),
      SendNotificationWithActions: () => Promise.resolve(),
      RegisterNotificationCategory: () => Promise.resolve(),
      RemoveNotificationCategory: () => Promise.resolve(),
      RemoveAllPendingNotifications: () => Promise.resolve(),
      RemovePendingNotification: () => Promise.resolve(),
      RemoveAllDeliveredNotifications: () => Promise.resolve(),
      RemoveDeliveredNotification: () => Promise.resolve(),
      RemoveNotification: () => Promise.resolve(),
    };
  });
}
