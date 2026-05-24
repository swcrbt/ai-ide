import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * 控制台面板 E2E 测试——综合验证
 *
 * 所有测试合并为单例，避免 mockWailsRuntime 多次调用冲突
 */
test('控制台面板完整功能验证', async ({ page }) => {
  // 捕获页面错误
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 注入 Wails 模拟环境
  await mockWailsRuntime(page);

  // 加载页面
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // === 1. 点击文件 ===
  const packageJson = page.locator('text=package.json').first();
  await expect(packageJson).toBeVisible({ timeout: 10000 });
  await packageJson.click();
  await page.waitForTimeout(1500);

  // === 2. 控制台标签可见 ===
  const consoleTab = page.getByText('控制台');
  await expect(consoleTab).toBeVisible({ timeout: 5000 });

  // === 3. 点击控制台标签显示空状态 ===
  await consoleTab.click();
  await page.waitForTimeout(500);
  const emptyState = page.getByText('控制台就绪，暂无输出');
  await expect(emptyState).toBeVisible({ timeout: 5000 });

  // === 4. 过滤按钮全部存在 ===
  for (const level of ['log', 'error', 'warn', 'info', 'debug']) {
    await expect(page.locator(`button:has-text("${level}")`)).toBeVisible();
  }

  // === 5. 搜索框存在 ===
  await expect(page.getByPlaceholder('搜索控制台输出...')).toBeVisible();

  // === 6. 清空按钮存在 ===
  await expect(page.locator('button[title="清空"]')).toBeVisible();

  // === 7. 标签页切换不应崩溃（与 AI 助手之间切换） ===
  const aiTab = page.getByText('AI 助手');
  await aiTab.click();
  await page.waitForTimeout(300);
  await consoleTab.click();
  await page.waitForTimeout(300);

  // === 8. 点击文件不应有崩溃 ===
  const realErrors = errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('React error')
  );
  expect(realErrors).toHaveLength(0);
});
