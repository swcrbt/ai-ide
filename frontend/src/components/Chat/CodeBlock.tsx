import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, FileInput, FileDiff } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useThemeStore } from '../../stores/useThemeStore';

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  onInsertToEditor?: (code: string) => void;
  onApplyChanges?: (code: string) => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  css: 'css',
  scss: 'css',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  zsh: 'bash',
};

function getHighlighterLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || normalized;
}

export function CodeBlock({ code, language = 'text', onInsertToEditor, onApplyChanges }: CodeBlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useThemeStore();
  const highlighterLang = getHighlighterLanguage(language);
  const style = resolvedTheme === 'dark' ? atomDark : oneLight;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('复制失败');
    }
  }, [code]);

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border bg-muted/50">
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {language}
        </span>
        <div className="flex items-center gap-1">
          {onInsertToEditor && (
            <button
              onClick={() => onInsertToEditor(code)}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title={t('ai.insertToEditor')}
            >
              <FileInput size={14} className="text-muted-foreground" />
            </button>
          )}
          {onApplyChanges && (
            <button
              onClick={() => onApplyChanges(code)}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title={t('ai.applyChanges')}
            >
              <FileDiff size={14} className="text-muted-foreground" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title={copied ? t('ai.copied') : t('ai.copy')}
          >
            {copied ? (
              <Check size={14} className="text-success" />
            ) : (
              <Copy size={14} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto text-sm leading-relaxed">
        <SyntaxHighlighter
          language={highlighterLang}
          style={style}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: 1.625,
          }}
          codeTagProps={{
            style: {
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
