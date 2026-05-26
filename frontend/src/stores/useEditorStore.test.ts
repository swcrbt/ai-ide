import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './useEditorStore';

describe('useEditorStore', () => {
  beforeEach(() => {
    // 重置store状态
    const store = useEditorStore.getState();
    useEditorStore.setState({
      tabs: [],
      activeTab: null,
      diff: {
        isOpen: false,
        original: '',
        modified: '',
        language: 'typescript',
        inlineMode: false,
      },
    });
  });

  describe('标签页管理', () => {
    it('应能打开文件', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'const x = 1;', 'typescript');

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].path).toBe('/test/file.ts');
      expect(state.tabs[0].content).toBe('const x = 1;');
      expect(state.tabs[0].language).toBe('typescript');
      expect(state.tabs[0].isDirty).toBe(false);
      expect(state.activeTab).toBe('/test/file.ts');
    });

    it('打开已存在的文件应切换到该标签页', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file1.ts', 'content1');
      store.openFile('/test/file2.ts', 'content2');
      store.openFile('/test/file1.ts', 'new content');

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTab).toBe('/test/file1.ts');
      // 重新打开同一文件时，如果提供了新内容，应刷新
      expect(state.tabs[0].content).toBe('new content');
    });

    it('应能从文件路径推断语言类型', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', '');
      expect(useEditorStore.getState().tabs[0].language).toBe('typescript');

      store.openFile('/test/file.js', '');
      expect(useEditorStore.getState().tabs[1].language).toBe('javascript');

      store.openFile('/test/file.py', '');
      expect(useEditorStore.getState().tabs[2].language).toBe('python');

      store.openFile('/test/file.go', '');
      expect(useEditorStore.getState().tabs[3].language).toBe('go');

      store.openFile('/test/file.unknown', '');
      expect(useEditorStore.getState().tabs[4].language).toBe('plaintext');
    });

    it('应能关闭文件', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file1.ts', 'content1');
      store.openFile('/test/file2.ts', 'content2');
      store.closeFile('/test/file1.ts');

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].path).toBe('/test/file2.ts');
      expect(state.activeTab).toBe('/test/file2.ts');
    });

    it('关闭非激活标签页不应改变激活标签页', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file1.ts', 'content1');
      store.openFile('/test/file2.ts', 'content2');
      store.closeFile('/test/file2.ts');

      const state = useEditorStore.getState();
      expect(state.activeTab).toBe('/test/file1.ts');
    });

    it('关闭最后一个标签页应将activeTab设为null', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'content');
      store.closeFile('/test/file.ts');

      const state = useEditorStore.getState();
      expect(state.tabs).toHaveLength(0);
      expect(state.activeTab).toBeNull();
    });

    it('应能切换标签页', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file1.ts', 'content1');
      store.openFile('/test/file2.ts', 'content2');
      store.switchTab('/test/file1.ts');

      expect(useEditorStore.getState().activeTab).toBe('/test/file1.ts');
    });

    it('切换不存在的标签页应正常设置', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'content');
      store.switchTab('/nonexistent');

      expect(useEditorStore.getState().activeTab).toBe('/nonexistent');
    });
  });

  describe('内容更新', () => {
    it('应能更新文件内容', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'const x = 1;');
      store.updateContent('/test/file.ts', 'const x = 2;');

      const state = useEditorStore.getState();
      expect(state.tabs[0].content).toBe('const x = 2;');
      expect(state.tabs[0].isDirty).toBe(true);
    });

    it('更新不存在标签页的内容不应报错', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'content');
      store.updateContent('/nonexistent', 'new content');

      const state = useEditorStore.getState();
      expect(state.tabs[0].content).toBe('content');
    });

    it('应能标记文件为未保存', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'content');
      store.markDirty('/test/file.ts');

      expect(useEditorStore.getState().tabs[0].isDirty).toBe(true);
    });

    it('应能标记文件为已保存', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/file.ts', 'content');
      store.updateContent('/test/file.ts', 'new content');
      store.markClean('/test/file.ts');

      expect(useEditorStore.getState().tabs[0].isDirty).toBe(false);
    });
  });

  describe('Diff编辑器', () => {
    it('应能打开Diff编辑器', () => {
      const store = useEditorStore.getState();

      store.openDiff('original', 'modified', 'typescript');

      const state = useEditorStore.getState();
      expect(state.diff.isOpen).toBe(true);
      expect(state.diff.original).toBe('original');
      expect(state.diff.modified).toBe('modified');
      expect(state.diff.language).toBe('typescript');
      expect(state.diff.inlineMode).toBe(false);
    });

    it('打开Diff时默认语言应为typescript', () => {
      const store = useEditorStore.getState();

      store.openDiff('original', 'modified');

      expect(useEditorStore.getState().diff.language).toBe('typescript');
    });

    it('应能关闭Diff编辑器', () => {
      const store = useEditorStore.getState();

      store.openDiff('original', 'modified');
      store.closeDiff();

      const state = useEditorStore.getState();
      expect(state.diff.isOpen).toBe(false);
      expect(state.diff.original).toBe('');
      expect(state.diff.modified).toBe('');
    });

    it('应能切换Diff内联模式', () => {
      const store = useEditorStore.getState();

      store.openDiff('original', 'modified');
      store.toggleDiffInlineMode();

      expect(useEditorStore.getState().diff.inlineMode).toBe(true);

      store.toggleDiffInlineMode();

      expect(useEditorStore.getState().diff.inlineMode).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应能处理大文件size', () => {
      const store = useEditorStore.getState();

      store.openFile('/test/large.ts', 'content', 'typescript', 1024 * 1024 * 100); // 100MB

      const state = useEditorStore.getState();
      expect(state.tabs[0].size).toBe(1024 * 1024 * 100);
    });

    it('空路径应正常工作', () => {
      const store = useEditorStore.getState();

      store.openFile('', 'content');

      const state = useEditorStore.getState();
      expect(state.tabs[0].path).toBe('');
      expect(state.activeTab).toBe('');
    });
  });
});
