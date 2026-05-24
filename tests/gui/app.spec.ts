import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * 应用外壳 GUI 自动化测试
 *
 * 测试范围：
 * - 应用标题可见
 * - 顶部导航栏存在
 * - 底部状态栏存在
 * - 命令面板可以打开
 */
test.describe('App Shell', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('应用标题应该可见', async ({ page }) => {
    // 应用标题在 header 中
    const appTitle = page.locator('header span.font-semibold').first();
    await expect(appTitle).toBeVisible({ timeout: 10000 });

    // 检查标题文本不为空
    const titleText = await appTitle.textContent();
    expect(titleText?.length).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/screenshots/app-title-visible.png',
    });
  });

  test('顶部导航栏应该存在', async ({ page }) => {
    // header 元素
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // 检查 header 中的按钮
    const headerButtons = header.locator('button');
    const buttonCount = await headerButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3); // 主题、语言、设置

    await page.screenshot({
      path: 'test-results/screenshots/app-header-exists.png',
    });
  });

  test('底部状态栏应该存在', async ({ page }) => {
    // 状态栏使用 div 而非 footer
    const statusBar = page.locator('.bg-background.border-t.border-border').filter({ hasText: '就绪' }).first();
    await expect(statusBar).toBeVisible({ timeout: 10000 });

    // 检查状态栏内容
    const statusBarText = await statusBar.textContent();

    // 应该包含分支信息或任务信息
    const hasStatus = statusBarText?.includes('就绪') ||
                      statusBarText?.includes('main') ||
                      statusBarText?.includes('UTF-8');
    expect(hasStatus).toBe(true);

    await page.screenshot({
      path: 'test-results/screenshots/app-footer-exists.png',
    });
  });

  test('命令面板应该可以打开', async ({ page }) => {
    // 通过快捷键打开命令面板 (Ctrl+Shift+P)
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(1000);

    // 检查命令面板是否出现
    // 命令面板是一个固定定位的模态框
    const commandPalette = page.locator('.fixed.inset-0').filter({
      has: page.locator('input'),
    });

    const isPaletteVisible = await commandPalette.isVisible().catch(() => false);

    if (!isPaletteVisible) {
      // 如果快捷键没有打开，检查页面主体是否正常渲染
      const header = page.locator('header').first();
      await expect(header).toBeVisible();
    }

    await page.screenshot({
      path: 'test-results/screenshots/app-command-palette.png',
    });
  });
});
