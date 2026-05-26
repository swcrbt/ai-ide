import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';

const mockTask = {
  id: 'task-1',
  title: '实现用户登录',
  branch: 'feature/login',
  status: 'in_progress' as const,
  tag: 'feature',
  tagColor: '#3b82f6',
};

const mockOnClick = vi.fn();
const mockOnDelete = vi.fn();

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应渲染任务标题和分支', () => {
    render(
      <TaskCard
        task={mockTask}
        isActive={false}
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('实现用户登录')).toBeInTheDocument();
    expect(screen.getByText('🌿 feature/login')).toBeInTheDocument();
    expect(screen.getByText('feature')).toBeInTheDocument();
  });

  it('点击卡片应触发 onClick', () => {
    render(
      <TaskCard
        task={mockTask}
        isActive={false}
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByText('实现用户登录'));
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('点击删除按钮应触发 onDelete 并阻止冒泡', () => {
    render(
      <TaskCard
        task={mockTask}
        isActive={false}
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />
    );

    const deleteButton = screen.getByTitle('删除任务');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalled();
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('激活状态应有不同的样式类', () => {
    const { container } = render(
      <TaskCard
        task={mockTask}
        isActive={true}
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-2');
    expect(card.className).toContain('bg-accent/50');
  });

  it('非激活状态不应有激活样式', () => {
    const { container } = render(
      <TaskCard
        task={mockTask}
        isActive={false}
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('border-l-2');
  });

  it('应显示标签颜色', () => {
    render(
      <TaskCard
        task={{ ...mockTask, tagColor: '#ef4444', tag: 'BUG' }}
        isActive={false}
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />
    );

    const tag = screen.getByText('BUG');
    expect(tag).toHaveStyle({ color: '#ef4444' });
  });
});
