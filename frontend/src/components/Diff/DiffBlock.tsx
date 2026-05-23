import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { DiffBlock as DiffBlockType } from '../../stores/useDiffStore';
import { useThemeStore } from '../../stores/useThemeStore';

interface DiffBlockProps {
  block: DiffBlockType;
  language?: string;
  onToggleSelection?: (blockId: string) => void;
  readOnly?: boolean;
}

function getHighlighterLanguage(lang: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    shell: 'bash',
  };
  return map[lang.toLowerCase()] || lang.toLowerCase();
}

function HighlightedLine({ code, language, theme }: { code: string; language: string; theme: 'light' | 'dark' }) {
  const style = theme === 'dark' ? atomDark : oneLight;
  return (
    <SyntaxHighlighter
      language={language}
      style={style}
      PreTag="span"
      CodeTag="span"
      customStyle={{
        margin: 0,
        padding: 0,
        background: 'transparent',
        display: 'inline',
      }}
      codeTagProps={{
        style: {
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        },
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}

function getBlockStyles(type: DiffBlockType['type']) {
  switch (type) {
    case 'add':
      return {
        bgColor: 'bg-success/10',
        borderColor: 'border-success/30',
        lineColor: 'bg-success/20 text-success',
        icon: <PlusIcon />,
        label: '新增',
      };
    case 'delete':
      return {
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/30',
        lineColor: 'bg-destructive/20 text-destructive',
        icon: <MinusIcon />,
        label: '删除',
      };
    case 'modify':
      return {
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/30',
        lineColor: 'bg-warning/20 text-warning',
        icon: <ModifyIcon />,
        label: '修改',
      };
  }
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-success">
      <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-destructive">
      <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ModifyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-warning">
      <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DiffBlock({ block, language = 'text', onToggleSelection, readOnly = false }: DiffBlockProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  const styles = getBlockStyles(block.type);
  const highlighterLang = getHighlighterLanguage(language);

  const handleToggle = useCallback(() => {
    if (readOnly || !onToggleSelection) return;
    onToggleSelection(block.id);
  }, [block.id, onToggleSelection, readOnly]);

  return (
    <div className={`rounded-md border ${styles.borderColor} overflow-hidden mb-2`}>
      <div className={`flex items-center justify-between px-3 py-1.5 ${styles.bgColor} border-b ${styles.borderColor}`}>
        <div className="flex items-center gap-2">
          {styles.icon}
          <span className="text-xs font-medium text-foreground/80">{styles.label}</span>
          <span className="text-[10px] text-muted-foreground">
            {block.type === 'add' && `+${block.newLines.length} 行`}
            {block.type === 'delete' && `-${block.oldLines.length} 行`}
            {block.type === 'modify' && `-${block.oldLines.length} / +${block.newLines.length} 行`}
          </span>
        </div>
        {!readOnly && onToggleSelection && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={block.selected}
              onChange={handleToggle}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-[10px] text-muted-foreground">
              {block.selected ? t('diff.selected') : t('diff.unselected')}
            </span>
          </label>
        )}
      </div>

      <div className="text-sm font-mono">
        {block.type === 'delete' && (
          <div className="divide-y divide-destructive/10">
            {block.oldLines.map((line, idx) => (
              <div key={`old-${idx}`} className="flex">
                <span className={`flex-shrink-0 w-12 px-2 py-0.5 text-right text-[10px] ${styles.lineColor} select-none`}>
                  {block.oldStartLine + idx}
                </span>
                <span className="flex-shrink-0 w-6 px-1 py-0.5 text-center text-[10px] text-muted-foreground/50 select-none">
                  -
                </span>
                <pre className="flex-1 px-2 py-0.5 overflow-x-auto">
                  <code className="text-destructive">
                    <HighlightedLine code={line} language={highlighterLang} theme={resolvedTheme} />
                  </code>
                </pre>
              </div>
            ))}
          </div>
        )}

        {block.type === 'add' && (
          <div className="divide-y divide-success/10">
            {block.newLines.map((line, idx) => (
              <div key={`new-${idx}`} className="flex">
                <span className="flex-shrink-0 w-12 px-2 py-0.5 text-right text-[10px] text-muted-foreground/50 select-none">
                  
                </span>
                <span className={`flex-shrink-0 w-6 px-1 py-0.5 text-center text-[10px] ${styles.lineColor} select-none`}>
                  {block.newStartLine + idx}
                </span>
                <pre className="flex-1 px-2 py-0.5 overflow-x-auto">
                  <code className="text-success">
                    <HighlightedLine code={line} language={highlighterLang} theme={resolvedTheme} />
                  </code>
                </pre>
              </div>
            ))}
          </div>
        )}

        {block.type === 'modify' && (
          <div>
            <div className="divide-y divide-warning/10">
              {block.oldLines.map((line, idx) => (
                <div key={`old-${idx}`} className="flex">
                  <span className={`flex-shrink-0 w-12 px-2 py-0.5 text-right text-[10px] ${styles.lineColor} select-none`}>
                    {block.oldStartLine + idx}
                  </span>
                  <span className="flex-shrink-0 w-6 px-1 py-0.5 text-center text-[10px] text-muted-foreground/50 select-none">
                    -
                  </span>
                  <pre className="flex-1 px-2 py-0.5 overflow-x-auto">
                    <code className="text-destructive line-through opacity-60">
                      <HighlightedLine code={line} language={highlighterLang} theme={resolvedTheme} />
                    </code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="h-px bg-warning/20" />
            <div className="divide-y divide-warning/10">
              {block.newLines.map((line, idx) => (
                <div key={`new-${idx}`} className="flex">
                  <span className="flex-shrink-0 w-12 px-2 py-0.5 text-right text-[10px] text-muted-foreground/50 select-none">
                    
                  </span>
                  <span className={`flex-shrink-0 w-6 px-1 py-0.5 text-center text-[10px] ${styles.lineColor} select-none`}>
                    {block.newStartLine + idx}
                  </span>
                  <pre className="flex-1 px-2 py-0.5 overflow-x-auto">
                    <code className="text-success">
                      <HighlightedLine code={line} language={highlighterLang} theme={resolvedTheme} />
                    </code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
