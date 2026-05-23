import { useState, useCallback } from 'react';
import { Eye, EyeOff, Check, RotateCcw } from 'lucide-react';

/** 设置项类型 */
export type SettingValueType = 'text' | 'number' | 'boolean' | 'select' | 'color' | 'password';

/** 选择项选项 */
export interface SelectOption {
  /** 选项值 */
  value: string;
  /** 选项显示标签 */
  label: string;
}

/** 设置项定义接口 */
export interface SettingDefinition {
  /** 设置项唯一标识 */
  id: string;
  /** 设置项显示名称 */
  label: string;
  /** 设置项描述 */
  description: string;
  /** 设置项类型 */
  type: SettingValueType;
  /** 当前值 */
  value: string | number | boolean;
  /** 选择项选项（仅 type 为 select 时使用） */
  options?: SelectOption[];
  /** 是否已修改（未保存） */
  modified?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 数值类型的最小值 */
  min?: number;
  /** 数值类型的最大值 */
  max?: number;
}

/** 设置项组件 Props */
interface SettingItemProps {
  /** 设置项定义 */
  setting: SettingDefinition;
  /** 值变更回调 */
  onChange: (id: string, value: string | number | boolean) => void;
}

/**
 * 单个设置项组件
 *
 * 根据设置项类型渲染不同的输入控件：
 * - text: 文本输入框
 * - number: 数字输入框
 * - boolean: 开关切换
 * - select: 下拉选择
 * - color: 颜色选择器
 * - password: 密码输入框（可显示/隐藏）
 */
export function SettingItem({ setting, onChange }: SettingItemProps) {
  const [showPassword, setShowPassword] = useState(false);

  // 处理值变更
  const handleChange = useCallback(
    (newValue: string | number | boolean) => {
      if (!setting.readOnly) {
        onChange(setting.id, newValue);
      }
    },
    [setting.id, setting.readOnly, onChange]
  );

  // 渲染输入控件
  const renderInput = () => {
    switch (setting.type) {
      case 'boolean':
        return (
          <button
            onClick={() => handleChange(!(setting.value as boolean))}
            disabled={setting.readOnly}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
              ${setting.value ? 'bg-primary' : 'bg-muted'}
              ${setting.readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                ${setting.value ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        );

      case 'select':
        return (
          <select
            value={String(setting.value)}
            onChange={(e) => handleChange(e.target.value)}
            disabled={setting.readOnly}
            className="
              px-3 py-1.5 rounded-md border border-border bg-background
              text-sm text-foreground
              focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              min-w-[160px]
            "
          >
            {setting.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            value={setting.value as number}
            onChange={(e) => handleChange(Number(e.target.value))}
            min={setting.min}
            max={setting.max}
            disabled={setting.readOnly}
            className="
              px-3 py-1.5 rounded-md border border-border bg-background
              text-sm text-foreground w-24
              focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
        );

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(setting.value)}
              onChange={(e) => handleChange(e.target.value)}
              disabled={setting.readOnly}
              className="
                w-8 h-8 rounded-md border border-border cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            <span className="text-sm text-muted-foreground font-mono">
              {String(setting.value)}
            </span>
          </div>
        );

      case 'password':
        return (
          <div className="relative flex items-center">
            <input
              type={showPassword ? 'text' : 'password'}
              value={String(setting.value)}
              onChange={(e) => handleChange(e.target.value)}
              disabled={setting.readOnly}
              placeholder="请输入..."
              className="
                px-3 py-1.5 pr-10 rounded-md border border-border bg-background
                text-sm text-foreground w-64
                focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={String(setting.value)}
            onChange={(e) => handleChange(e.target.value)}
            disabled={setting.readOnly}
            placeholder="请输入..."
            className="
              px-3 py-1.5 rounded-md border border-border bg-background
              text-sm text-foreground w-64
              focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
        );
    }
  };

  return (
    <div
      className={`
        flex items-start justify-between gap-4 px-4 py-3 rounded-lg
        ${setting.modified ? 'bg-warning/5 border border-warning/20' : 'border border-transparent'}
        ${!setting.readOnly ? 'hover:bg-accent/30' : ''}
        transition-colors duration-150
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {setting.label}
          </span>
          {setting.modified && (
            <span className="text-xs text-warning font-medium">未保存</span>
          )}
          {setting.readOnly && (
            <span className="text-xs text-muted-foreground">只读</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {setting.description}
        </p>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        {renderInput()}
      </div>
    </div>
  );
}
