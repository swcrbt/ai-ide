import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import type { FileOperation } from '../../stores/useExplorerStore';

/**
 * 右键菜单项数据
 */
interface MenuItem {
  /** 操作类型 */
  operation: FileOperation;
  /** 显示标签 */
  label: string;
  /** 图标 */
  icon: React.ReactNode;
  /** 是否危险操作 */
  dangerous?: boolean;
}

/**
 * 右键菜单组件 Props
 */
interface ContextMenuProps {
  /** 子元素（触发区域） */
  children: React.ReactNode;
  /** 目标是否为目录 */
  isDirectory: boolean;
  /** 目标路径 */
  targetPath: string;
  /** 操作回调 */
  onAction: (operation: FileOperation, targetPath: string) => void;
}

/**
 * 文件操作右键菜单组件
 *
 * 基于 Radix UI DropdownMenu 实现，支持文件和目录的不同操作选项。
 */
export function ContextMenu({
  children,
  isDirectory,
  targetPath,
  onAction,
}: ContextMenuProps) {
  const [open, setOpen] = React.useState(false);

  /**
   * 处理右键点击事件
   */
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  /**
   * 处理菜单项点击
   */
  const handleItemClick = (operation: FileOperation) => {
    onAction(operation, targetPath);
    setOpen(false);
  };

  /**
   * 生成菜单项配置
   */
  const getMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [];

    if (isDirectory) {
      items.push(
        {
          operation: 'newFile',
          label: '新建文件',
          icon: <FilePlus size={14} />,
        },
        {
          operation: 'newFolder',
          label: '新建文件夹',
          icon: <FolderPlus size={14} />,
        }
      );
    }

    items.push(
      {
        operation: 'rename',
        label: '重命名',
        icon: <Pencil size={14} />,
      },
      {
        operation: 'delete',
        label: '删除',
        icon: <Trash2 size={14} />,
        dangerous: true,
      }
    );

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <div
          onContextMenu={handleContextMenu}
          className="flex-1"
        >
          {children}
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={4}
          align="start"
        >
          {menuItems.map((item, index) => (
            <React.Fragment key={item.operation}>
              {index > 0 && item.operation === 'delete' && (
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
              )}
              <DropdownMenu.Item
                className={`
                  flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer
                  outline-none transition-colors
                  ${
                    item.dangerous
                      ? 'text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
                      : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                  }
                `}
                onClick={() => handleItemClick(item.operation)}
              >
                {item.icon}
                <span>{item.label}</span>
              </DropdownMenu.Item>
            </React.Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
