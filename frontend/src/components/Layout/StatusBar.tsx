import React from 'react';
import { GitBranch, ListTodo, Bot } from 'lucide-react';

export interface StatusBarProps {
  branch: string;
  taskCompleted: number;
  taskTotal: number;
  aiStatus: '就绪' | '思考中...' | '执行中...';
  cursorPosition?: { line: number; column: number };
  encoding?: string;
  lineEnding?: string;
  language?: string;
}

const Separator: React.FC = () => (
  <span className="text-muted-foreground/40 mx-1.5 select-none">|</span>
);

export const StatusBar: React.FC<StatusBarProps> = ({
  branch,
  taskCompleted,
  taskTotal,
  aiStatus,
  cursorPosition,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  language,
}) => {
  const isAiActive = aiStatus === '思考中...' || aiStatus === '执行中...';

  return (
    <div className="flex items-center h-6 bg-background border-t border-border px-3 text-xs text-muted-foreground select-none">
      <div className="flex items-center flex-1">
        <div className="flex items-center gap-1">
          <GitBranch size={12} className="text-muted-foreground" />
          <span>{branch}</span>
        </div>

        <Separator />

        <div className="flex items-center gap-1">
          <ListTodo size={12} className="text-muted-foreground" />
          <span>
            {taskCompleted}/{taskTotal}
          </span>
        </div>

        <Separator />

        <div className="flex items-center gap-1">
          <Bot size={12} className={isAiActive ? 'text-primary' : 'text-muted-foreground'} />
          <span className={isAiActive ? 'text-primary animate-pulse' : ''}>
            {aiStatus}
          </span>
        </div>

        {cursorPosition && (
          <>
            <Separator />
            <span>
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
          </>
        )}

        <Separator />

        <span>{encoding}</span>

        <Separator />

        <span>{lineEnding}</span>
      </div>

      {language && (
        <div className="flex items-center">
          <span>{language}</span>
        </div>
      )}
    </div>
  );
};
