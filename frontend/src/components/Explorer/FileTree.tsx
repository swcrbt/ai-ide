import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { FolderTree, RefreshCw, Plus, ChevronDown, Trash2 } from 'lucide-react';
import { VariableSizeList, VariableSizeList as List } from 'react-window';
import { useExplorerStore, type FileNode } from '../../stores/useExplorerStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { AddProjectDialog } from '../Project/AddProjectDialog';
import { FileTreeNodeRow } from './FileTreeNode';

interface FileTreeProps {
  onFileClick: (path: string) => void;
}

interface FlattenedNode {
  node: FileNode;
  depth: number;
}

interface FileTreeRowData {
  nodes: FlattenedNode[];
  onFileClick: (path: string) => void;
}

/**
 * 将树形结构扁平化为可见节点列表
 * 只包含当前展开状态下的可见节点
 */
function flattenTree(nodes: FileNode[], expandedPaths: Set<string>, depth = 0): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  for (const node of nodes) {
    result.push({ node, depth });

    if (node.isDir && expandedPaths.has(node.path) && node.children) {
      result.push(...flattenTree(node.children, expandedPaths, depth + 1));
    }
  }

  return result;
}

const FileTreeRow: React.FC<any> = ({ index, style, data }) => {
  const rowData = data as FileTreeRowData;
  const item = rowData.nodes[index] as FlattenedNode | undefined;
  if (!item) return null;

  return (
    <div style={style}>
      <FileTreeNodeRow node={item.node} depth={item.depth} onFileClick={rowData.onFileClick} />
    </div>
  );
};

export function FileTree({ onFileClick }: FileTreeProps) {
  const {
    treeData,
    isLoading,
    projectName,
    expandedPaths,
    loadTree,
    refresh,
  } = useExplorerStore();

  const {
    projects,
    currentProject,
    loadProjects,
    switchProject,
    removeProject,
    setAddDialogOpen,
  } = useProjectStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const flattenedNodes = useMemo(() => {
    return flattenTree(treeData, expandedPaths);
  }, [treeData, expandedPaths]);

  const nodeCount = flattenedNodes.length;
  const enableVirtualization = nodeCount > 100;
  const ITEM_HEIGHT = 32;

  // 展开/折叠后重置列表
  useEffect(() => {
    if (listRef.current && enableVirtualization) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedPaths, enableVirtualization]);

  const handleSwitchProject = useCallback(async (id: number) => {
    await switchProject(id);
    setIsDropdownOpen(false);
  }, [switchProject]);

  const handleRemoveProject = useCallback(async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('确定要删除此项目吗？')) {
      await removeProject(id);
    }
  }, [removeProject]);

  const handleOpenAddDialog = useCallback(() => {
    setAddDialogOpen(true);
    setIsDropdownOpen(false);
  }, [setAddDialogOpen]);

  const hasProject = currentProject !== null;

  return (
    <div className="flex flex-col h-full w-full bg-sidebar text-sidebar-fg">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        {/* 项目选择器 */}
        <div className="flex items-center gap-2 flex-1 min-w-0" ref={dropdownRef}>
          <FolderTree size={16} className="text-muted-foreground flex-shrink-0" />
          
          {/* 下拉框触发器 */}
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 flex-1 min-w-0 text-left hover:bg-accent/50 rounded px-1.5 py-0.5 transition-colors"
          >
            <span className="text-sm font-medium truncate">
              {currentProject?.name || '选择项目'}
            </span>
            <ChevronDown
              size={14}
              className={`text-muted-foreground flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* 下拉菜单 */}
          {isDropdownOpen && (
            <div className="absolute top-10 left-2 right-2 bg-popover border border-border rounded-md shadow-lg z-50 max-h-64 overflow-auto">
              {/* 项目列表 */}
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  暂无项目
                </div>
              ) : (
                <div className="py-1">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleSwitchProject(project.id)}
                      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors group ${
                        currentProject?.id === project.id ? 'bg-accent/30' : ''
                      }`}
                    >
                      <span className="truncate flex-1">{project.name}</span>
                      <button
                        onClick={(e) => handleRemoveProject(project.id, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                        title="删除项目"
                      >
                        <Trash2 size={12} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 分隔线 */}
              <div className="border-t border-border my-1" />
              
              {/* 添加项目选项 */}
              <button
                onClick={handleOpenAddDialog}
                className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-accent/50 transition-colors"
              >
                <Plus size={14} />
                <span>添加项目</span>
              </button>
            </div>
          )}
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-1">
          {/* + 按钮 */}
          <button
            onClick={handleOpenAddDialog}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title="添加项目"
          >
            <Plus size={14} className="text-muted-foreground" />
          </button>
          
          {/* 刷新按钮 */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1 rounded hover:bg-accent/50 transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw
              size={14}
              className={`text-muted-foreground ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* 文件树内容区域 */}
      <div ref={containerRef} className="flex-1 overflow-auto py-1">
        {!hasProject ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center">
            <FolderTree size={24} className="mb-2 opacity-50" />
            <p>请添加一个项目</p>
            <button
              onClick={handleOpenAddDialog}
              className="mt-2 text-xs text-primary hover:underline"
            >
              点击添加项目
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center">
            <FolderTree size={24} className="mb-2 opacity-50" />
            <p>暂无文件</p>
            <p className="text-xs mt-1 opacity-70">项目目录为空或加载失败</p>
          </div>
        ) : enableVirtualization ? (
          // 虚拟滚动模式（大项目）
          <List
            ref={listRef}
            itemCount={nodeCount}
            itemSize={() => ITEM_HEIGHT}
            itemData={{ nodes: flattenedNodes, onFileClick }}
            height={containerRef.current?.clientHeight || 600}
            width="100%"
            overscanCount={5}
          >
            {FileTreeRow}
          </List>
        ) : (
          // 普通渲染模式（小项目）
          treeData.map((node) => (
            <FileTreeNodeRow key={node.path} node={node} depth={0} onFileClick={onFileClick} />
          ))
        )}
      </div>

      {/* 添加项目对话框 */}
      <AddProjectDialog />
    </div>
  );
}
