import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Plus,
  GitBranch,
  AlertTriangle,
  Check,
  ChevronDown,
  Tag,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { GenerateTitle } from '../../types/wails';
import { useGitStore } from '../../stores/useGitStore';

const PRESET_TAGS = [
  { name: 'BUG', color: '#ef4444' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'hotfix', color: '#22c55e' },
];

function generateTitlePreview(content: string): string {
  if (!content.trim()) return '';
  const lines = content.split('\n');
  const firstLine = lines[0].trim();
  if (!firstLine) return '新任务';
  const chars = [...firstLine];
  if (chars.length > 30) return chars.slice(0, 30).join('') + '...';
  return firstLine;
}

export interface TaskCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: {
    title: string;
    description: string;
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
  const [content, setContent] = useState('');
  const [branch, setBranch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [customTagColor, setCustomTagColor] = useState('#8b5cf6');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const branches = useGitStore((s) => s.branches);
  const loadBranches = useGitStore((s) => s.loadBranches);

  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen, loadBranches]);

  const titlePreview = useMemo(
    () => generateTitlePreview(content),
    [content]
  );

  const localBranches = useMemo(
    () => branches.filter((b) => !b.name.startsWith('remotes/')),
    [branches]
  );

  const filteredBranches = useMemo(() => {
    const search = branchFilter.trim().toLowerCase();
    if (!search) return localBranches;
    return localBranches.filter((b) =>
      b.name.toLowerCase().includes(search)
    );
  }, [branchFilter, localBranches]);

  const isExistingBranch = useMemo(
    () => localBranches.some((b) => b.name === branch.trim()),
    [localBranches, branch]
  );

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
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

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
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBranchDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        contentInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setContent('');
    setBranch('');
    setBranchFilter('');
    setSelectedTag('');
    setCustomTag('');
    setCustomTagColor('#8b5cf6');
    setErrors({});
    setIsTagDropdownOpen(false);
    setIsBranchDropdownOpen(false);
    setIsGenerating(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!content.trim()) {
      newErrors.content = '请输入任务内容';
    }

    if (!branch.trim()) {
      newErrors.branch = '请选择或输入关联分支';
    }

    if (!selectedTag) {
      newErrors.tag = '请选择或输入标签';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [content, branch, selectedTag]);

  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    const tagObj = allTags.find((t) => t.name === selectedTag);
    if (!tagObj) return;

    setIsGenerating(true);
    try {
      const title = await GenerateTitle(content.trim());
      onCreate({
        title: title || titlePreview || '新任务',
        description: content.trim(),
        branch: branch.trim(),
        tag: selectedTag,
        tagColor: tagObj.color,
      });
      resetForm();
    } catch {
      onCreate({
        title: titlePreview || '新任务',
        description: content.trim(),
        branch: branch.trim(),
        tag: selectedTag,
        tagColor: tagObj.color,
      });
      resetForm();
    } finally {
      setIsGenerating(false);
    }
  }, [
    validateForm,
    allTags,
    selectedTag,
    content,
    branch,
    titlePreview,
    onCreate,
    resetForm,
  ]);

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

  const handleBranchSelect = useCallback(
    (branchName: string) => {
      setBranch(branchName);
      setBranchFilter('');
      setIsBranchDropdownOpen(false);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.branch;
        return next;
      });
    },
    []
  );

  const handleBranchInputChange = useCallback(
    (value: string) => {
      setBranch(value);
      setBranchFilter(value);
      setIsBranchDropdownOpen(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.branch;
        return next;
      });
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
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
    [
      isTagDropdownOpen,
      customTag,
      handleAddCustomTag,
      handleCreate,
      handleClose,
      isGenerating,
    ]
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
          {/* Header */}
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

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* 任务内容 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Sparkles size={14} className="text-muted-foreground" />
                任务内容
                <span className="text-destructive">*</span>
              </label>
              <textarea
                ref={contentInputRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  clearError('content');
                }}
                placeholder="输入任务内容，AI 将自动生成标题..."
                rows={3}
                className={`
                  w-full px-3 py-2 rounded-md border bg-background
                  text-sm text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                  transition-colors resize-none
                  ${errors.content ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-border'}
                `}
              />
              {errors.content && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.content}
                </p>
              )}
              {titlePreview && !errors.content && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles size={12} className="text-primary/60" />
                  <span>自动生成标题预览: <span className="text-foreground/80">{titlePreview}</span></span>
                </div>
              )}
            </div>

            {/* 关联分支 */}
            <div className="space-y-1.5" ref={branchDropdownRef}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <GitBranch size={14} className="text-muted-foreground" />
                关联分支
                <span className="text-destructive">*</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => handleBranchInputChange(e.target.value)}
                  onFocus={() => {
                    setBranchFilter('');
                    setIsBranchDropdownOpen(true);
                  }}
                  placeholder="选择已有分支或输入新分支名..."
                  className={`
                    w-full px-3 py-2 rounded-md border bg-background
                    text-sm text-foreground placeholder:text-muted-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                    transition-colors
                    ${errors.branch ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-border'}
                  `}
                />
                <button
                  type="button"
                  onClick={() => {
                    setBranchFilter('');
                    setIsBranchDropdownOpen(!isBranchDropdownOpen);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isBranchDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                    {filteredBranches.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground px-2 py-1">
                          已有分支
                        </p>
                        <div className="space-y-0.5">
                          {filteredBranches.map((b) => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => handleBranchSelect(b.name)}
                              className={`
                                w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm
                                transition-colors
                                ${branch.trim() === b.name ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}
                              `}
                            >
                              <GitBranch size={12} className="text-muted-foreground flex-shrink-0" />
                              <span className="flex-1 text-left">{b.name}</span>
                              {b.current && (
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">HEAD</span>
                              )}
                              {branch.trim() === b.name && (
                                <Check size={14} className="text-primary flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {branch.trim() && !isExistingBranch && (
                      <div className="border-t border-border pt-1 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsBranchDropdownOpen(false);
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.branch;
                              return next;
                            });
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-accent/50 text-primary transition-colors"
                        >
                          <Plus size={12} className="flex-shrink-0" />
                          <span className="flex-1 text-left">创建新分支: {branch.trim()}</span>
                        </button>
                      </div>
                    )}

                    {filteredBranches.length === 0 && !branch.trim() && (
                      <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                        暂无分支信息
                      </p>
                    )}
                  </div>
                )}
              </div>

              {errors.branch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.branch}
                </p>
              )}

              {isExistingBranch && branch.trim() && (
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

            {/* 标签 */}
            <div className="space-y-1.5" ref={tagDropdownRef}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Tag size={14} className="text-muted-foreground" />
                标签
                <span className="text-destructive">*</span>
              </label>

              <div className="relative">
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

                {isTagDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-popover shadow-lg p-2 space-y-2">
                    {/* 预设标签 */}
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

                    {/* 自定义标签 */}
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

                    {/* 添加新标签 */}
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

              {errors.tag && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.tag}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent transition-colors text-foreground disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 transition-colors text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  生成标题中...
                </>
              ) : (
                '创建'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
