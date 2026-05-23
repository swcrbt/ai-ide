import { create } from 'zustand';

/** 任务状态类型 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** 任务数据结构 */
export interface Task {
  id: string;
  title: string;
  branch: string;
  description?: string;
  status: TaskStatus;
  tag: string;
  tagColor: string;
  createdAt: number;
  updatedAt: number;
}

/** 自定义标签 */
export interface CustomTag {
  name: string;
  color: string;
}

/** 预设标签 */
export const PRESET_TAGS: CustomTag[] = [
  { name: 'BUG', color: '#ef4444' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'hotfix', color: '#22c55e' },
];

const CUSTOM_TAGS_STORAGE_KEY = 'ai-ide-custom-tags';

function loadCustomTagsFromStorage(): CustomTag[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as CustomTag[];
    }
  } catch {
    return [];
  }
  return [];
}

function saveCustomTagsToStorage(tags: CustomTag[]): void {
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch {
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getDefaultTasks(): Task[] {
  const now = Date.now();
  return [
    {
      id: 'task-1',
      title: '实现用户登录功能',
      branch: 'feature/login',
      status: 'in_progress',
      tag: 'feature',
      tagColor: '#3b82f6',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-2',
      title: '修复首页加载慢的问题',
      branch: 'bug/slow-loading',
      status: 'pending',
      tag: 'BUG',
      tagColor: '#ef4444',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  customTags: CustomTag[];

  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  addCustomTag: (name: string, color: string) => void;
  getActiveTask: () => Task | null;
  getAllTags: () => CustomTag[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: getDefaultTasks(),
  activeTaskId: null,
  customTags: loadCustomTagsFromStorage(),

  addTask: (task) => {
    const now = Date.now();
    const newTask: Task = {
      ...task,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      tasks: [...state.tasks, newTask],
    }));
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? { ...task, ...updates, updatedAt: Date.now() }
          : task
      ),
    }));
  },

  deleteTask: (id) => {
    set((state) => {
      const newTasks = state.tasks.filter((task) => task.id !== id);
      return {
        tasks: newTasks,
        activeTaskId:
          state.activeTaskId === id ? null : state.activeTaskId,
      };
    });
  },

  setActiveTask: (id) => {
    set({ activeTaskId: id });
  },

  setTaskStatus: (id, status) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? { ...task, status, updatedAt: Date.now() }
          : task
      ),
    }));
  },

  addCustomTag: (name, color) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    set((state) => {
      const allTags = [...PRESET_TAGS, ...state.customTags];
      const tagExists = allTags.some((tag) => tag.name === trimmedName);
      if (tagExists) {
        return state;
      }

      const newTags = [...state.customTags, { name: trimmedName, color }];
      saveCustomTagsToStorage(newTags);
      return { customTags: newTags };
    });
  },

  getActiveTask: () => {
    const state = get();
    if (!state.activeTaskId) return null;
    return state.tasks.find((task) => task.id === state.activeTaskId) ?? null;
  },

  getAllTags: () => {
    const state = get();
    return [...PRESET_TAGS, ...state.customTags];
  },
}));
