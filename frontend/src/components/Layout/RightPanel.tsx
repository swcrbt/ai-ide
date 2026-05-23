import React from 'react';
import { FolderTree, FileCode, Search, GitBranch, Settings, Minus } from 'lucide-react';

export type RightTool = 'explorer' | 'editor' | 'search' | 'git' | 'settings';

export interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTool: RightTool;
  onToolChange: (tool: RightTool) => void;
  children: {
    explorer: React.ReactNode;
    editor?: React.ReactNode;
    search?: React.ReactNode;
    git?: React.ReactNode;
    settings?: React.ReactNode;
  };
}

interface ToolItem {
  key: RightTool;
  icon: React.ReactNode;
  label: string;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  isOpen,
  onToggle,
  activeTool,
  onToolChange,
  children,
}) => {
  const tools: ToolItem[] = [
    { key: 'explorer', icon: <FolderTree className="w-5 h-5" />, label: '文件资源管理器' },
    { key: 'editor', icon: <FileCode className="w-5 h-5" />, label: '编辑器' },
    { key: 'search', icon: <Search className="w-5 h-5" />, label: '搜索' },
    { key: 'git', icon: <GitBranch className="w-5 h-5" />, label: 'Git' },
    { key: 'settings', icon: <Settings className="w-5 h-5" />, label: '设置' },
  ];

  const activeToolLabel = tools.find((t) => t.key === activeTool)?.label ?? '资源管理器';

  const handleToolClick = (toolKey: RightTool) => {
    if (!isOpen) {
      onToggle();
    }
    onToolChange(toolKey);
  };

  const renderContent = () => {
    switch (activeTool) {
      case 'explorer':
        return children.explorer;
      case 'editor':
        return children.editor ?? children.explorer;
      case 'search':
        return children.search ?? <div className="p-4 text-sm text-muted-foreground">搜索功能开发中...</div>;
      case 'git':
        return children.git ?? <div className="p-4 text-sm text-muted-foreground">Git 面板功能开发中...</div>;
      case 'settings':
        return children.settings ?? <div className="p-4 text-sm text-muted-foreground">设置功能开发中...</div>;
      default:
        return children.explorer;
    }
  };

  return (
    <div
      className={`
        flex flex-col h-full bg-background border-l border-border
        transition-all duration-200 ease-in-out
        ${isOpen ? 'w-[260px] min-w-[260px]' : 'w-[48px] min-w-[48px]'}
      `}
    >
      {isOpen ? (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-medium text-foreground select-none">
              {activeToolLabel}
            </span>
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors duration-150 cursor-pointer"
              title="折叠"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {renderContent()}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-2 gap-1">
          {tools.map((tool) => (
            <button
              key={tool.key}
              onClick={() => handleToolClick(tool.key)}
              className={`p-2.5 rounded-md transition-colors duration-150 cursor-pointer ${
                activeTool === tool.key && isOpen
                  ? 'text-foreground bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RightPanel;
