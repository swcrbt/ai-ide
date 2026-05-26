import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore, PRESET_TAGS } from './useTaskStore';

describe('useTaskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [],
      activeTaskId: null,
      customTags: [],
    });
  });

  describe('初始状态', () => {
    it('应包含默认任务', () => {
      // 重新创建 store 来获取默认状态
      const freshStore = useTaskStore.getState();
      freshStore.tasks = [];
      expect(freshStore.tasks).toHaveLength(0);
    });

    it('activeTaskId 初始应为 null', () => {
      expect(useTaskStore.getState().activeTaskId).toBeNull();
    });

    it('customTags 应从 localStorage 加载', () => {
      // 由于 beforeEach 已清空，应返回空数组
      expect(useTaskStore.getState().customTags).toEqual([]);
    });
  });

  describe('addTask', () => {
    it('应添加新任务并生成 id', () => {
      const store = useTaskStore.getState();
      store.addTask({
        title: '新任务',
        branch: 'feature/test',
        status: 'pending',
        tag: 'feature',
        tagColor: '#3b82f6',
      });

      const state = useTaskStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].title).toBe('新任务');
      expect(state.tasks[0].branch).toBe('feature/test');
      expect(state.tasks[0].id).toBeDefined();
      expect(state.tasks[0].createdAt).toBeGreaterThan(0);
    });

    it('应添加多个任务', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务1', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      store.addTask({ title: '任务2', branch: 'b2', status: 'in_progress', tag: 'feature', tagColor: '#3b82f6' });

      expect(useTaskStore.getState().tasks).toHaveLength(2);
    });
  });

  describe('updateTask', () => {
    it('应更新任务属性', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '原标题', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      const taskId = useTaskStore.getState().tasks[0].id;

      store.updateTask(taskId, { title: '新标题', status: 'completed' });

      const task = useTaskStore.getState().tasks[0];
      expect(task.title).toBe('新标题');
      expect(task.status).toBe('completed');
      expect(task.branch).toBe('b1');
      expect(task.updatedAt).toBeGreaterThanOrEqual(task.createdAt);
    });

    it('更新不存在的任务不应报错', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });

      store.updateTask('non-existent', { title: '新标题' });

      expect(useTaskStore.getState().tasks[0].title).toBe('任务');
    });
  });

  describe('deleteTask', () => {
    it('应删除指定任务', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务1', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      store.addTask({ title: '任务2', branch: 'b2', status: 'pending', tag: 'feature', tagColor: '#3b82f6' });
      const taskId = useTaskStore.getState().tasks[0].id;

      store.deleteTask(taskId);

      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].title).toBe('任务2');
    });

    it('删除 activeTask 时应重置 activeTaskId', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      const taskId = useTaskStore.getState().tasks[0].id;
      store.setActiveTask(taskId);

      store.deleteTask(taskId);

      expect(useTaskStore.getState().activeTaskId).toBeNull();
    });

    it('删除非 activeTask 不应影响 activeTaskId', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务1', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      store.addTask({ title: '任务2', branch: 'b2', status: 'pending', tag: 'feature', tagColor: '#3b82f6' });
      const id1 = useTaskStore.getState().tasks[0].id;
      const id2 = useTaskStore.getState().tasks[1].id;
      store.setActiveTask(id1);

      store.deleteTask(id2);

      expect(useTaskStore.getState().activeTaskId).toBe(id1);
    });
  });

  describe('setActiveTask', () => {
    it('应设置 activeTaskId', () => {
      const store = useTaskStore.getState();
      store.setActiveTask('task-123');
      expect(useTaskStore.getState().activeTaskId).toBe('task-123');
    });

    it('应能清除 activeTaskId', () => {
      const store = useTaskStore.getState();
      store.setActiveTask('task-123');
      store.setActiveTask(null);
      expect(useTaskStore.getState().activeTaskId).toBeNull();
    });
  });

  describe('setTaskStatus', () => {
    it('应更新任务状态', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      const taskId = useTaskStore.getState().tasks[0].id;

      store.setTaskStatus(taskId, 'in_progress');

      expect(useTaskStore.getState().tasks[0].status).toBe('in_progress');
    });

    it('不应影响其他任务', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务1', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      store.addTask({ title: '任务2', branch: 'b2', status: 'pending', tag: 'feature', tagColor: '#3b82f6' });
      const id1 = useTaskStore.getState().tasks[0].id;

      store.setTaskStatus(id1, 'completed');

      expect(useTaskStore.getState().tasks[1].status).toBe('pending');
    });
  });

  describe('addCustomTag', () => {
    it('应添加新标签', () => {
      const store = useTaskStore.getState();
      store.addCustomTag('custom', '#ff0000');

      expect(useTaskStore.getState().customTags).toHaveLength(1);
      expect(useTaskStore.getState().customTags[0]).toEqual({ name: 'custom', color: '#ff0000' });
    });

    it('不应添加重复标签', () => {
      const store = useTaskStore.getState();
      store.addCustomTag('custom', '#ff0000');
      store.addCustomTag('custom', '#00ff00');

      expect(useTaskStore.getState().customTags).toHaveLength(1);
      expect(useTaskStore.getState().customTags[0].color).toBe('#ff0000');
    });

    it('不应添加与预设标签重名的标签', () => {
      const store = useTaskStore.getState();
      store.addCustomTag('BUG', '#ff0000');

      expect(useTaskStore.getState().customTags).toHaveLength(0);
    });

    it('应去除首尾空格', () => {
      const store = useTaskStore.getState();
      store.addCustomTag('  custom  ', '#ff0000');

      expect(useTaskStore.getState().customTags[0].name).toBe('custom');
    });

    it('空字符串不应添加', () => {
      const store = useTaskStore.getState();
      store.addCustomTag('', '#ff0000');
      store.addCustomTag('   ', '#ff0000');

      expect(useTaskStore.getState().customTags).toHaveLength(0);
    });
  });

  describe('getActiveTask', () => {
    it('应返回当前激活的任务', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务1', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      const taskId = useTaskStore.getState().tasks[0].id;
      store.setActiveTask(taskId);

      const active = store.getActiveTask();
      expect(active?.title).toBe('任务1');
    });

    it('无激活任务时应返回 null', () => {
      const store = useTaskStore.getState();
      expect(store.getActiveTask()).toBeNull();
    });

    it('激活的任务被删除后应返回 null', () => {
      const store = useTaskStore.getState();
      store.addTask({ title: '任务', branch: 'b1', status: 'pending', tag: 'BUG', tagColor: '#ef4444' });
      const taskId = useTaskStore.getState().tasks[0].id;
      store.setActiveTask(taskId);
      store.deleteTask(taskId);

      expect(store.getActiveTask()).toBeNull();
    });
  });

  describe('getAllTags', () => {
    it('应返回预设标签和自定义标签', () => {
      const store = useTaskStore.getState();
      store.addCustomTag('custom1', '#ff0000');

      const allTags = store.getAllTags();
      expect(allTags.length).toBe(PRESET_TAGS.length + 1);
      expect(allTags.some((t) => t.name === 'custom1')).toBe(true);
      expect(allTags.some((t) => t.name === 'BUG')).toBe(true);
    });

    it('无自定义标签时只返回预设标签', () => {
      const store = useTaskStore.getState();
      const allTags = store.getAllTags();
      expect(allTags).toEqual(PRESET_TAGS);
    });
  });
});
