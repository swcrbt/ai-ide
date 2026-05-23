import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, FileInput, FileDiff } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-shell-session';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';

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

function getPrismLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || normalized;
}

export function CodeBlock({ code, language = 'text', onInsertToEditor, onApplyChanges }: CodeBlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const prismLang = getPrismLanguage(language);
  const grammar = Prism.languages[prismLang] || Prism.languages.plain;
  const highlighted = Prism.highlight(code, grammar, prismLang);

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
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code
          className={`language-${prismLang}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}
