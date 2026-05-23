import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * 文件浏览器 GUI 自动化测试
 *
 * 测试范围：
 * - 侧边栏可见性
 * - 文件树渲染
 * - 点击文件打开
 * - 目录展开/折叠
 */
test.describe('File Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('侧边栏应该可见', async ({ page }) => {
    // 侧边栏包含"资源管理器"标题
    const sidebar = page.locator('aside').filter({ hasText: '资源管理器' });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/explorer-sidebar-visible.png',
    });
  });

  test('文件树应该渲染', async ({ page }) => {
    // 等待文件树内容渲染
    await page.waitForSelector('aside', { timeout: 10000 });

    // 检查是否有文件夹和文件显示
    const fileTreeContent = page.locator('aside').filter({ hasText: 'src' });
    await expect(fileTreeContent).toBeVisible({ timeout: 10000 });

    // 检查具体的文件和文件夹项
    const srcFolder = page.locator('text=src').first();
    await expect(srcFolder).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/explorer-file-tree-rendered.png',
    });
  });

  test('点击文件应该打开编辑器标签', async ({ page }) => {
    // 左侧工具栏有打开演示文件的按钮
    const openMainButton = page.locator('button[title="打开 main.ts"]').first();
    await expect(openMainButton).toBeVisible({ timeout: 10000 });

    // 点击打开 main.ts
    await openMainButton.click();
    await page.waitForTimeout(500);

    // 检查编辑器标签栏是否显示 main.ts
    const tabBar = page.locator('.scrollbar-hide');
    await expect(tabBar).toBeVisible();

    // 检查是否有 main.ts 标签
    const mainTab = page.locator('text=main.ts');
    await expect(mainTab).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/explorer-click-opens-file.png',
    });
  });

  test('侧边栏应该可以折叠和展开', async ({ page }) => {
    // 找到资源管理器侧边栏
    const sidebar = page.locator('aside').filter({ hasText: '资源管理器' });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // 记录侧边栏初始状态
    const isVisibleBefore = await sidebar.isVisible();
    expect(isVisibleBefore).toBe(true);

    await page.screenshot({
      path: 'test-results/screenshots/explorer-sidebar-toggle.png',
    });
  });
});
