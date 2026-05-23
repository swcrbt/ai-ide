import { spawn, ChildProcess } from 'child_process';
import { Page } from '@playwright/test';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

let wailsProcess: ChildProcess | null = null;

export async function startWailsDev(): Promise<ChildProcess> {
  if (wailsProcess) {
    return wailsProcess;
  }

  wailsProcess = spawn('wails', ['dev'], {
    cwd: process.cwd(),
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  wailsProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[wails] ${data}`);
  });

  wailsProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[wails] ${data}`);
  });

  await waitForServer('http://localhost:34115', 60000);

  return wailsProcess;
}

export async function stopWailsDev(): Promise<void> {
  if (wailsProcess) {
    wailsProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!wailsProcess.killed) {
      wailsProcess.kill('SIGKILL');
    }
    wailsProcess = null;
  }
}

export async function waitForServer(
  url: string,
  timeoutMs: number = 30000,
): Promise<void> {
  const startTime = Date.now();
  const interval = 500;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      void 0;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export async function takeScreenshotOnFailure(
  page: Page,
  testName: string,
): Promise<void> {
  const screenshotDir = join(process.cwd(), 'test-results', 'screenshots');
  await mkdir(screenshotDir, { recursive: true });
  const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '_');
  const path = join(screenshotDir, `${sanitizedName}-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`Screenshot saved: ${path}`);
}

export async function cleanup(): Promise<void> {
  await stopWailsDev();
}

export async function isServerRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
