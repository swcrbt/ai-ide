import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * 编辑器 GUI 自动化测试
 *
 * 测试范围：
 * - 编辑器容器可见性
 * - 标签栏显示标签
 * - 标签切换功能
 * - 编辑器内容加载
 */
test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  });

  test('编辑器容器应该可见', async ({ page }) => {
    // 使用 data-testid 选择器
    const editorContainer = page.locator('[data-testid="editor-container"]');
    await expect(editorContainer).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/editor-container-visible.png',
    });
  });

  test('标签栏应该显示标签页', async ({ page }) => {
    // 等待标签栏出现
    const tabBar = page.locator('.scrollbar-hide');
    await expect(tabBar).toBeVisible({ timeout: 10000 });

    // 检查是否有标签项（默认会打开 main.ts）
    const tabs = tabBar.locator('> div');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);

    // 检查第一个标签是否包含文件名
    const firstTab = tabs.first();
    await expect(firstTab).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/editor-tab-bar-shows-tabs.png',
    });
  });

  test('应该可以在标签页之间切换', async ({ page }) => {
    // 打开多个文件
    const openHelperButton = page.locator('button[title="打开 helper.js"]').first();
    await expect(openHelperButton).toBeVisible({ timeout: 10000 });
    await openHelperButton.click();
    await page.waitForTimeout(500);

    const openPackageButton = page.locator('button[title="打开 package.json"]').first();
    await expect(openPackageButton).toBeVisible();
    await openPackageButton.click();
    await page.waitForTimeout(500);

    // 获取标签栏
    const tabBar = page.locator('.scrollbar-hide');
    const tabs = tabBar.locator('> div');
    const tabCount = await tabs.count();

    // 确保有多个标签
    expect(tabCount).toBeGreaterThanOrEqual(2);

    // 点击第二个标签
    const secondTab = tabs.nth(1);
    await secondTab.click();
    await page.waitForTimeout(500);

    // 检查第二个标签是否被激活（通过背景色或类名判断）
    const secondTabClasses = await secondTab.getAttribute('class');
    expect(secondTabClasses).toContain('bg-[');

    await page.screenshot({
      path: 'test-results/screenshots/editor-tab-switching.png',
    });
  });

  test('编辑器应该显示内容', async ({ page }) => {
    // 编辑器容器可见
    const editorContainer = page.locator('[data-testid="editor-container"]');
    await expect(editorContainer).toBeVisible({ timeout: 10000 });

    // Monaco 编辑器会在 .monaco-editor 类中渲染内容
    const monacoEditor = page.locator('.monaco-editor');
    await expect(monacoEditor).toBeVisible({ timeout: 15000 });

    // 检查编辑器视图行是否存在
    const viewLines = page.locator('.view-lines');
    await expect(viewLines).toBeVisible({ timeout: 10000 });

    // 检查是否有实际内容
    const linesContent = await viewLines.textContent();
    expect(linesContent?.length).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/screenshots/editor-has-content.png',
    });
  });
});
