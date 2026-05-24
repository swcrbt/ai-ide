import { create } from 'zustand';
import {
  ListProjects,
  AddProject,
  InitGitAndSave,
  RemoveProject,
  SetCurrentProject,
} from '../types/wails';
import { useExplorerStore } from './useExplorerStore';
import { useGitStore } from './useGitStore';

/**
 * 项目类型
 */
export interface Project {
  /** 项目 ID */
  id: number;
  /** 项目名称 */
  name: string;
  /** 项目路径 */
  path: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 项目状态接口
 */
interface ProjectState {
  /** 项目列表 */
  projects: Project[];
  /** 当前选中的项目 */
  currentProject: Project | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 添加项目对话框是否打开 */
  isAddDialogOpen: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 项目操作接口
 */
interface ProjectActions {
  /** 加载项目列表 */
  loadProjects: () => Promise<void>;
  /** 添加项目 */
  addProject: (path: string) => Promise<{ project: Project | null; needsInit: boolean }>;
  /** 初始化 Git 并添加项目 */
  initGitAndAdd: (path: string) => Promise<Project>;
  /** 删除项目 */
  removeProject: (id: number) => Promise<void>;
  /** 切换项目 */
  switchProject: (id: number) => Promise<void>;
  /** 设置添加项目对话框状态 */
  setAddDialogOpen: (open: boolean) => void;
  /** 清除错误信息 */
  clearError: () => void;
}

/**
 * 项目状态管理 Store
 *
 * 管理项目列表、当前项目、加载状态等。
 * 通过 Wails 后端 API 进行项目 CRUD 操作。
 */
export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  isAddDialogOpen: false,
  error: null,

  /** 加载项目列表 */
  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await ListProjects();
      const projectList = projects || [];
      // 如果有项目且没有当前项目，自动选择第一个
      if (projectList.length > 0 && !get().currentProject) {
        set({ 
          projects: projectList, 
          currentProject: projectList[0],
          isLoading: false 
        });
      } else {
        set({ projects: projectList, isLoading: false });
      }
    } catch (err: any) {
      const errorMsg = err?.message || '加载项目列表失败';
      console.error('加载项目列表失败:', err);
      set({ projects: [], isLoading: false, error: errorMsg });
      throw err;
    }
  },

  /** 添加项目 */
  addProject: async (path: string) => {
    try {
      const result = await AddProject(path);

      if (result.project) {
        // 刷新列表
        await get().loadProjects();
        // 自动切换到新项目
        await get().switchProject(result.project.id);
      }

      return { project: result.project ?? null, needsInit: result.needsInit };
    } catch (err) {
      console.error('添加项目失败:', err);
      throw err;
    }
  },

  /** 初始化 Git 并添加项目 */
  initGitAndAdd: async (path: string) => {
    try {
      const project = await InitGitAndSave(path);
      // 刷新列表
      await get().loadProjects();
      // 自动切换到新项目
      await get().switchProject(project.id);
      return project;
    } catch (err) {
      console.error('初始化 Git 并添加项目失败:', err);
      throw err;
    }
  },

  /** 删除项目 */
  removeProject: async (id: number) => {
    try {
      await RemoveProject(id);
      // 如果删除的是当前项目，清空当前项目
      if (get().currentProject?.id === id) {
        set({ currentProject: null });
        // 清空文件树
        useExplorerStore.setState({ treeData: [], rootPath: '', projectName: '' });
      }
      // 刷新列表
      await get().loadProjects();
    } catch (err) {
      console.error('删除项目失败:', err);
      throw err;
    }
  },

  /** 切换项目 */
  switchProject: async (id: number) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) {
      throw new Error('项目不存在');
    }

    set({ currentProject: project, error: null });

    const errors: string[] = [];

    // 设置 Git 仓库路径
    try {
      await SetCurrentProject(project.path);
    } catch (err: any) {
      const msg = err?.message || '设置当前项目失败';
      console.error('设置当前项目失败:', err);
      errors.push(msg);
    }

    // 加载文件树
    try {
      await useExplorerStore.getState().loadTree(project.path);
    } catch (err: any) {
      const msg = err?.message || '加载文件树失败';
      console.error('加载文件树失败:', err);
      errors.push(msg);
    }

    // 加载 Git 状态
    try {
      await useGitStore.getState().loadStatus(project.path);
      await useGitStore.getState().loadSummary(project.path);
    } catch (err: any) {
      const msg = err?.message || '加载 Git 状态失败';
      console.error('加载 Git 状态失败:', err);
      errors.push(msg);
    }

    if (errors.length > 0) {
      set({ error: errors.join('; ') });
    }
  },

  /** 设置添加项目对话框状态 */
  setAddDialogOpen: (open: boolean) => {
    set({ isAddDialogOpen: open });
  },

  /** 清除错误信息 */
  clearError: () => {
    set({ error: null });
  },
}));
