import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

test.describe('AI Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  });

  test('AI 面板应该可以打开', async ({ page }) => {
    // 先打开一个文件以显示底部面板
    const packageJsonNode = page.locator('text=package.json').first();
    await expect(packageJsonNode).toBeVisible({ timeout: 10000 });
    await packageJsonNode.click();
    await page.waitForTimeout(500);

    const aiTab = page.locator('button:has-text("AI 助手")').first();
    await expect(aiTab).toBeVisible({ timeout: 10000 });

    await aiTab.click();
    await page.waitForTimeout(1000);

    const bottomPanel = page.locator('.border-t.border-border').first();
    await expect(bottomPanel).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/ai-panel-opened.png',
    });
  });

  test('AI 面板在中间区域应该水平垂直居中', async ({ page }) => {
    const closeButtons = page.locator('button[title="关闭"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(0).click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    const centeredPanel = page.locator('[data-testid="chat-panel-centered"]').first();
    await expect(centeredPanel).toBeVisible({ timeout: 10000 });

    const panelBox = await centeredPanel.boundingBox();
    const mainBox = await page.locator('main').first().boundingBox();

    expect(panelBox).not.toBeNull();
    expect(mainBox).not.toBeNull();

    if (panelBox && mainBox) {
      const panelCenterX = panelBox.x + panelBox.width / 2;
      const mainCenterX = mainBox.x + mainBox.width / 2;
      expect(Math.abs(panelCenterX - mainCenterX)).toBeLessThan(5);
      expect(panelBox.width).toBeLessThanOrEqual(768);
    }

    await page.screenshot({
      path: 'test-results/screenshots/ai-panel-centered.png',
    });
  });

  test('AI 面板消息和输入框应该最大宽度 768px', async ({ page }) => {
    const closeButtons = page.locator('button[title="关闭"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(0).click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await textarea.fill('Hello AI');
    await textarea.press('Enter');
    await page.waitForTimeout(1000);

    const messageBubble = page.locator('[data-testid="message-bubble"]').first();
    if (await messageBubble.isVisible().catch(() => false)) {
      const box = await messageBubble.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(768);
      }
    }

    const inputContainer = page.locator('[data-testid="message-input-container"]').first();
    await expect(inputContainer).toBeVisible({ timeout: 10000 });

    const inputBox = await inputContainer.boundingBox();
    if (inputBox) {
      expect(inputBox.width).toBeLessThanOrEqual(768);
    }

    await page.screenshot({
      path: 'test-results/screenshots/ai-panel-max-width.png',
    });
  });

  test('发送消息后应该出现在消息列表中', async ({ page }) => {
    const closeButtons = page.locator('button[title="关闭"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(0).click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await textarea.fill('Hello AI');
    await textarea.press('Enter');
    await page.waitForTimeout(200);

    // 验证用户消息出现在列表中
    const userBubble = page.locator('[data-testid="message-bubble"]').filter({ hasText: 'Hello AI' }).first();
    await expect(userBubble).toBeVisible({ timeout: 10000 });

    // 验证 assistant 回复消息出现
    const assistantBubble = page.locator('[data-testid="message-bubble"]').filter({ hasText: '收到你的消息' }).first();
    await expect(assistantBubble).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/ai-chat-messages.png',
    });
  });

  test('发送消息失败后应该显示错误提示', async ({ page }) => {
    // 让 CreateChatSession 失败
    await page.evaluate(() => {
      (window as any).go.main.App.CreateChatSession = () => Promise.reject(new Error('测试：未配置 API Key'));
    });

    const closeButtons = page.locator('button[title="关闭"]');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(0).click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await textarea.fill('Test error');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    // 验证错误消息出现在列表中
    const errorBubble = page.locator('[data-testid="message-bubble"]').filter({ hasText: '无法发送消息' }).first();
    await expect(errorBubble).toBeVisible({ timeout: 10000 });

    // 验证错误提示条可见
    const errorBar = page.locator('.bg-destructive\\/10').filter({ hasText: '测试：未配置 API Key' }).first();
    await expect(errorBar).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/ai-chat-error.png',
    });
  });
});
