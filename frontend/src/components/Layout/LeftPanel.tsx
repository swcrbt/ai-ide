import React from 'react';

export interface LeftPanelProps {
  taskCount: number;
  gitChangeCount: number;
  activeTab: 'task' | 'git';
  onTabChange: (tab: 'task' | 'git') => void;
  children: {
    taskPanel: React.ReactNode;
    gitPanel: React.ReactNode;
  };
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  taskCount,
  gitChangeCount,
  activeTab,
  onTabChange,
  children,
}) => {
  const tabs: Array<{ key: 'task' | 'git'; label: string; count: number }> = [
    { key: 'task', label: '任务', count: taskCount },
    { key: 'git', label: 'Git', count: gitChangeCount },
  ];

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] h-full bg-background border-r border-border">
      <div className="flex items-center border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5
                text-sm font-medium transition-colors duration-150 cursor-pointer
                ${isActive
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
                }
              `}
            >
              <span>{tab.label}</span>
              <span
                className={`
                  text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'task' && children.taskPanel}
        {activeTab === 'git' && children.gitPanel}
      </div>
    </div>
  );
};
