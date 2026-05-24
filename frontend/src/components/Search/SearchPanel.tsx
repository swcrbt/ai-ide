import { useState, useMemo, useCallback } from 'react';
import { Search, File, Folder, X } from 'lucide-react';
import { useExplorerStore } from '../../stores/useExplorerStore';

interface SearchPanelProps {
  onFileClick: (path: string) => void;
}

/**
 * 搜索面板组件
 *
 * 支持按文件名搜索当前项目中的文件。
 */
export function SearchPanel({ onFileClick }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const { treeData } = useExplorerStore();

  // 递归收集所有文件节点
  const allFiles = useMemo(() => {
    const files: Array<{ name: string; path: string; isDir: boolean }> = [];
    
    function collectFiles(nodes: typeof treeData) {
      for (const node of nodes) {
        files.push({ name: node.name, path: node.path, isDir: node.isDir });
        if (node.isDir && node.children) {
          collectFiles(node.children);
        }
      }
    }
    
    collectFiles(treeData);
    return files;
  }, [treeData]);

  // 根据搜索词过滤
  const filteredFiles = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return allFiles.filter((file) =>
      file.name.toLowerCase().includes(lowerQuery)
    );
  }, [allFiles, query]);

  const handleFileClick = useCallback((path: string) => {
    onFileClick(path);
  }, [onFileClick]);

  return (
    <div className="flex flex-col h-full">
      {/* 搜索输入框 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={16} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文件..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-0.5 rounded hover:bg-accent transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 搜索结果 */}
      <div className="flex-1 overflow-auto py-1">
        {query.trim() && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground px-4 text-center">
            <Search size={24} className="mb-2 opacity-50" />
            <p>未找到匹配的文件</p>
          </div>
        ) : (
          filteredFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => handleFileClick(file.path)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm w-full text-left hover:bg-accent/50 transition-colors"
            >
              {file.isDir ? (
                <Folder size={14} className="text-warning flex-shrink-0" />
              ) : (
                <File size={14} className="text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
