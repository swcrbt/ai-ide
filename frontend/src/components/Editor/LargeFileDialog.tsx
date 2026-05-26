import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { MODE_CONFIG, getEditorMode } from './editorMode';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface LargeFileDialogProps {
  open: boolean;
  filePath: string;
  fileSize: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LargeFileDialog({
  open,
  filePath,
  fileSize,
  onConfirm,
  onCancel,
}: LargeFileDialogProps) {
  const editorMode = getEditorMode(fileSize);
  const modeConfig = MODE_CONFIG[editorMode];
  const fileName = filePath.split('/').pop() || filePath;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onCancel();
    },
    [onCancel]
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg rounded-xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-warning" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                大文件警告
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                此文件较大，打开后可能导致编辑器响应变慢。
              </Dialog.Description>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">文件:</span>
              <code className="text-xs bg-background px-1.5 py-0.5 rounded border text-foreground font-mono">
                {fileName}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">大小:</span>
              <span className="text-xs text-foreground font-medium">{formatFileSize(fileSize)}</span>
            </div>
          </div>

          <div className="rounded-md bg-primary/10 p-3 space-y-1">
            <p className="text-xs text-foreground font-medium">
              将以 {modeConfig.label} 打开
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {modeConfig.description}
            </p>
            {!modeConfig.enableLSP && (
              <p className="text-xs text-warning">LSP 功能（补全、跳转）将被禁用</p>
            )}
            {!modeConfig.enableHighlight && (
              <p className="text-xs text-warning">语法高亮将被禁用</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent transition-colors text-foreground"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 transition-colors text-primary-foreground"
            >
              仍然打开
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              onClick={onCancel}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X size={16} className="text-muted-foreground" />
              <span className="sr-only">关闭</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}