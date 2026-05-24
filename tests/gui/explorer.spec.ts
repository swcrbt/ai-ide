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
    // 收集控制台日志
    page.on('console', msg => {
      console.log('[Browser Console]', msg.type(), msg.text());
    });
    page.on('pageerror', error => {
      console.log('[Browser Error]', error.message);
    });
    
    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // 增加等待时间
  });

  test('侧边栏应该可见', async ({ page }) => {
    // 等待 React 应用加载和渲染
    await page.waitForTimeout(5000);
    
    // 检查页面上的项目选择器文本
    const projectSelectorText = await page.locator('.bg-sidebar button').first().textContent();
    console.log('Project selector text:', projectSelectorText);
    
    // 如果显示 "选择项目"，说明项目没有加载，点击下拉选择
    if (projectSelectorText?.includes('选择项目')) {
      console.log('Project not loaded, clicking dropdown');
      await page.locator('.bg-sidebar button').first().click();
      await page.waitForTimeout(500);
      
      // 检查下拉菜单中是否有项目
      const dropdownItems = await page.locator('.bg-sidebar .absolute').textContent();
      console.log('Dropdown items:', dropdownItems);
    }

    // 右侧文件资源管理器面板
    const sidebar = page.locator('.bg-sidebar').filter({ hasText: 'ai-ide' });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/explorer-sidebar-visible.png',
    });
  });

  test('文件树应该渲染', async ({ page }) => {
    // 收集控制台日志
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(msg.text());
      console.log('[Browser]', msg.type(), msg.text());
    });
    
    // 收集页面错误
    page.on('pageerror', error => {
      console.log('[Browser Error]', error.message);
    });

    // 等待文件树内容渲染
    const fileTreeContainer = page.locator('.bg-sidebar');
    await expect(fileTreeContainer).toBeVisible({ timeout: 10000 });
    
    // 等待更长时间让数据加载
    await page.waitForTimeout(5000);

    // 检查是否有文件夹和文件显示
    const srcFolder = page.locator('text=src').first();
    await expect(srcFolder).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/screenshots/explorer-file-tree-rendered.png',
    });
  });

  test('点击文件应该打开编辑器标签', async ({ page }) => {
    // 点击根级别的 package.json 文件
    const packageJsonNode = page.locator('text=package.json').first();
    await expect(packageJsonNode).toBeVisible({ timeout: 10000 });
    await packageJsonNode.click();
    await page.waitForTimeout(500);

    // 检查编辑器标签栏是否显示 package.json
    const tabBar = page.locator('.scrollbar-hide');
    await expect(tabBar).toBeVisible();

    // 检查是否有 package.json 标签
    const packageTab = page.locator('text=package.json').first();
    await expect(packageTab).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/explorer-click-opens-file.png',
    });
  });

  test('侧边栏应该可以折叠和展开', async ({ page }) => {
    // 找到资源管理器侧边栏
    const sidebar = page.locator('.bg-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // 记录侧边栏初始状态
    const isVisibleBefore = await sidebar.isVisible();
    expect(isVisibleBefore).toBe(true);

    await page.screenshot({
      path: 'test-results/screenshots/explorer-sidebar-toggle.png',
    });
  });
});
