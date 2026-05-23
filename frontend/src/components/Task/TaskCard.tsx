import { Trash2 } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  branch: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tag: string;
  tagColor: string;
}

interface TaskCardProps {
  task: Task;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function TaskCard({ task, isActive, onClick, onDelete }: TaskCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative p-3 rounded-lg border cursor-pointer transition-colors group
        ${
          isActive
            ? 'border-l-2 border-l-primary bg-accent/50 border-border'
            : 'border-border hover:bg-accent hover:border-accent'
        }
      `}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="
          absolute top-2 right-2 p-1 rounded
          text-muted-foreground hover:text-destructive hover:bg-destructive/10
          opacity-0 group-hover:opacity-100 transition-opacity
        "
        title="删除任务"
      >
        <Trash2 size={14} />
      </button>

      <div className="flex items-center gap-2 pr-6">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: task.tagColor }}
        />
        <h3 className="text-sm font-medium text-foreground truncate">
          {task.title}
        </h3>
      </div>

      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-xs text-muted-foreground">🌿 {task.branch}</span>
      </div>

      <div className="mt-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${task.tagColor}20`,
            color: task.tagColor,
          }}
        >
          {task.tag}
        </span>
      </div>
    </div>
  );
}
