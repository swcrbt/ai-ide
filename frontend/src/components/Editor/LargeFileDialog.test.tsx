import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LargeFileDialog } from './LargeFileDialog';

describe('LargeFileDialog', () => {
  it('renders when open with file info', () => {
    render(
      <LargeFileDialog
        open={true}
        filePath="/path/to/large-file.ts"
        fileSize={6 * 1024 * 1024}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('大文件警告')).toBeInTheDocument();
    expect(screen.getByText('6.0 MB')).toBeInTheDocument();
    expect(screen.getByText('large-file.ts')).toBeInTheDocument();
  });

  it('shows basic mode for 10-50MB files', () => {
    render(
      <LargeFileDialog
        open={true}
        filePath="/path/to/file.ts"
        fileSize={20 * 1024 * 1024}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('将以 基础模式 打开')).toBeInTheDocument();
  });

  it('shows plaintext mode and LSP/highlight warnings for >= 100MB files', () => {
    render(
      <LargeFileDialog
        open={true}
        filePath="/path/to/huge.log"
        fileSize={150 * 1024 * 1024}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('将以 纯文本模式 打开')).toBeInTheDocument();
    expect(screen.getByText('LSP 功能（补全、跳转）将被禁用')).toBeInTheDocument();
    expect(screen.getByText('语法高亮将被禁用')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <LargeFileDialog
        open={true}
        filePath="/path/to/file.ts"
        fileSize={6 * 1024 * 1024}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <LargeFileDialog
        open={true}
        filePath="/path/to/file.ts"
        fileSize={6 * 1024 * 1024}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('仍然打开'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not render when open is false', () => {
    render(
      <LargeFileDialog
        open={false}
        filePath="/path/to/file.ts"
        fileSize={6 * 1024 * 1024}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText('大文件警告')).not.toBeInTheDocument();
  });

  it('formats KB sizes correctly', () => {
    render(
      <LargeFileDialog
        open={true}
        filePath="/path/to/file.ts"
        fileSize={500 * 1024}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('500.0 KB')).toBeInTheDocument();
  });
});