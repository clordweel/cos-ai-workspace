'use client';

import { Filter, Search } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export type SessionFilter = 'all' | 'unread' | 'pinned' | 'recent';

const FILTER_LABELS: Record<SessionFilter, string> = {
  all: '全部会话',
  unread: '未读',
  pinned: '置顶',
  recent: '最近使用',
};

export interface SessionListHeaderProps {
  /** 搜索框是否展开 */
  searchOpen?: boolean;
  /** 搜索关键词，受控 */
  searchQuery?: string;
  /** 筛选条件，受控 */
  filter?: SessionFilter;
  onSearchOpenChange?: (open: boolean) => void;
  onSearchQueryChange?: (value: string) => void;
  onFilterChange?: (value: SessionFilter) => void;
  className?: string;
}

export function SessionListHeader({
  searchOpen = false,
  searchQuery = '',
  filter = 'all',
  onSearchOpenChange,
  onSearchQueryChange,
  onFilterChange,
  className,
}: SessionListHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-center justify-between gap-1 px-2',
        className
      )}
      role="banner"
      aria-label="会话列表"
    >
      <div className="min-w-0 flex-1 flex items-center justify-end gap-1">
        {/* 搜索：绝对定位 + 仅 transform 动画，不触发布局重排 */}
        <div className="relative flex shrink-0 items-center justify-end">
          <div
            className={cn(
              'absolute right-10 top-1/2 w-48 -translate-y-1/2 overflow-hidden rounded-full transition-colors duration-200',
              searchOpen ? 'bg-muted' : 'pointer-events-none bg-transparent'
            )}
          >
            <div
              className={cn(
                'flex w-48 overflow-hidden rounded-full transition-transform duration-200 ease-[cubic-bezier(0.33,1,0.68,1)]',
                searchOpen ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                placeholder="搜索会话"
                aria-label="搜索会话"
                className="min-w-0 flex-1 rounded-full border-0 bg-transparent py-2 pl-4 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'shrink-0 rounded-full ml-0.5 mr-0.5 h-8 w-8 text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-700',
              searchOpen && 'h-7 w-7'
            )}
            title={searchOpen ? '收起搜索' : '搜索'}
            aria-label="搜索"
            onClick={() => onSearchOpenChange?.(!searchOpen)}
          >
            <Search className={cn('shrink-0 transition-[width,height] duration-200', searchOpen ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          </Button>
        </div>

        {/* 筛选下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-700"
              title="筛选会话"
              aria-label="筛选会话"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[8rem]">
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
      </div>
    </header>
  );
}
