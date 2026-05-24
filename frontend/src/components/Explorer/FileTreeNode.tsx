import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
} from 'lucide-react';
import { ContextMenu } from './ContextMenu';
import { useExplorerStore } from '../../stores/useExplorerStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useGitStore } from '../../stores/useGitStore';
import type { FileNode, FileOperation } from '../../stores/useExplorerStore';

interface FileTreeNodeProps {
  node: FileNode;
  depth?: number;
  onFileClick?: (path: string) => void;
}

const gitStatusConfig: Record<string, { color: string; label: string }> = {
  modified: { color: 'bg-warning', label: '已修改' },
  added: { color: 'bg-success', label: '已添加' },
  deleted: { color: 'bg-destructive', label: '已删除' },
  untracked: { color: 'bg-muted-foreground', label: '未跟踪' },
  ignored: { color: 'bg-muted-foreground/60', label: '已忽略' },
};

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode size={16} className="text-info" />;
    case 'json':
      return <FileJson size={16} className="text-warning" />;
    case 'md':
    case 'txt':
      return <FileText size={16} className="text-muted-foreground" />;
    default:
      return <FileType size={16} className="text-muted-foreground" />;
  }
}

/**
 * 文件树节点行组件（用于虚拟滚动）
 *
 * 渲染单个文件或目录节点，支持点击展开/折叠、打开文件等操作。
 * 通过 depth 参数控制缩进层级。
 */
export function FileTreeNodeRow({ node, depth = 0, onFileClick }: FileTreeNodeProps) {
  const { expandedPaths, selectedPath, toggleNode, selectNode, performOperation } =
    useExplorerStore();
  const { openFile } = useEditorStore();
  const { getFileStatus } = useGitStore();

  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    selectNode(node.path);
    if (node.isDir) {
      toggleNode(node.path);
    } else if (onFileClick) {
      onFileClick(node.path);
    } else {
      openFile(node.path, '');
    }
  };

  const handleContextMenuAction = (operation: FileOperation, targetPath: string) => {
    performOperation(operation, targetPath);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNode(node.path);
  };

  // 从 GitStore 获取文件状态
  const gitStatusLetter = getFileStatus(node.path);
  const gitStatus = gitStatusLetter ? statusLetterToStatus(gitStatusLetter) : null;
  const gitConfig = gitStatus ? gitStatusConfig[gitStatus] : null;

  const nodeContent = (
    <div
      className={`
        flex items-center gap-1 px-2 py-1 text-sm cursor-pointer select-none
        transition-colors duration-150
        ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
      `}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={handleClick}
    >
      {node.isDir ? (
        <button
          onClick={handleToggleClick}
          className="flex-shrink-0 p-0.5 rounded hover:bg-accent-foreground/10 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
        </button>
      ) : (
        <span className="w-[22px] flex-shrink-0" />
      )}

      <span className="flex-shrink-0">
        {node.isDir ? (
          isExpanded ? (
            <FolderOpen size={16} className="text-warning" />
          ) : (
            <Folder size={16} className="text-warning" />
          )
        ) : (
          getFileIcon(node.name)
        )}
      </span>

      <span className="flex-1 truncate min-w-0">{node.name}</span>

      {gitConfig && (
        <span
          className={`flex-shrink-0 w-2 h-2 rounded-full ${gitConfig.color}`}
          title={gitConfig.label}
        />
      )}
    </div>
  );

  return (
    <div>
      <ContextMenu
        isDirectory={node.isDir}
        targetPath={node.path}
        onAction={handleContextMenuAction}
      >
        {nodeContent}
      </ContextMenu>
    </div>
  );
}

// 状态字母转换为状态字符串
function statusLetterToStatus(letter: string): string | null {
  switch (letter) {
    case 'M': return 'modified';
    case 'A': return 'added';
    case 'D': return 'deleted';
    case '?': return 'untracked';
    case 'R': return 'renamed';
    case 'U': return 'conflicted';
    default: return null;
  }
}

/**
 * 文件树节点组件（兼容旧版递归渲染）
 *
 * 保留递归渲染能力，用于小项目或不需要虚拟滚动的场景。
 */
export function FileTreeNode({ node, depth = 0, onFileClick }: FileTreeNodeProps) {
  const { expandedPaths } = useExplorerStore();
  const isExpanded = expandedPaths.has(node.path);

  return (
    <div>
      <FileTreeNodeRow node={node} depth={depth} onFileClick={onFileClick} />
      {node.isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
}
