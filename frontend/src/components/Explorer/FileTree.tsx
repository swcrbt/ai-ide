import { useEffect, useRef, useMemo } from 'react';
import { FolderTree, RefreshCw } from 'lucide-react';
import { VariableSizeList, VariableSizeList as List } from 'react-window';
import { useExplorerStore, type FileNode } from '../../stores/useExplorerStore';
import { FileTreeNodeRow } from './FileTreeNode';

/**
 * 扁平化的树节点项
 */
interface FlattenedNode {
  /** 节点数据 */
  node: FileNode;
  /** 节点深度 */
  depth: number;
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

/**
 * 文件树行组件（用于 react-window VariableSizeList）
 */
const FileTreeRow: React.FC<any> = ({ index, style, data }) => {
  const item = data[index] as FlattenedNode | undefined;
  if (!item) return null;

  return (
    <div style={style}>
      <FileTreeNodeRow node={item.node} depth={item.depth} />
    </div>
  );
};

/**
 * 文件树虚拟滚动组件
 *
 * 使用 react-window 实现虚拟滚动，只渲染可视区域的文件节点。
 * 支持动态高度（目录展开/折叠时重新计算列表）。
 * 当文件数量超过 100 时自动启用虚拟滚动，否则使用普通渲染。
 */
export function FileTree() {
  const {
    treeData,
    isLoading,
    projectName,
    expandedPaths,
    loadTree,
    refresh,
  } = useExplorerStore();

  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

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

  return (
    <div className="flex flex-col h-full w-full bg-sidebar text-sidebar-fg border-r border-sidebar-border">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <FolderTree size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium truncate">{projectName}</span>
        </div>
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

      {/* 文件树内容区域 */}
      <div ref={containerRef} className="flex-1 overflow-auto py-1">
        {isLoading ? (
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
            itemData={flattenedNodes}
            height={containerRef.current?.clientHeight || 600}
            width="100%"
            overscanCount={5}
          >
            {FileTreeRow}
          </List>
        ) : (
          // 普通渲染模式（小项目）
          treeData.map((node) => (
            <FileTreeNodeRow key={node.path} node={node} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}
