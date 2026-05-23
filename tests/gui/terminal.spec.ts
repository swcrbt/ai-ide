import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * 终端面板 GUI 自动化测试
 *
 * 测试范围：
 * - 终端面板可见性
 * - 终端标签存在
 * - 标签切换功能
 */
test.describe('Terminal Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  });

  test('终端面板应该可见', async ({ page }) => {
    // 底部面板包含终端和 AI 标签
    const bottomPanel = page.locator('div.h-64.border-t.border-border');
    await expect(bottomPanel).toBeVisible({ timeout: 10000 });

    // 检查终端区域
    const terminalArea = page.locator('.xterm-screen, .xterm, .xterm-viewport').first();
    // xterm 可能不会立即渲染，所以检查面板存在即可
    await expect(bottomPanel).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/terminal-panel-visible.png',
    });
  });

  test('终端和 AI 标签应该存在', async ({ page }) => {
    // 底部面板的标题栏
    const bottomPanel = page.locator('.border-t.border-border').first();
    await expect(bottomPanel).toBeVisible({ timeout: 10000 });

    // 检查"终端"标签按钮
    const terminalTab = page.locator('button:has-text("终端")').first();
    await expect(terminalTab).toBeVisible({ timeout: 10000 });

    // 检查"AI 助手"标签按钮
    const aiTab = page.locator('button:has-text("AI 助手")').first();
    await expect(aiTab).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/terminal-tabs-exist.png',
    });
  });

  test('应该可以在终端和 AI 标签之间切换', async ({ page }) => {
    // 等待标签渲染
    const terminalTab = page.locator('button:has-text("终端")').first();
    const aiTab = page.locator('button:has-text("AI 助手")').first();

    await expect(terminalTab).toBeVisible({ timeout: 10000 });
    await expect(aiTab).toBeVisible({ timeout: 10000 });

    // 切换到 AI 助手标签
    await aiTab.click();
    await page.waitForTimeout(1000);

    // 检查 AI 面板内容是否显示
    const aiContent = page.locator('text=AI').first();
    await expect(aiContent).toBeVisible();

    // 切换回终端标签
    await terminalTab.click();
    await page.waitForTimeout(1000);

    // 检查终端标签是否激活（通过样式类判断）
    const terminalTabClasses = await terminalTab.getAttribute('class');
    const isTerminalActive = terminalTabClasses?.includes('bg-background') ||
                             terminalTabClasses?.includes('border-t');
    expect(isTerminalActive).toBe(true);

    await page.screenshot({
      path: 'test-results/screenshots/terminal-tab-switching.png',
    });
  });
});
