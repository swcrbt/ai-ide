import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';

interface PermissionDialogProps {
  /** 是否显示对话框 */
  open: boolean;
  /** 要操作的文件路径 */
  file: string;
  /** 操作描述 */
  operation: string;
  /** 确认回调 */
  onConfirm: (dontAskAgain: boolean) => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 权限审批对话框组件
 * 用于危险操作的用户确认
 */
export function PermissionDialog({
  open,
  file,
  operation,
  onConfirm,
  onCancel,
}: PermissionDialogProps) {
  const { t } = useTranslation();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = useCallback(() => {
    onConfirm(dontAskAgain);
  }, [dontAskAgain, onConfirm]);

  const handleCancel = useCallback(() => {
    setDontAskAgain(false);
    onCancel();
  }, [onCancel]);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg rounded-xl">
          {/* 对话框头部 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-warning" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                {t('diff.permissionTitle')}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {t('diff.permissionDescription')}
              </Dialog.Description>
            </div>
          </div>

          {/* 操作详情 */}
          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('diff.targetFile')}:</span>
              <code className="text-xs bg-background px-1.5 py-0.5 rounded border text-foreground font-mono">
                {file}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('diff.operation')}:</span>
              <span className="text-xs text-foreground">{operation}</span>
            </div>
          </div>

          {/* 警告信息 */}
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
            <AlertTriangle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">
              {t('diff.permissionWarning')}
            </p>
          </div>

          {/* 不再询问选项 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">{t('diff.dontAskAgain')}</span>
          </label>

          {/* 按钮组 */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent transition-colors text-foreground"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 transition-colors text-primary-foreground"
            >
              {t('common.confirm')}
            </button>
          </div>

          {/* 关闭按钮 */}
          <Dialog.Close asChild>
            <button
              onClick={handleCancel}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X size={16} className="text-muted-foreground" />
              <span className="sr-only">{t('common.close')}</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
