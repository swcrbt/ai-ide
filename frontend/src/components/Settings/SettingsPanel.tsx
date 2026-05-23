import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  X,
  Save,
  RotateCcw,
  Download,
  Upload,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { AppSettings } from '../../types';
import { getAllDefaultShortcuts, getShortcutDisplay } from '../../config/shortcuts';
import { SettingCategory } from './SettingCategory';
import { SettingItem, type SettingDefinition } from './SettingItem';

/** Git 配置扩展接口 */
interface GitLocalSettings {
  defaultBranch: string;
  commitTemplate: string;
}

/** 本地存储 Git 配置的键名 */
const GIT_SETTINGS_KEY = 'ai-ide-git-settings';

/** 加载 Git 本地配置 */
function loadGitSettings(): GitLocalSettings {
  try {
    const stored = localStorage.getItem(GIT_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored) as GitLocalSettings;
    }
  } catch {
    // 忽略解析错误
  }
  return { defaultBranch: 'main', commitTemplate: '' };
}

/** 保存 Git 本地配置 */
function saveGitSettings(settings: GitLocalSettings): void {
  try {
    localStorage.setItem(GIT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 忽略保存错误
  }
}

/** 设置面板组件 Props */
interface SettingsPanelProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 设置面板主组件
 *
 * 提供完整的配置管理界面：
 * - 左侧分类导航
 * - 右侧设置项列表
 * - 实时搜索过滤
 * - 保存/重置/导入/导出功能
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, saveSettings, updateSettings, resetSettings } = useAppStore();

  // 本地状态：当前选中的分类
  const [activeCategory, setActiveCategory] = useState('general');
  // 本地状态：搜索关键词
  const [searchQuery, setSearchQuery] = useState('');
  // 本地状态：未保存的修改
  const [draftSettings, setDraftSettings] = useState<AppSettings | null>(null);
  // 本地状态：Git 配置（前端本地存储）
  const [gitSettings, setGitSettings] = useState<GitLocalSettings>(loadGitSettings);
  // 本地状态：保存成功提示
  const [saveSuccess, setSaveSuccess] = useState(false);
  // 本地状态：导入错误提示
  const [importError, setImportError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当前生效的配置（优先使用草稿）
  const currentSettings = draftSettings ?? settings;

  // 打开时聚焦搜索框并初始化草稿
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSaveSuccess(false);
      setImportError(null);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      // 关闭时丢弃草稿
      setDraftSettings(null);
    }
  }, [isOpen]);

  // 构建设置项定义列表
  const allSettingDefinitions = useMemo<SettingDefinition[]>(() => {
    const defs: SettingDefinition[] = [
      // ===== 通用 =====
      {
        id: 'general.theme',
        label: '主题',
        description: '选择应用界面主题风格',
        type: 'select',
        value: currentSettings.theme,
        options: [
          { value: 'light', label: '亮色' },
          { value: 'dark', label: '暗色' },
          { value: 'system', label: '跟随系统' },
        ],
        modified: draftSettings?.theme !== settings.theme,
      },
      {
        id: 'general.language',
        label: '语言',
        description: '选择界面显示语言',
        type: 'select',
        value: currentSettings.language,
        options: [
          { value: 'zh', label: '简体中文' },
          { value: 'en', label: 'English' },
        ],
        modified: draftSettings?.language !== settings.language,
      },
      {
        id: 'general.autoSave',
        label: '自动保存',
        description: '编辑时自动保存文件更改',
        type: 'boolean',
        value: currentSettings.autoSave,
        modified: draftSettings?.autoSave !== settings.autoSave,
      },

      // ===== 编辑器 =====
      {
        id: 'editor.fontSize',
        label: '字体大小',
        description: '编辑器字体大小（像素）',
        type: 'number',
        value: currentSettings.editor.fontSize,
        min: 8,
        max: 72,
        modified: draftSettings?.editor.fontSize !== settings.editor.fontSize,
      },
      {
        id: 'editor.fontFamily',
        label: '字体',
        description: '编辑器字体族',
        type: 'text',
        value: currentSettings.editor.fontFamily,
        modified: draftSettings?.editor.fontFamily !== settings.editor.fontFamily,
      },
      {
        id: 'editor.tabSize',
        label: 'Tab 宽度',
        description: '制表符缩进空格数',
        type: 'number',
        value: currentSettings.editor.tabSize,
        min: 1,
        max: 8,
        modified: draftSettings?.editor.tabSize !== settings.editor.tabSize,
      },
      {
        id: 'editor.wordWrap',
        label: '自动换行',
        description: '长文本自动换行显示',
        type: 'boolean',
        value: currentSettings.editor.wordWrap,
        modified: draftSettings?.editor.wordWrap !== settings.editor.wordWrap,
      },
      {
        id: 'editor.showLineNumbers',
        label: '显示行号',
        description: '在编辑器左侧显示行号',
        type: 'boolean',
        value: currentSettings.editor.showLineNumbers,
        modified: draftSettings?.editor.showLineNumbers !== settings.editor.showLineNumbers,
      },
      {
        id: 'editor.enableMinimap',
        label: '启用小地图',
        description: '在编辑器右侧显示代码缩略图',
        type: 'boolean',
        value: currentSettings.editor.enableMinimap,
        modified: draftSettings?.editor.enableMinimap !== settings.editor.enableMinimap,
      },
      {
        id: 'editor.formatOnSave',
        label: '保存时格式化',
        description: '保存文件时自动格式化代码',
        type: 'boolean',
        value: currentSettings.editor.formatOnSave,
        modified: draftSettings?.editor.formatOnSave !== settings.editor.formatOnSave,
      },
      {
        id: 'editor.lineHeight',
        label: '行高',
        description: '编辑器行高（像素）',
        type: 'number',
        value: currentSettings.editor.lineHeight,
        min: 12,
        max: 48,
        modified: draftSettings?.editor.lineHeight !== settings.editor.lineHeight,
      },
      {
        id: 'editor.cursorStyle',
        label: '光标样式',
        description: '编辑器光标显示样式',
        type: 'select',
        value: currentSettings.editor.cursorStyle,
        options: [
          { value: 'line', label: '竖线' },
          { value: 'block', label: '块' },
          { value: 'underline', label: '下划线' },
        ],
        modified: draftSettings?.editor.cursorStyle !== settings.editor.cursorStyle,
      },
      {
        id: 'editor.cursorBlinking',
        label: '光标闪烁',
        description: '编辑器光标闪烁模式',
        type: 'select',
        value: currentSettings.editor.cursorBlinking,
        options: [
          { value: 'smooth', label: '平滑' },
          { value: 'blink', label: '闪烁' },
          { value: 'phase', label: '相位' },
          { value: 'expand', label: '扩展' },
          { value: 'solid', label: '常亮' },
        ],
        modified: draftSettings?.editor.cursorBlinking !== settings.editor.cursorBlinking,
      },
      {
        id: 'editor.renderWhitespace',
        label: '显示空白字符',
        description: '编辑器中空白字符的显示方式',
        type: 'select',
        value: currentSettings.editor.renderWhitespace,
        options: [
          { value: 'none', label: '不显示' },
          { value: 'boundary', label: '边界' },
          { value: 'selection', label: '选中时' },
          { value: 'trailing', label: '尾随' },
          { value: 'all', label: '全部' },
        ],
        modified: draftSettings?.editor.renderWhitespace !== settings.editor.renderWhitespace,
      },

      // ===== 终端 =====
      {
        id: 'terminal.shell',
        label: 'Shell 路径',
        description: '终端使用的 Shell 程序路径',
        type: 'text',
        value: currentSettings.terminal.shell,
        modified: draftSettings?.terminal.shell !== settings.terminal.shell,
      },
      {
        id: 'terminal.fontSize',
        label: '字体大小',
        description: '终端字体大小（像素）',
        type: 'number',
        value: currentSettings.terminal.fontSize,
        min: 8,
        max: 72,
        modified: draftSettings?.terminal.fontSize !== settings.terminal.fontSize,
      },
      {
        id: 'terminal.fontFamily',
        label: '字体',
        description: '终端字体族',
        type: 'text',
        value: currentSettings.terminal.fontFamily,
        modified: draftSettings?.terminal.fontFamily !== settings.terminal.fontFamily,
      },
      {
        id: 'terminal.cursorStyle',
        label: '光标样式',
        description: '终端光标显示样式',
        type: 'select',
        value: currentSettings.terminal.cursorStyle,
        options: [
          { value: 'block', label: '块' },
          { value: 'line', label: '竖线' },
          { value: 'bar', label: '细线' },
        ],
        modified: draftSettings?.terminal.cursorStyle !== settings.terminal.cursorStyle,
      },
      {
        id: 'terminal.scrollback',
        label: '回滚行数',
        description: '终端保留的历史输出行数',
        type: 'number',
        value: currentSettings.terminal.scrollback,
        min: 1000,
        max: 100000,
        modified: draftSettings?.terminal.scrollback !== settings.terminal.scrollback,
      },

      // ===== Git（前端本地配置） =====
      {
        id: 'git.defaultBranch',
        label: '默认分支名',
        description: '新建仓库时的默认分支名称',
        type: 'text',
        value: gitSettings.defaultBranch,
        modified: false,
      },
      {
        id: 'git.commitTemplate',
        label: '提交模板',
        description: '提交信息默认模板',
        type: 'text',
        value: gitSettings.commitTemplate,
        modified: false,
      },

      // ===== AI =====
      {
        id: 'ai.model',
        label: '默认模型',
        description: 'AI 助手使用的默认模型',
        type: 'text',
        value: currentSettings.ai.model,
        modified: draftSettings?.ai.model !== settings.ai.model,
      },
      {
        id: 'ai.apiKey',
        label: 'API Key',
        description: 'AI 服务 API 密钥',
        type: 'password',
        value: currentSettings.ai.apiKey,
        modified: draftSettings?.ai.apiKey !== settings.ai.apiKey,
      },
      {
        id: 'ai.baseUrl',
        label: '自定义 API 地址',
        description: '自定义 AI API 基础地址（可选）',
        type: 'text',
        value: currentSettings.ai.baseUrl,
        modified: draftSettings?.ai.baseUrl !== settings.ai.baseUrl,
      },
    ];

    return defs;
  }, [currentSettings, draftSettings, settings, gitSettings]);

  // 根据分类和搜索词过滤设置项
  const filteredSettings = useMemo(() => {
    let filtered = allSettingDefinitions;

    // 按分类过滤（搜索时显示所有分类）
    if (!searchQuery.trim() && activeCategory !== 'shortcuts') {
      filtered = filtered.filter((s) => s.id.startsWith(`${activeCategory}.`));
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allSettingDefinitions, activeCategory, searchQuery]);

  // 是否有未保存的修改
  const hasModifications = useMemo(() => {
    return allSettingDefinitions.some((s) => s.modified);
  }, [allSettingDefinitions]);

  // 处理设置项值变更
  const handleSettingChange = useCallback(
    (id: string, value: string | number | boolean) => {
      setSaveSuccess(false);
      setImportError(null);

      // Git 配置单独处理
      if (id.startsWith('git.')) {
        const key = id.replace('git.', '') as keyof GitLocalSettings;
        const newGitSettings = { ...gitSettings, [key]: value };
        setGitSettings(newGitSettings);
        saveGitSettings(newGitSettings);
        return;
      }

      // 其他配置更新草稿
      setDraftSettings((prev) => {
        const base = prev ?? { ...settings };
        const newSettings = { ...base };

        switch (id) {
          case 'general.theme':
            newSettings.theme = value as 'light' | 'dark' | 'system';
            break;
          case 'general.language':
            newSettings.language = value as 'zh' | 'en';
            break;
          case 'general.autoSave':
            newSettings.autoSave = value as boolean;
            break;
          case 'editor.fontSize':
            newSettings.editor = { ...newSettings.editor, fontSize: value as number };
            break;
          case 'editor.fontFamily':
            newSettings.editor = { ...newSettings.editor, fontFamily: value as string };
            break;
          case 'editor.tabSize':
            newSettings.editor = { ...newSettings.editor, tabSize: value as number };
            break;
          case 'editor.wordWrap':
            newSettings.editor = { ...newSettings.editor, wordWrap: value as boolean };
            break;
          case 'editor.showLineNumbers':
            newSettings.editor = { ...newSettings.editor, showLineNumbers: value as boolean };
            break;
          case 'editor.enableMinimap':
            newSettings.editor = { ...newSettings.editor, enableMinimap: value as boolean };
            break;
          case 'editor.formatOnSave':
            newSettings.editor = { ...newSettings.editor, formatOnSave: value as boolean };
            break;
          case 'editor.lineHeight':
            newSettings.editor = { ...newSettings.editor, lineHeight: value as number };
            break;
          case 'editor.cursorStyle':
            newSettings.editor = { ...newSettings.editor, cursorStyle: value as string };
            break;
          case 'editor.cursorBlinking':
            newSettings.editor = { ...newSettings.editor, cursorBlinking: value as string };
            break;
          case 'editor.renderWhitespace':
            newSettings.editor = { ...newSettings.editor, renderWhitespace: value as string };
            break;
          case 'terminal.shell':
            newSettings.terminal = { ...newSettings.terminal, shell: value as string };
            break;
          case 'terminal.fontSize':
            newSettings.terminal = { ...newSettings.terminal, fontSize: value as number };
            break;
          case 'terminal.fontFamily':
            newSettings.terminal = { ...newSettings.terminal, fontFamily: value as string };
            break;
          case 'terminal.cursorStyle':
            newSettings.terminal = { ...newSettings.terminal, cursorStyle: value as string };
            break;
          case 'terminal.scrollback':
            newSettings.terminal = { ...newSettings.terminal, scrollback: value as number };
            break;
          case 'ai.model':
            newSettings.ai = { ...newSettings.ai, model: value as string };
            break;
          case 'ai.apiKey':
            newSettings.ai = { ...newSettings.ai, apiKey: value as string };
            break;
          case 'ai.baseUrl':
            newSettings.ai = { ...newSettings.ai, baseUrl: value as string };
            break;
        }

        return newSettings;
      });
    },
    [settings, gitSettings]
  );

  // 保存配置
  const handleSave = useCallback(async () => {
    if (draftSettings) {
      await saveSettings(draftSettings);
      setDraftSettings(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  }, [draftSettings, saveSettings]);

  // 重置为默认值
  const handleReset = useCallback(() => {
    if (confirm('确定要重置所有配置为默认值吗？此操作不可撤销。')) {
      resetSettings();
      setDraftSettings(null);
      setGitSettings({ defaultBranch: 'main', commitTemplate: '' });
      saveGitSettings({ defaultBranch: 'main', commitTemplate: '' });
    }
  }, [resetSettings]);

  // 导出配置
  const handleExport = useCallback(() => {
    const exportData = {
      settings: currentSettings,
      git: gitSettings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-ide-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSettings, gitSettings]);

  // 导入配置
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 处理文件导入
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);

          if (data.settings) {
            const importedSettings = data.settings as AppSettings;
            setDraftSettings(importedSettings);
            updateSettings(importedSettings);
          }

          if (data.git) {
            const importedGit = data.git as GitLocalSettings;
            setGitSettings(importedGit);
            saveGitSettings(importedGit);
          }

          setImportError(null);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
          setImportError('配置文件格式无效，请检查 JSON 格式');
        }
      };
      reader.readAsText(file);

      // 清空 input 值以允许重复导入同一文件
      e.target.value = '';
    },
    [updateSettings]
  );

  // 渲染快捷键列表
  const renderShortcuts = () => {
    const shortcuts = getAllDefaultShortcuts();
    const grouped = shortcuts.reduce(
      (acc, s) => {
        const cat = s.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(s);
        return acc;
      },
      {} as Record<string, typeof shortcuts>
    );

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-foreground mb-2 capitalize">
              {category === 'file'
                ? '文件'
                : category === 'edit'
                ? '编辑'
                : category === 'navigate'
                ? '导航'
                : category === 'view'
                ? '视图'
                : '终端'}
            </h3>
            <div className="space-y-1">
              {items.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/50"
                >
                  <span className="text-sm text-foreground">{s.description}</span>
                  <kbd className="text-xs font-mono bg-secondary px-2 py-0.5 rounded text-secondary-foreground border border-border">
                    {getShortcutDisplay(s.key)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 键盘事件处理（Escape 关闭）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-4xl h-[80vh] bg-popover rounded-lg shadow-2xl border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：标题、搜索、关闭 */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground shrink-0">设置</h2>

          {/* 搜索框 */}
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary max-w-md">
            <Search size={14} className="text-muted-foreground flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索设置项..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleImport}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              title="导入配置"
            >
              <Upload size={13} />
              导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              title="导出配置"
            >
              <Download size={13} />
              导出
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-destructive/10 hover:text-destructive text-secondary-foreground transition-colors"
              title="重置为默认值"
            >
              <RotateCcw size={13} />
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={!hasModifications}
              className={`
                flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${
                  hasModifications
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }
              `}
            >
              <Save size={13} />
              保存
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ml-1"
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 提示消息 */}
        {(saveSuccess || importError) && (
          <div
            className={`
              flex items-center gap-2 px-4 py-2 text-xs shrink-0
              ${saveSuccess ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}
            `}
          >
            {saveSuccess ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{saveSuccess ? '配置已保存' : importError}</span>
          </div>
        )}

        {/* 主体内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧分类导航 */}
          {!searchQuery.trim() && (
            <aside className="w-48 border-r border-border bg-muted/30 p-3 overflow-y-auto shrink-0">
              <SettingCategory
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </aside>
          )}

          {/* 右侧设置项列表 */}
          <main className="flex-1 overflow-y-auto p-4">
            {activeCategory === 'shortcuts' && !searchQuery.trim() ? (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-4">快捷键</h2>
                {renderShortcuts()}
              </div>
            ) : filteredSettings.length > 0 ? (
              <div className="space-y-1 max-w-2xl">
                {searchQuery.trim() && (
                  <p className="text-xs text-muted-foreground mb-3">
                    找到 {filteredSettings.length} 个匹配项
                  </p>
                )}
                {filteredSettings.map((setting) => (
                  <SettingItem
                    key={setting.id}
                    setting={setting}
                    onChange={handleSettingChange}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search size={32} className="mb-3 opacity-50" />
                <span className="text-sm">未找到匹配的设置项</span>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
