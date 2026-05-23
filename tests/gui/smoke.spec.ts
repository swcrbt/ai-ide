import { test, expect } from '@playwright/test';

test.describe('App Smoke Tests', () => {
  test('app loads and shows content', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Capture page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Log console output
    console.log('=== Console Logs ===');
    consoleLogs.forEach(log => console.log(log));
    console.log('=== Page Errors ===');
    pageErrors.forEach(err => console.log(err));
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/app-test.png' });
    
    // Check content
    const html = await page.content();
    console.log('HTML length:', html.length);
    console.log('Has #root:', html.includes('id="root"'));
    console.log('Has #App:', html.includes('id="App"'));
    
    expect(html.length).toBeGreaterThan(100);
  });
});
