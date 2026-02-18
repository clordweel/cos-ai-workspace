'use client';

import { MessageSquarePlus, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

/** 会话类型筛选：全部 / 私聊 / 群组 */
export type SessionFilter = 'all' | 'private' | 'group';

const FILTER_LABELS: Record<SessionFilter, string> = {
  all: '全部',
  private: '私聊',
  group: '群组',
};

export interface SessionListHeaderProps {
  /** 搜索关键词，受控 */
  searchQuery?: string;
  /** 会话类型筛选，受控 */
  filter?: SessionFilter;
  onSearchQueryChange?: (value: string) => void;
  onFilterChange?: (value: SessionFilter) => void;
  /** 创建会话（顶栏右侧按钮） */
  onNewChat?: () => void;
  className?: string;
}

export function SessionListHeader({
  searchQuery = '',
  filter = 'all',
  onSearchQueryChange,
  onFilterChange,
  onNewChat,
  className,
}: SessionListHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-[40px] shrink-0 items-center justify-between gap-2 px-2',
        className
      )}
      role="banner"
      aria-label="会话列表"
    >
      {/* 搜索框：居左，框内左侧为搜索图标 */}
      <div className="flex min-w-0 flex-1 items-center justify-start">
        <div className="flex w-48 shrink-0 items-center overflow-hidden rounded-full bg-muted">
          <span className="pointer-events-none flex shrink-0 items-center justify-center pl-3 text-muted-foreground" aria-hidden>
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="min-w-0 flex-1 rounded-full border-0 bg-transparent py-2 pl-2 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
          />
        </div>
      </div>

      {/* 右侧：筛选 + 创建会话 */}
      <div className="flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-700"
              title="筛选会话类型"
              aria-label="筛选会话类型"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[7rem]">
            <DropdownMenuRadioGroup
              value={filter}
              onValueChange={(v) => onFilterChange?.(v as SessionFilter)}
            >
              {(Object.keys(FILTER_LABELS) as SessionFilter[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {FILTER_LABELS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-700"
          title="创建会话"
          aria-label="创建会话"
          onClick={() => onNewChat?.()}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
