'use client';

import { ChevronDown, ChevronRight, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SessionCategoryProps {
  /** 标题，如「置顶」 */
  title: string;
  /** 数量，显示在右侧 */
  count?: number;
  /** 是否折叠 */
  collapsed: boolean;
  /** 点击标题切换折叠 */
  onCollapsedChange: (collapsed: boolean) => void;
  /** 置顶等强调样式（比背景深的灰色） */
  accent?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SessionCategory({
  title,
  count = 0,
  collapsed,
  onCollapsedChange,
  accent = false,
  children,
  className,
}: SessionCategoryProps) {
  return (
    <section
      className={cn(
        'shrink-0 border-b',
        accent
          ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 border-l-2 border-l-zinc-400 dark:border-l-zinc-500'
          : 'border-zinc-100 dark:border-zinc-700/80',
        className
      )}
    >
      <button
        type="button"
        className={cn(
          'session-category-header flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
          accent
            ? 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 focus-visible:ring-zinc-400/40'
            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-zinc-400/40'
        )}
        onClick={() => onCollapsedChange(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `展开${title}` : `折叠${title}`}
      >
        {collapsed ? (
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              accent ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
            )}
          />
        ) : (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              accent ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
            )}
          />
        )}
        {accent && <Pin className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-400" />}
        <span className="flex-1">{title}</span>
        {count > 0 && (
          <span
            className={cn(
              'shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
              accent
                ? 'bg-zinc-200/90 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200'
                : 'bg-zinc-200/80 dark:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300'
            )}
          >
            {count}
          </span>
        )}
      </button>
      {!collapsed && (
        <ul
          className={cn(
            'divide-y',
            accent ? 'divide-zinc-200 dark:divide-zinc-700' : 'divide-zinc-100 dark:divide-zinc-700'
          )}
        >
          {children}
        </ul>
      )}
    </section>
  );
}
