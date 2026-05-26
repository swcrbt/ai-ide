/**
 * Real-environment E2E tests — NO mockWailsRuntime.
 *
 * Connects to the Wails DevServer (http://localhost:34115) which has the
 * real Go backend. All window.go calls go through the websocket IPC bridge
 * using the real json.Marshal serialization.
 *
 * PREREQUISITE: wails dev must be running.
 *   cd ai-ide && wails dev
 *
 * RUN:
 *   npx playwright test --config=playwright.real.config.ts tests/gui-real/
 */

import { test, expect } from '@playwright/test';

test.describe('Real Environment - Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for Wails runtime to initialize websocket connection to Go backend
    await page.waitForTimeout(3000);
  });

  test('Wails runtime should be available', async ({ page }) => {
    const hasRuntime = await page.evaluate(() => {
      const w = window as any;
      return {
        hasGo: typeof w.go !== 'undefined',
        hasRuntime: typeof w.runtime !== 'undefined',
        hasWailsInvoke: typeof w.WailsInvoke !== 'undefined',
        packages: w.go ? Object.keys(w.go) : [],
      };
    });
    expect(hasRuntime.hasGo).toBe(true);
    expect(hasRuntime.hasRuntime).toBe(true);
    expect(hasRuntime.hasWailsInvoke).toBe(true);
    expect(hasRuntime.packages).toContain('fs');
  });

  test('ReadFile returns base64 string from real Go backend', async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const go = (window as any).go;
      if (!go?.fs?.FileService?.ReadFile) {
        return { error: 'ReadFile not available' };
      }
      try {
        const bytes = await go.fs.FileService.ReadFile(
          '/Users/swcrbt/develop/github/swcrbt/ai-ide/frontend/package.json'
        );
        return {
          type: typeof bytes,
          len: bytes?.length,
          preview: typeof bytes === 'string' ? bytes.slice(0, 30) : null,
        };
      } catch (e: any) {
        return { error: e.message || String(e) };
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.len).toBeGreaterThan(0);
    // Go's json.Marshal([]byte) → base64 string
    expect(result.type).toBe('string');
    // Should look like base64: starts with alphanumeric
    expect(result.preview).toMatch(/^[A-Za-z0-9+/]/);
  });

  test('打开文件后编辑器显示内容 — real ReadFile pipeline', async ({
    page,
  }) => {
    // Click on README.md which should exist in any project
    await page.locator('text=README.md').first().click();
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const text = await page
      .locator('.monaco-editor .view-lines')
      .textContent();
    expect(text).toBeTruthy();
    // README.md should have some content
    expect(text.length).toBeGreaterThan(0);
  });
});
