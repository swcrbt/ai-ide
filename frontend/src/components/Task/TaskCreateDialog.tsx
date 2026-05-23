import { useState, useCallback, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Plus,
  GitBranch,
  AlertTriangle,
  Check,
  ChevronDown,
  Tag,
  Type,
} from 'lucide-react';

const PRESET_TAGS = [
  { name: 'BUG', color: '#ef4444' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'hotfix', color: '#22c55e' },
];

export interface TaskCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: {
    title: string;
    branch: string;
    tag: string;
    tagColor: string;
  }) => void;
}

export function TaskCreateDialog({
  isOpen,
  onClose,
  onCreate,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [branch, setBranch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [customTagColor, setCustomTagColor] = useState('#8b5cf6');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConflictWarning, setShowConflictWarning] = useState(false);

  const [customTags, setCustomTags] = useState<{ name: string; color: string }[]>(
    () => {
      try {
        const stored = localStorage.getItem('ai-ide-custom-tags');
        if (stored) {
          return JSON.parse(stored) as { name: string; color: string }[];
        }
      } catch {
        // ignore
      }
      return [];
    }
  );

  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const allTags = [...PRESET_TAGS, ...customTags];
  const currentTag = allTags.find((t) => t.name === selectedTag);

  const saveCustomTags = useCallback(
    (tags: { name: string; color: string }[]) => {
      try {
        localStorage.setItem('ai-ide-custom-tags', JSON.stringify(tags));
      } catch {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTagDropdownOpen(false);
      }
    }

    if (isTagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isTagDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setTitle('');
    setBranch('');
    setSelectedTag('');
    setCustomTag('');
    setCustomTagColor('#8b5cf6');
    setErrors({});
    setShowConflictWarning(false);
    setIsTagDropdownOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = '请输入任务标题';
    }

    if (!branch.trim()) {
      newErrors.branch = '请输入关联分支名';
    }

    if (!selectedTag) {
      newErrors.tag = '请选择或输入标签';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, branch, selectedTag]);

  const handleCreate = useCallback(() => {
    if (!validateForm()) return;

    const tagObj = allTags.find((t) => t.name === selectedTag);
    if (!tagObj) return;

    onCreate({
      title: title.trim(),
      branch: branch.trim(),
      tag: selectedTag,
      tagColor: tagObj.color,
    });

    resetForm();
  }, [validateForm, allTags, selectedTag, title, branch, onCreate, resetForm]);

  const handleTagSelect = useCallback(
    (tagName: string) => {
      setSelectedTag(tagName);
      setIsTagDropdownOpen(false);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.tag;
        return next;
      });
    },
    []
  );

  const handleAddCustomTag = useCallback(() => {
    const trimmed = customTag.trim();
    if (!trimmed) return;

    if (allTags.some((t) => t.name === trimmed)) {
      handleTagSelect(trimmed);
      setCustomTag('');
      return;
    }

    const newTag = { name: trimmed, color: customTagColor };
    const updated = [...customTags, newTag];
    setCustomTags(updated);
    saveCustomTags(updated);
    setSelectedTag(trimmed);
    setCustomTag('');
    setIsTagDropdownOpen(false);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.tag;
      return next;
    });
  }, [
    customTag,
    customTagColor,
    allTags,
    customTags,
    saveCustomTags,
    handleTagSelect,
  ]);

  const handleBranchChange = useCallback(
    (value: string) => {
      setBranch(value);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.branch;
        return next;
      });

      if (value.trim().length > 2) {
        const existingBranches = ['main', 'master'];
        setShowConflictWarning(existingBranches.includes(value.trim()));
      } else {
        setShowConflictWarning(false);
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isTagDropdownOpen && customTag.trim()) {
          e.preventDefault();
          handleAddCustomTag();
          return;
        }
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    },
    [isTagDropdownOpen, customTag, handleAddCustomTag, handleCreate, handleClose]
  );

  const clearError = useCallback(
    (field: string) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] border bg-popover p-0 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus size={18} className="text-primary" />
              </div>
              <Dialog.Title className="text-base font-semibold text-foreground">
                创建新任务
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
                <span className="sr-only">关闭</span>
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Type size={14} className="text-muted-foreground" />
                任务标题
                <span className="text-destructive">*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError('title');
                }}
                placeholder="输入任务标题..."
                className={`
                  w-full px-3 py-2 rounded-md border bg-background
                  text-sm text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                  transition-colors
                  ${errors.title ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-border'}
                `}
              />
              {errors.title && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.title}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <GitBranch size={14} className="text-muted-foreground" />
                关联分支
                <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => handleBranchChange(e.target.value)}
                placeholder="输入分支名称..."
                className={`
                  w-full px-3 py-2 rounded-md border bg-background
                  text-sm text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                  transition-colors
                  ${errors.branch ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-border'}
                `}
              />
              {errors.branch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.branch}
                </p>
              )}

              {showConflictWarning && (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 border border-warning/20">
                  <AlertTriangle
                    size={14}
                    className="text-warning flex-shrink-0 mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-warning">
                      分支已存在
                    </p>
                    <p className="text-xs text-warning/80">
                      该分支名已存在于仓库中，创建任务将关联到现有分支。
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5" ref={tagDropdownRef}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Tag size={14} className="text-muted-foreground" />
                标签
                <span className="text-destructive">*</span>
              </label>

              <button
                type="button"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-md border bg-background
                  text-sm text-foreground
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                  transition-colors
                  ${errors.tag ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-border'}
                  ${isTagDropdownOpen ? 'ring-2 ring-ring border-primary' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  {currentTag ? (
                    <>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: currentTag.color }}
                      />
                      <span>{currentTag.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">选择或输入标签...</span>
                  )}
                </div>
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {errors.tag && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.tag}
                </p>
              )}

              {isTagDropdownOpen && (
                <div className="absolute z-50 w-[calc(100%-3rem)] mt-1 rounded-lg border border-border bg-popover shadow-lg p-2 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      预设标签
                    </p>
                    <div className="space-y-0.5">
                      {PRESET_TAGS.map((tag) => (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => handleTagSelect(tag.name)}
                          className={`
                            w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm
                            transition-colors
                            ${selectedTag === tag.name ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}
                          `}
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 text-left">{tag.name}</span>
                          {selectedTag === tag.name && (
                            <Check size={14} className="text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {customTags.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        自定义标签
                      </p>
                      <div className="space-y-0.5">
                        {customTags.map((tag) => (
                          <button
                            key={tag.name}
                            type="button"
                            onClick={() => handleTagSelect(tag.name)}
                            className={`
                              w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm
                              transition-colors
                              ${selectedTag === tag.name ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}
                            `}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="flex-1 text-left">{tag.name}</span>
                            {selectedTag === tag.name && (
                              <Check size={14} className="text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-2 px-2">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      添加新标签
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customTagColor}
                        onChange={(e) => setCustomTagColor(e.target.value)}
                        className="w-8 h-8 rounded-md border border-border cursor-pointer flex-shrink-0"
                        title="选择标签颜色"
                      />
                      <input
                        type="text"
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomTag();
                          }
                        }}
                        placeholder="输入新标签名称..."
                        className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomTag}
                        disabled={!customTag.trim()}
                        className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        title="添加标签"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent transition-colors text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 transition-colors text-primary-foreground"
            >
              创建
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
