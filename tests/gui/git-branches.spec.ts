import { test, expect } from '@playwright/test';

/**
 * Ensure a valid git project exists in the database and return its path.
 * Uses the current repo (the one running wails dev) as the project.
 */
async function ensureProject(page: any): Promise<string> {
  return page.evaluate(async () => {
    const go = (window as any).go;
    if (!go?.git?.GitService?.GetRoot) {
      throw new Error('GitService.GetRoot not available');
    }

    // Get the repo root of the running app (wails dev working directory)
    const root = await go.git.GitService.GetRoot('.');

    // Check if this repo is already in the projects list
    const projects = await go.main.App.ListProjects();
    const existing = (projects || []).find((p: any) => p.path === root);
    if (existing) return root;

    // Add it as a project
    const result = await go.main.App.AddProject(root);
    if (result?.project) return root;
    if (result?.needsInit) {
      await go.main.App.InitGitAndSave(root);
      return root;
    }
    return root;
  });
}

test.describe('Real Environment - Git Branches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('GitService.Branches returns local branches via real backend', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const go = (window as any).go;
      if (!go?.git?.GitService?.Branches) {
        return { error: 'Branches not available' };
      }
      try {
        const root = await go.git.GitService.GetRoot('.');
        await go.git.GitService.SetRepoPath(root);
        const branches = await go.git.GitService.Branches(root);
        return { root, branches };
      } catch (e: any) {
        return { error: e.message || String(e) };
      }
    });

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.branches)).toBe(true);
    expect(result.branches.length).toBeGreaterThan(0);

    const localBranches = result.branches.filter(
      (b: any) => !b.name.startsWith('remotes/')
    );
    expect(localBranches.length).toBeGreaterThan(0);
    expect(localBranches.some((b: any) => b.name === 'main')).toBe(true);
  });

  test('setRepoPath loads branches into Zustand store', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { useGitStore } = await import('/src/stores/useGitStore.ts');
      const go = (window as any).go;

      const root = await go.git.GitService.GetRoot('.');
      await useGitStore.getState().setRepoPath(root);

      const branches = useGitStore.getState().branches;
      return {
        repoPath: useGitStore.getState().repoPath,
        branchCount: branches.length,
        branchNames: branches.map((b: any) => b.name),
      };
    });

    expect(result.repoPath).toBeTruthy();
    expect(result.branchCount).toBeGreaterThan(0);
    expect(result.branchNames).toContain('main');
  });

  test('loadBranches falls back to GetRepoPath when Zustand repoPath is empty', async ({ page }) => {
    // 关键回归测试：当 Zustand 的 repoPath 为空，但 Go 侧 s.repoPath 已设置时，
    // loadBranches 应通过 GetRepoPath() 回退获取路径并正常工作。
    const result = await page.evaluate(async () => {
      const { useGitStore } = await import('/src/stores/useGitStore.ts');
      const go = (window as any).go;

      // Go 侧设置 repoPath（模拟 SetCurrentProject 已被调用）
      const root = await go.git.GitService.GetRoot('.');
      await go.git.GitService.SetRepoPath(root);

      // 清空 Zustand repoPath，模拟未初始化状态
      useGitStore.setState({ repoPath: '' });

      // loadBranches 应通过 GetRepoPath() 回退获取 Go 侧的路径
      await useGitStore.getState().loadBranches();

      const branches = useGitStore.getState().branches;
      return {
        repoPath: useGitStore.getState().repoPath,
        branchCount: branches.length,
        branchNames: branches.map((b: any) => b.name),
      };
    });

    // Zustand repoPath 仍然为空（loadBranches 不设置它），但分支已加载
    expect(result.repoPath).toBe('');
    expect(result.branchCount).toBeGreaterThan(0);
    expect(result.branchNames).toContain('main');
  });

  test('loadStatus falls back to GetRepoPath when Zustand repoPath is empty', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { useGitStore } = await import('/src/stores/useGitStore.ts');
      const go = (window as any).go;

      // Go 侧设置 repoPath
      const root = await go.git.GitService.GetRoot('.');
      await go.git.GitService.SetRepoPath(root);

      // 清空 Zustand repoPath
      useGitStore.setState({ repoPath: '', isGitRepo: false, status: null });

      // loadStatus 应通过 GetRepoPath() 回退
      await useGitStore.getState().loadStatus();

      const state = useGitStore.getState();
      return {
        isGitRepo: state.isGitRepo,
        currentBranch: state.currentBranch,
      };
    });

    expect(result.isGitRepo).toBe(true);
    expect(result.currentBranch).toBeTruthy();
  });

  test('TaskCreateDialog shows branches in dropdown after init', async ({ page }) => {
    // Ensure a project is set up so the dialog can load branches
    await ensureProject(page);

    // Reload so the app's FileTree triggers loadProjects → auto-init git
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Click "新建任务" button
    const createBtn = page.locator('button:has-text("新建任务")');
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Dialog should be visible
    const dialog = page.locator('[role="dialog"]');
    expect(await dialog.isVisible()).toBe(true);

    // Click branch input to open dropdown
    const branchInput = dialog.locator('input[placeholder*="分支"]');
    await branchInput.click();
    await page.waitForTimeout(500);

    // Verify "已有分支" section with branch items is visible
    const branchSection = page.locator('text=已有分支');
    expect(await branchSection.isVisible()).toBe(true);
  });
});
