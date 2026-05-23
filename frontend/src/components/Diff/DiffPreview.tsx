import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Check,
  RotateCcw,
  FileCode,
  ChevronRight,
  ChevronDown,
  FileDiff,
  AlertTriangle,
  Undo2,
} from 'lucide-react';
import { useDiffStore, isDangerousOperation, type FileChange } from '../../stores/useDiffStore';
import { DiffBlock } from './DiffBlock';
import { PermissionDialog } from './PermissionDialog';

/**
 * 文件列表项组件
 */
function FileListItem({
  change,
  index,
  isSelected,
  onSelect,
  stats,
}: {
  change: FileChange;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  stats: { additions: number; deletions: number };
}) {
  const isDangerous = isDangerousOperation(change);

  return (
    <button
      onClick={() => onSelect(index)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
        isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-accent border-l-2 border-l-transparent'
      }`}
    >
      <FileCode size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="flex-1 text-xs text-foreground truncate">{change.file}</span>
      {isDangerous && <AlertTriangle size={12} className="text-warning flex-shrink-0" />}
      <div className="flex items-center gap-1 flex-shrink-0">
        {stats.additions > 0 && (
          <span className="text-[10px] text-success font-medium">+{stats.additions}</span>
        )}
        {stats.deletions > 0 && (
          <span className="text-[10px] text-destructive font-medium">-{stats.deletions}</span>
        )}
      </div>
    </button>
  );
}

/**
 * Diff预览面板组件
 * 显示AI生成的代码修改，支持分块应用和撤销
 */
export function DiffPreview() {
  const { t } = useTranslation();
  const {
    changes,
    history,
    isPreviewOpen,
    selectedFileIndex,
    permissionWhitelist,
    closePreview,
    setSelectedFile,
    toggleBlockSelection,
    selectAllBlocks,
    deselectAllBlocks,
    applyChange,
    applyAll,
    revertChange,
    revertAll,
    undoLast,
    addToWhitelist,
    getStats,
    clearChanges,
  } = useDiffStore();

  const [permissionDialog, setPermissionDialog] = useState<{
    open: boolean;
    file: string;
    operation: string;
    onConfirm: (dontAskAgain: boolean) => void;
  }>({
    open: false,
    file: '',
    operation: '',
    onConfirm: () => {},
  });

  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const selectedChange = changes[selectedFileIndex];

  const handleToggleBlock = useCallback(
    (blockId: string) => {
      if (selectedChange) {
        toggleBlockSelection(selectedFileIndex, blockId);
      }
    },
    [selectedFileIndex, selectedChange, toggleBlockSelection]
  );

  const toggleBlockExpand = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  const handleApplyChange = useCallback(
    (index: number) => {
      const change = changes[index];
      if (!change) return;

      // 检查是否需要权限确认
      if (isDangerousOperation(change) && !permissionWhitelist.has(change.file)) {
        setPermissionDialog({
          open: true,
          file: change.file,
          operation: t('diff.applyChanges'),
          onConfirm: (dontAskAgain) => {
            if (dontAskAgain) {
              addToWhitelist(change.file);
            }
            applyChange(index);
            setPermissionDialog((prev) => ({ ...prev, open: false }));
          },
        });
      } else {
        applyChange(index);
      }
    },
    [changes, permissionWhitelist, applyChange, addToWhitelist, t]
  );

  const handleApplyAll = useCallback(() => {
    const dangerousChanges = changes.filter(
      (c) => isDangerousOperation(c) && !permissionWhitelist.has(c.file) && !c.applied
    );

    if (dangerousChanges.length > 0) {
      // 逐个确认危险操作
      const confirmNext = (idx: number) => {
        if (idx >= dangerousChanges.length) {
          // 所有危险操作已确认，应用剩余的安全修改
          changes.forEach((c, i) => {
            if (!c.applied && !isDangerousOperation(c)) {
              applyChange(i);
            }
          });
          setPermissionDialog((prev) => ({ ...prev, open: false }));
          return;
        }

        const change = dangerousChanges[idx];
        setPermissionDialog({
          open: true,
          file: change.file,
          operation: t('diff.applyChanges'),
          onConfirm: (dontAskAgain) => {
            if (dontAskAgain) {
              addToWhitelist(change.file);
            }
            const changeIndex = changes.findIndex((c) => c.file === change.file);
            if (changeIndex >= 0) {
              applyChange(changeIndex);
            }
            confirmNext(idx + 1);
          },
        });
      };

      confirmNext(0);
    } else {
      applyAll();
    }
  }, [changes, permissionWhitelist, applyAll, applyChange, addToWhitelist, t]);

  const handleRevertChange = useCallback(
    (index: number) => {
      revertChange(index);
    },
    [revertChange]
  );

  const handleRevertAll = useCallback(() => {
    revertAll();
  }, [revertAll]);

  if (!isPreviewOpen || changes.length === 0) {
    return null;
  }

  const totalStats = changes.reduce(
    (acc, change) => {
      const stats = getStats(change);
      return {
        additions: acc.additions + stats.additions,
        deletions: acc.deletions + stats.deletions,
      };
    },
    { additions: 0, deletions: 0 }
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-[85vh] bg-background rounded-xl border shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <FileDiff size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('diff.previewTitle')}</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {changes.length} {t('diff.files')}
              </span>
              {totalStats.additions > 0 && (
                <span className="text-success font-medium">+{totalStats.additions}</span>
              )}
              {totalStats.deletions > 0 && (
                <span className="text-destructive font-medium">-{totalStats.deletions}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={undoLast}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-foreground"
                title={t('diff.undoLast')}
              >
                <Undo2 size={14} />
                <span>{t('diff.undo')}</span>
              </button>
            )}
            <button
              onClick={clearChanges}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
              title={t('diff.clearAll')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧文件列表 */}
          <div className="w-64 border-r flex flex-col bg-muted/20">
            <div className="px-3 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">{t('diff.fileList')}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {changes.map((change, index) => (
                <FileListItem
                  key={change.file}
                  change={change}
                  index={index}
                  isSelected={index === selectedFileIndex}
                  onSelect={setSelectedFile}
                  stats={getStats(change)}
                />
              ))}
            </div>
          </div>

          {/* 右侧Diff详情 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedChange ? (
              <>
                {/* 文件操作栏 */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{selectedChange.file}</span>
                    {selectedChange.applied && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                        {t('diff.applied')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!selectedChange.applied && (
                      <>
                        <button
                          onClick={() => selectAllBlocks(selectedFileIndex)}
                          className="px-2 py-1 text-[10px] rounded hover:bg-accent transition-colors text-muted-foreground"
                        >
                          {t('diff.selectAll')}
                        </button>
                        <button
                          onClick={() => deselectAllBlocks(selectedFileIndex)}
                          className="px-2 py-1 text-[10px] rounded hover:bg-accent transition-colors text-muted-foreground"
                        >
                          {t('diff.deselectAll')}
                        </button>
                        <button
                          onClick={() => handleApplyChange(selectedFileIndex)}
                          className="flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-primary hover:bg-primary/90 transition-colors text-primary-foreground"
                        >
                          <Check size={12} />
                          <span>{t('diff.apply')}</span>
                        </button>
                      </>
                    )}
                    {selectedChange.applied && (
                      <button
                        onClick={() => handleRevertChange(selectedFileIndex)}
                        className="flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-secondary-foreground"
                      >
                        <RotateCcw size={12} />
                        <span>{t('diff.revert')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Diff块列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedChange.blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileCode size={32} className="mb-2 opacity-50" />
                      <p className="text-sm">{t('diff.noChanges')}</p>
                    </div>
                  ) : (
                    selectedChange.blocks.map((block) => (
                      <div key={block.id} className="mb-1">
                        <DiffBlock
                          block={block}
                          language={selectedChange.file.split('.').pop()}
                          onToggleSelection={handleToggleBlock}
                          readOnly={selectedChange.applied}
                        />
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileCode size={32} className="mb-2 opacity-50" />
                <p className="text-sm">{t('diff.selectFile')}</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('diff.total')}:</span>
            {totalStats.additions > 0 && (
              <span className="text-success">+{totalStats.additions}</span>
            )}
            {totalStats.deletions > 0 && (
              <span className="text-destructive">-{totalStats.deletions}</span>
            )}
            {history.length > 0 && (
              <span className="text-muted-foreground">| {history.length} {t('diff.historyCount')}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevertAll}
              disabled={history.length === 0}
              className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('diff.revertAll')}
            </button>
            <button
              onClick={handleApplyAll}
              disabled={changes.every((c) => c.applied)}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 transition-colors text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('diff.applyAll')}
            </button>
          </div>
        </div>
      </div>

      {/* 权限确认对话框 */}
      <PermissionDialog
        open={permissionDialog.open}
        file={permissionDialog.file}
        operation={permissionDialog.operation}
        onConfirm={permissionDialog.onConfirm}
        onCancel={() => setPermissionDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
