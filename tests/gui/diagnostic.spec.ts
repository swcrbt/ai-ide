import { test, expect } from '@playwright/test';
import { writeFile } from 'fs/promises';
import { mockWailsRuntime } from './mockWails';

test.describe('Diagnostic', () => {
  test('check page rendering with logs to file', async ({ page }) => {
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await mockWailsRuntime(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const goExists = await page.evaluate(() => typeof (window as any).go !== 'undefined');
    consoleLogs.push(`[info] window.go exists: ${goExists}`);

    const html = await page.content();
    const hasApp = html.includes('id="App"');
    const hasHeader = html.includes('<header');
    const hasFooter = html.includes('<footer');

    const report = [
      '=== Console Logs ===',
      ...consoleLogs,
      '=== Page Errors ===',
      ...pageErrors,
      '=== HTML Check ===',
      `Has #App: ${hasApp}`,
      `Has header: ${hasHeader}`,
      `Has footer: ${hasFooter}`,
      `HTML length: ${html.length}`,
      '=== HTML Snippet ===',
      html.substring(0, 800),
    ].join('\n');

    await writeFile('test-results/diagnostic-report.txt', report);
    console.log(report);

    await page.screenshot({ path: 'test-results/screenshots/diagnostic.png' });

    expect(hasApp).toBe(true);
  });
});
