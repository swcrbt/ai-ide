import {
  Settings,
  FileCode,
  Terminal,
  GitBranch,
  Bot,
  Keyboard,
  type LucideIcon,
} from 'lucide-react';

/** 设置分类接口 */
export interface SettingCategoryItem {
  /** 分类唯一标识 */
  id: string;
  /** 分类显示名称 */
  name: string;
  /** 分类图标组件 */
  icon: LucideIcon;
}

/** 所有可用的设置分类 */
export const SETTING_CATEGORIES: SettingCategoryItem[] = [
  { id: 'general', name: '通用', icon: Settings },
  { id: 'editor', name: '编辑器', icon: FileCode },
  { id: 'terminal', name: '终端', icon: Terminal },
  { id: 'git', name: 'Git', icon: GitBranch },
  { id: 'ai', name: 'AI', icon: Bot },
  { id: 'shortcuts', name: '快捷键', icon: Keyboard },
];

/** 分类导航组件 Props */
interface SettingCategoryProps {
  /** 当前选中的分类 ID */
  activeCategory: string;
  /** 分类切换回调 */
  onCategoryChange: (categoryId: string) => void;
}

/**
 * 设置分类导航组件
 *
 * 显示左侧分类列表，支持点击切换和高亮当前选中项。
 */
export function SettingCategory({
  activeCategory,
  onCategoryChange,
}: SettingCategoryProps) {
  return (
    <nav className="w-full">
      <ul className="space-y-0.5">
        {SETTING_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isActive = category.id === activeCategory;

          return (
            <li key={category.id}>
              <button
                onClick={() => onCategoryChange(category.id)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-md
                  text-sm font-medium transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                `}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span>{category.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
