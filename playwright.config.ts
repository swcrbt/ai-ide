import { defineConfig } from '@playwright/test';

/**
 * E2E test config — 必须连接真实 Wails 后端。
 *
 * 测试连接到 Wails DevServer（http://localhost:34115），
 * 所有 window.go 调用通过 websocket IPC bridge 走真实 Go 后端。
 *
 * PREREQUISITE: wails dev 必须在另一个终端中运行。
 *   cd ai-ide && wails dev
 *
 * RUN:
 *   npx playwright test tests/gui/ --reporter=line
 */
export default defineConfig({
  testDir: './tests/gui',
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    // Wails DevServer — 注入 runtime JS + websocket IPC bridge
    baseURL: 'http://localhost:34115',
    headless: process.env.PLAYWRIGHT_HEADED !== '1',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
    },
  ],
});
