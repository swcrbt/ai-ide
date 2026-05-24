/**
 * ========================================================================
 * Wails 绑定类型适配层 / Wails Bindings Type Adapter Layer
 * ========================================================================
 *
 * @fileoverview
 * 本文件是前端业务代码与 Wails 自动生成绑定之间的类型适配层。
 * 所有业务代码应当从此文件导入类型和函数，而不是直接从 `wailsjs/go/*` 路径导入。
 *
 * This file serves as a type adapter layer between frontend business code
 * and Wails auto-generated bindings. All business code should import types
 * and functions from this file instead of directly from `wailsjs/go/*` paths.
 *
 * @purpose
 * - 隔离业务代码与 Wails 生成绑定的内部结构变化
 * - 提供稳定、统一的类型接口
 * - 避免直接依赖自动生成文件的路径和结构
 *
 * - Isolate business code from internal structure changes of Wails-generated bindings
 * - Provide a stable, unified type interface
 * - Avoid direct dependencies on auto-generated file paths and structures
 *
 * @usage
 * ```typescript
 * // ✅ 正确 / Correct
 * import { GitStatus, git, Status } from '@/types/wails';
 *
 * // ❌ 错误 / Incorrect — 不要直接导入 Wails 生成文件
 * // import { git } from '../../wailsjs/go/models';
 * // import { Status } from '../../wailsjs/go/git/GitService';
 * ```
 *
 * @warning
 * 如果 Wails 后端接口发生变化，只需更新此文件中的映射，
 * 无需修改散布在各处的业务代码。
 *
 * If Wails backend interfaces change, only update the mappings in this file,
 * no need to modify business code scattered throughout the codebase.
 * ========================================================================
 */

// ---------------------------------------------------------------------------
// 类型导入 / Type Imports
// ---------------------------------------------------------------------------

/** 从 Wails 生成文件导入 git 命名空间类型 */
import { git } from '../../wailsjs/go/models';
/** 从 Wails 生成文件导入 fs 命名空间类型 */
import { fs } from '../../wailsjs/go/models';

// ---------------------------------------------------------------------------
// Git 类型 / Git Types
// ---------------------------------------------------------------------------

/** Git 仓库状态信息 */
export type GitStatus = git.GitStatus;

/** 单个文件的 Git 差异信息 */
export type GitDiff = git.GitDiff;

/** Git 分支信息 */
export type GitBranch = git.GitBranch;

/** Git 提交记录 */
export type GitCommit = git.GitCommit;

/** Git 仓库变更摘要 */
export type GitSummary = git.GitSummary;

/** 单个文件的 Git 状态 */
export type GitFileStatus = git.GitFileStatus;

// ---------------------------------------------------------------------------
// fs 类型 / File System Types
// ---------------------------------------------------------------------------

/** 文件树节点 */
export type FileNode = fs.FileNode;

/** 文件系统监听器 */
export type FileWatcher = fs.FileWatcher;

// ---------------------------------------------------------------------------
// 命名空间导出 / Namespace Exports
// ---------------------------------------------------------------------------

/**
 * Git 相关命名空间，包含所有 Git 类型类。
 * 在需要直接使用类构造函数或静态方法时使用。
 *
 * Namespace containing all Git-related types.
 * Use when you need direct access to class constructors or static methods.
 */
export { git };

/**
 * 文件系统相关命名空间，包含所有 fs 类型类。
 * 在需要直接使用类构造函数或静态方法时使用。
 *
 * Namespace containing all filesystem-related types.
 * Use when you need direct access to class constructors or static methods.
 */
export { fs };

// ---------------------------------------------------------------------------
// Git 服务函数 / Git Service Functions
// ---------------------------------------------------------------------------

/** 检查分支是否存在 */
export { BranchExists } from '../../wailsjs/go/main/App';

/** 创建并切换到新分支 */
export { CreateBranch } from '../../wailsjs/go/main/App';

/** 获取当前分支名称 */
export { Branch } from '../../wailsjs/go/git/GitService';

/** 获取所有分支列表 */
export { Branches } from '../../wailsjs/go/git/GitService';

/** 切换分支 */
export { Checkout } from '../../wailsjs/go/git/GitService';

/** 提交更改 */
export { Commit } from '../../wailsjs/go/git/GitService';

/** 获取指定文件的差异 */
export { Diff } from '../../wailsjs/go/git/GitService';

/** 获取所有文件的差异 */
export { DiffAll } from '../../wailsjs/go/git/GitService';

/** 丢弃更改 */
export { DiscardChanges } from '../../wailsjs/go/git/GitService';

/** 获取当前仓库路径 */
export { GetRepoPath } from '../../wailsjs/go/git/GitService';

/** 获取指定路径的 Git 根目录 */
export { GetRoot } from '../../wailsjs/go/git/GitService';

/** 初始化 Git 仓库 */
export { Init } from '../../wailsjs/go/git/GitService';

/** 判断指定路径是否为 Git 仓库 */
export { IsGitRepo } from '../../wailsjs/go/git/GitService';

/** 获取提交历史 */
export { Log } from '../../wailsjs/go/git/GitService';

/** 从远程拉取代码 */
export { Pull } from '../../wailsjs/go/git/GitService';

/** 推送到远程 */
export { Push } from '../../wailsjs/go/git/GitService';

/** 设置当前仓库路径 */
export { SetRepoPath } from '../../wailsjs/go/git/GitService';

/** 暂存文件 */
export { Stage } from '../../wailsjs/go/git/GitService';

/** Stash 更改 */
export { Stash } from '../../wailsjs/go/git/GitService';

/** 恢复 Stash */
export { StashPop } from '../../wailsjs/go/git/GitService';

/** 获取仓库状态 */
export { Status } from '../../wailsjs/go/git/GitService';

/** 获取仓库变更摘要 */
export { Summary } from '../../wailsjs/go/git/GitService';

/** 取消暂存文件 */
export { Unstage } from '../../wailsjs/go/git/GitService';

// ---------------------------------------------------------------------------
// Project 服务函数 / Project Service Functions
// ---------------------------------------------------------------------------

// Project 服务函数通过 App 暴露
// 注意：这些函数在后端实现后会自动生成到 wailsjs/go/main/App.d.ts 中
// 目前先使用占位实现，避免 TypeScript 编译错误

/** 获取项目列表 */
export function ListProjects(): Promise<Array<{ id: number; name: string; path: string; createdAt: string; updatedAt: string }>> {
  // @ts-ignore - Wails 运行时全局可用
  return window.go?.main?.App?.ListProjects?.() || Promise.resolve([]);
}

/** 添加项目 */
export function AddProject(path: string): Promise<[any, boolean]> {
  // @ts-ignore - Wails 运行时全局可用
  return window.go?.main?.App?.AddProject?.(path) || Promise.resolve([null, false]);
}

/** 初始化 Git 并保存项目 */
export function InitGitAndSave(path: string): Promise<any> {
  // @ts-ignore - Wails 运行时全局可用
  return window.go?.main?.App?.InitGitAndSave?.(path) || Promise.resolve(null);
}

/** 删除项目 */
export function RemoveProject(id: number): Promise<void> {
  // @ts-ignore - Wails 运行时全局可用
  return window.go?.main?.App?.RemoveProject?.(id) || Promise.resolve();
}

/** 设置当前项目 */
export function SetCurrentProject(path: string): Promise<void> {
  // @ts-ignore - Wails 运行时全局可用
  return window.go?.main?.App?.SetCurrentProject?.(path) || Promise.resolve();
}
