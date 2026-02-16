'use client';

import { cn } from '@/lib/utils';
import type { MockSessionItem } from '@/data/mockSessions';
import { SessionListThumb } from '@/components/SessionListThumb';

export interface SessionListItemProps {
  item: MockSessionItem;
  isActive?: boolean;
  dateLabel?: string;
  unreadCount?: number;
  onClick?: () => void;
  className?: string;
}

export function SessionListItem({
  item,
  isActive = false,
  dateLabel,
  unreadCount = 0,
  onClick,
  className,
}: SessionListItemProps) {
  return (
    <li
      role="button"
      tabIndex={0}
      className={cn(
        'flex cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2',
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/30 text-foreground'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-700 text-foreground',
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <SessionListThumb
        type={item.type}
        participants={item.participants}
      />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-inherit">
        {item.title}
      </p>
      {unreadCount > 0 && (
        <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-md bg-primary-100 px-1.5 text-[11px] font-semibold tabular-nums text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {dateLabel && (
        <span className="shrink-0 text-[11px] opacity-80">{dateLabel}</span>
      )}
    </li>
  );
}
