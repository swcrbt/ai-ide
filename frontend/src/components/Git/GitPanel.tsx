import { useState, useCallback, useEffect } from 'react';
import { useGitStore } from '../../stores/useGitStore';
import type { GitFileStatus } from '../../types/wails';
import {
  GitBranch,
  GitCommit,
  Check,
  FileText,
  FilePlus,
  FileMinus,
  FileQuestion,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';

type DiffLineType = 'add' | 'del' | 'context' | 'header';

interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLine?: number;
  newLine?: number;
}

function parseDiff(content: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const rawLines = content.split('\n');

  for (const line of rawLines) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      lines.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      lines.push({ type: 'add', content: line });
    } else if (line.startsWith('-')) {
      lines.push({ type: 'del', content: line });
    } else {
      lines.push({ type: 'context', content: line });
    }
  }

  return lines;
}

function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'M':
      return <FileText size={14} className="text-warning" />;
    case 'A':
      return <FilePlus size={14} className="text-success" />;
    case 'D':
      return <FileMinus size={14} className="text-destructive" />;
    case '?':
      return <FileQuestion size={14} className="text-muted-foreground" />;
    default:
      return <FileText size={14} className="text-muted-foreground" />;
  }
}

function FileListItem({
  file,
  isStaged,
  onToggle,
  onViewDiff,
  isSelected,
}: {
  file: { path: string; indexStatus: string; worktreeStatus: string };
  isStaged: boolean;
  onToggle: (path: string) => void;
  onViewDiff: (path: string) => void;
  isSelected: boolean;
}) {
  const statusChar = isStaged ? file.indexStatus : file.worktreeStatus;

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded ${
        isSelected ? 'bg-accent' : ''
      }`}
      onClick={() => onViewDiff(file.path)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(file.path);
        }}
        className={`p-0.5 rounded hover:bg-secondary ${
          isStaged ? 'text-success' : 'text-warning'
        }`}
        title={isStaged ? '取消暂存' : '暂存'}
      >
        {isStaged ? <Check size={12} /> : <ChevronRight size={12} />}
      </button>
      <FileStatusIcon status={statusChar} />
      <span className="flex-1 truncate text-foreground">{file.path}</span>
      <span className="text-xs text-muted-foreground">{statusChar}</span>
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 w-full px-2 py-1 text-sm font-medium text-foreground hover:bg-accent rounded"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </button>
      {isOpen && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function GitPanel() {
  const {
    status,
    summary,
    isLoading,
    isCommitting,
    commitMessage,
    diffContent,
    selectedFile,
    stageFiles,
    unstageFiles,
    commit,
    loadStatus,
    loadDiff,
    setCommitMessage,
    setSelectedFile,
  } = useGitStore();

  const [showDiff, setShowDiff] = useState(false);
  const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes');

  const handleRefresh = useCallback(() => {
    loadStatus();
  }, [loadStatus]);

  const handleToggleStage = useCallback(
    (path: string) => {
      const isStaged = status?.staged?.some((f: { path: string }) => f.path === path);
      if (isStaged) {
        unstageFiles([path]);
      } else {
        stageFiles([path]);
      }
    },
    [status, stageFiles, unstageFiles]
  );

  const handleViewDiff = useCallback(
    (path: string) => {
      const isStaged = status?.staged?.some((f: { path: string }) => f.path === path);
      loadDiff(path, isStaged || false);
      setSelectedFile(path);
      setShowDiff(true);
    },
    [status, loadDiff, setSelectedFile]
  );

  const handleCommit = useCallback(() => {
    if (commitMessage.trim()) {
      commit();
    }
  }, [commitMessage, commit]);

  const diffLines = parseDiff(diffContent);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  if (!status && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-muted-foreground">
        <GitBranch size={32} className="mb-2 opacity-50" />
        <p className="text-sm">未检测到 Git 仓库</p>
        <p className="text-xs mt-1">打开一个 Git 项目以查看状态</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-background">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('changes')}
          className={`flex-1 py-1.5 text-xs font-medium ${
            activeTab === 'changes'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          变更
          {summary && summary.totalChanges > 0 && (
            <span className="ml-1 px-1 py-0.5 text-xs bg-primary/10 rounded">
              {summary.totalChanges}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 text-xs font-medium ${
            activeTab === 'history'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          历史
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'changes' ? (
          <div className="p-2">
            {status && (
              <>
                {status.staged.length > 0 && (
                  <CollapsibleSection title="已暂存" count={status.staged.length}>
                    {status.staged.map((file: GitFileStatus) => (
                      <FileListItem
                        key={`staged-${file.path}`}
                        file={file}
                        isStaged={true}
                        onToggle={handleToggleStage}
                        onViewDiff={handleViewDiff}
                        isSelected={selectedFile === file.path}
                      />
                    ))}
                  </CollapsibleSection>
                )}

                {status.modified.length > 0 && (
                  <CollapsibleSection title="已修改" count={status.modified.length}>
                    {status.modified.map((file: GitFileStatus) => (
                      <FileListItem
                        key={`modified-${file.path}`}
                        file={file}
                        isStaged={false}
                        onToggle={handleToggleStage}
                        onViewDiff={handleViewDiff}
                        isSelected={selectedFile === file.path}
                      />
                    ))}
                  </CollapsibleSection>
                )}

                {status.untracked.length > 0 && (
                  <CollapsibleSection title="未追踪" count={status.untracked.length}>
                    {status.untracked.map((file: GitFileStatus) => (
                      <FileListItem
                        key={`untracked-${file.path}`}
                        file={file}
                        isStaged={false}
                        onToggle={handleToggleStage}
                        onViewDiff={handleViewDiff}
                        isSelected={selectedFile === file.path}
                      />
                    ))}
                  </CollapsibleSection>
                )}

                {status.deleted.length > 0 && (
                  <CollapsibleSection title="已删除" count={status.deleted.length}>
                    {status.deleted.map((file: GitFileStatus) => (
                      <FileListItem
                        key={`deleted-${file.path}`}
                        file={file}
                        isStaged={false}
                        onToggle={handleToggleStage}
                        onViewDiff={handleViewDiff}
                        isSelected={selectedFile === file.path}
                      />
                    ))}
                  </CollapsibleSection>
                )}

                {status.isClean && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Check size={16} className="mr-2" />
                    <span className="text-sm">工作区干净，没有变更</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="p-2">
            <p className="text-sm text-muted-foreground text-center py-8">
              提交历史功能即将上线
            </p>
          </div>
        )}
      </div>

      {activeTab === 'changes' && status && !status.isClean && (
        <div className="border-t border-border p-2 space-y-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="输入提交信息..."
            className="w-full px-2 py-1.5 text-sm bg-secondary rounded resize-none border border-border focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground"
            rows={2}
          />
          <button
            onClick={handleCommit}
            disabled={isCommitting || !commitMessage.trim() || status.staged.length === 0}
            className="w-full py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCommitting ? '提交中...' : '提交'}
          </button>
        </div>
      )}

      {showDiff && selectedFile && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-primary" />
              <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {selectedFile}
              </span>
            </div>
            <button
              onClick={() => {
                setShowDiff(false);
                setSelectedFile(null);
              }}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 font-mono text-xs">
            {diffContent ? (
              <div className="space-y-0">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={`px-2 py-0.5 whitespace-pre ${
                      line.type === 'add'
                        ? 'bg-success/10 text-success'
                        : line.type === 'del'
                        ? 'bg-destructive/10 text-destructive'
                        : line.type === 'header'
                        ? 'text-info bg-info/5'
                        : 'text-foreground'
                    }`}
                  >
                    {line.content}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">没有可显示的 Diff</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
