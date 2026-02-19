'use client';

import { cn } from '@/lib/utils';
import { SessionListThumb } from '@/components/SessionListThumb';

/** 会话列表项：兼容 API Session 与 MockSessionItem（type/participants 可选） */
export type SessionListEntry = {
  id: string;
  title: string;
  updatedAt: number;
  type?: 'private' | 'group';
  participants?: { name: string; avatar?: string; kind?: 'user' | 'bot' }[];
};
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Pencil, Pin, PinOff, Trash2 } from 'lucide-react';

export interface SessionListItemProps {
  item: SessionListEntry;
  isActive?: boolean;
  isPinned?: boolean;
  dateLabel?: string;
  unreadCount?: number;
  onClick?: () => void;
  onTogglePin?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function SessionListItem({
  item,
  isActive = false,
  isPinned = false,
  dateLabel,
  unreadCount = 0,
  onClick,
  onTogglePin,
  onRename,
  onDelete,
  className,
}: SessionListItemProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
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
        type={item.type ?? 'private'}
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
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent className="min-w-[140px]" sideOffset={4}>
          <ContextMenuItem className="gap-2" onSelect={() => onTogglePin?.()}>
            {isPinned ? (
              <>
                <PinOff className="h-3.5 w-3.5 shrink-0 opacity-70" />
                取消置顶
              </>
            ) : (
              <>
                <Pin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                置顶
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onSelect={() => onRename?.()}>
            <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" />
            重命名
          </ContextMenuItem>
          <ContextMenuItem
            className="gap-2 text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
            onSelect={() => onDelete?.()}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
            删除会话
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenu>
  );
}
