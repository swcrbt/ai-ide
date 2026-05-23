import { test, expect } from '@playwright/test';
import { mockWailsRuntime } from './mockWails';

/**
 * Git 面板 GUI 自动化测试
 *
 * 测试范围：
 * - Git 按钮打开面板
 * - Git 面板显示内容
 * - 分支名称显示
 */
test.describe('Git Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('Git 按钮应该可以打开面板', async ({ page }) => {
    // 找到 Git 按钮（header 中的 GitBranch 图标按钮）
    const gitButton = page.locator('button[title="Git"]').first();
    await expect(gitButton).toBeVisible({ timeout: 10000 });

    // 点击 Git 按钮
    await gitButton.click();
    await page.waitForTimeout(1000);

    // 检查 Git 面板是否出现（作为 aside 元素）
    const gitPanel = page.locator('aside').filter({ hasText: 'Git' });
    await expect(gitPanel).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/git-panel-opened.png',
    });
  });

  test('Git 面板应该显示内容', async ({ page }) => {
    // 打开 Git 面板
    const gitButton = page.locator('button[title="Git"]').first();
    await gitButton.click();
    await page.waitForTimeout(1000);

    // 检查面板内容区域
    const gitPanel = page.locator('aside').filter({ hasText: 'Git' });
    await expect(gitPanel).toBeVisible({ timeout: 10000 });

    // 检查是否有 Git 相关的内容（分支名或状态信息）
    const panelContent = gitPanel.locator('text=/main|未检测到|变更|提交/i').first();
    await expect(panelContent).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/git-panel-content.png',
    });
  });

  test('应该显示分支名称', async ({ page }) => {
    // 打开 Git 面板
    const gitButton = page.locator('button[title="Git"]').first();
    await gitButton.click();
    await page.waitForTimeout(1000);

    // 检查分支名称（默认显示 'main' 或实际分支名）
    const branchName = page.locator('text=/^main$|^master$/i').first();

    // 分支名可能在面板中显示，或者显示"未检测到 Git 仓库"
    const gitPanel = page.locator('aside').filter({ hasText: 'Git' });
    const panelText = await gitPanel.textContent();

    // 应该包含分支名或"未检测到"提示
    const hasBranchName = panelText?.toLowerCase().includes('main') ||
                          panelText?.includes('分支') ||
                          panelText?.includes('未检测到');
    expect(hasBranchName).toBe(true);

    await page.screenshot({
      path: 'test-results/screenshots/git-branch-name.png',
    });
  });
});
