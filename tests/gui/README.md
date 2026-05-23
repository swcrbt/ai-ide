# GUI 测试

本项目使用 Playwright 进行 Wails 桌面应用的 GUI 自动化测试。

## 运行测试

```bash
npx playwright test
```

## 使用 UI 模式运行

```bash
npx playwright test --ui
```

## 调试模式

```bash
npx playwright test --debug
```

## 环境变量

- `PLAYWRIGHT_HEADED=1` — 以有头模式运行（显示浏览器窗口）
- `CI=true` — 强制启动新的 webServer，不重用已有服务器

## 测试文件

- `smoke.spec.ts` — 基础冒烟测试，验证应用正常启动并显示内容

## 配置

测试配置位于项目根目录的 `playwright.config.ts`：

- 浏览器：Chromium
- 基础 URL：`http://localhost:34115`（Wails dev 服务器）
- 超时：30 秒
- 重试：2 次
- 视口：1280x720

## 辅助函数

`setup.ts` 提供以下工具函数：

- `startWailsDev()` — 手动启动 Wails dev 服务器
- `stopWailsDev()` — 停止 Wails dev 服务器
- `waitForServer(url, timeout)` — 等待服务器就绪
- `takeScreenshotOnFailure(page, testName)` — 失败时截图
- `isServerRunning(url)` — 检查服务器是否运行中
