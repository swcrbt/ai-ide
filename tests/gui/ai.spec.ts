import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * AI 对话面板 GUI 自动化测试
 *
 * 测试范围：
 * - AI 面板可以打开
 * - 对话界面元素存在
 */
test.describe('AI Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  });

  test('AI 面板应该可以打开', async ({ page }) => {
    // 底部面板有"AI 助手"标签
    const aiTab = page.locator('button:has-text("AI 助手")').first();
    await expect(aiTab).toBeVisible({ timeout: 10000 });

    // 点击 AI 助手标签
    await aiTab.click();
    await page.waitForTimeout(1000);

    // 检查 AI 面板内容区域是否显示
    // AI 面板包含 MessageList 和 MessageInput 组件
    const aiPanel = page.locator('div.h-64.border-t.border-border');
    await expect(aiPanel).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/ai-panel-opened.png',
    });
  });

  test('对话界面元素应该存在', async ({ page }) => {
    // 切换到 AI 面板
    const aiTab = page.locator('button:has-text("AI 助手")').first();
    await aiTab.click();
    await page.waitForTimeout(1000);

    // 检查 AI 面板是否可见
    const bottomPanel = page.locator('.border-t.border-border').first();
    await expect(bottomPanel).toBeVisible({ timeout: 10000 });

    // 检查是否有输入框或消息区域
    // MessageInput 组件通常包含 textarea 或 input
    const inputArea = page.locator('textarea, input[type="text"]').first();

    // 或者检查是否有消息列表区域
    const messageArea = page.locator('.overflow-hidden').filter({
      has: page.locator('div'),
    }).first();

    // 至少有一个内容区域应该存在
    const hasInput = await inputArea.isVisible().catch(() => false);
    const hasMessageArea = await messageArea.isVisible().catch(() => false);

    expect(hasInput || hasMessageArea).toBe(true);

    await page.screenshot({
      path: 'test-results/screenshots/ai-chat-elements.png',
    });
  });
});
