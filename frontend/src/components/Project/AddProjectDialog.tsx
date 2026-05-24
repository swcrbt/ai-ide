import * as React from 'react';
import { FolderOpen, AlertTriangle, X } from 'lucide-react';
import { useProjectStore } from '../../stores/useProjectStore';

/**
 * 添加项目对话框组件
 *
 * 提供文件选择、Git 初始化确认等功能。
 */
export function AddProjectDialog() {
  const { isAddDialogOpen, setAddDialogOpen, addProject, initGitAndAdd } = useProjectStore();
  const [selectedPath, setSelectedPath] = React.useState('');
  const [needsInit, setNeedsInit] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showInitConfirm, setShowInitConfirm] = React.useState(false);

  const handleOpenDialog = async () => {
    setError('');
    try {
      // 使用 Wails 运行时打开目录对话框
      const { OpenDirectoryDialog } = await import('../../types/wails');
      const path = await OpenDirectoryDialog({
        Title: '选择项目目录',
        CanCreateDirectories: false,
      });
      if (path) {
        setSelectedPath(path);
        setNeedsInit(false);
        setShowInitConfirm(false);
      }
    } catch (err) {
      setError('打开文件选择器失败');
    }
  };

  const handleAddProject = async () => {
    if (!selectedPath) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await addProject(selectedPath);

      if (result.needsInit) {
        setNeedsInit(true);
        setShowInitConfirm(true);
        setIsLoading(false);
        return;
      }

      // 添加成功，关闭对话框
      handleClose();
    } catch (err: any) {
      setError(err.message || '添加项目失败');
      setIsLoading(false);
    }
  };

  const handleInitGit = async () => {
    if (!selectedPath) return;

    setIsLoading(true);
    setError('');

    try {
      await initGitAndAdd(selectedPath);
      handleClose();
    } catch (err: any) {
      setError(err.message || '初始化 Git 失败');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedPath('');
    setNeedsInit(false);
    setShowInitConfirm(false);
    setError('');
    setIsLoading(false);
    setAddDialogOpen(false);
  };

  if (!isAddDialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-[480px] max-w-[90vw]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">添加项目</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-4 py-4 space-y-4">
          {/* 路径选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">项目目录</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedPath}
                readOnly
                placeholder="点击右侧按钮选择目录"
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted/50"
              />
              <button
                onClick={handleOpenDialog}
                disabled={isLoading}
                className="px-3 py-2 border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                aria-label="选择目录"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>

          {/* Git 初始化确认 */}
          {showInitConfirm && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm">
                    该项目未初始化 Git 仓库。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    是否自动初始化 Git？
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowInitConfirm(false)}
                      className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleInitGit}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? '初始化中...' : '确认初始化'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleAddProject}
            disabled={!selectedPath || isLoading || showInitConfirm}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? '添加中...' : '添加项目'}
          </button>
        </div>
      </div>
    </div>
  );
}
