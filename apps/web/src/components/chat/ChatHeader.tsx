'use client';

import { ChevronLeft, Menu } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ChatHeaderProps {
  title: string;
  userAvatar?: string | null;
  userName?: string | null;
  showBack?: boolean;
  onClose?: () => void;
  className?: string;
}

export function ChatHeader({
  title,
  userAvatar,
  userName,
  showBack = false,
  onClose,
  className,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className={cn('absolute left-0 right-0 top-0 z-20 flex flex-col', className)}
      aria-label="会话标题"
    >
      {/* 顶栏内容层：背景透明，遮罩渐变由 ChatPane 单独层提供，保证可点击 */}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center justify-between gap-2 px-3',
          'bg-transparent border-b border-zinc-200/40 dark:border-zinc-700/40'
        )}
      >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showBack && (
          <Link
            to="/space"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
            aria-label="返回会话列表"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
          aria-label={title}
          title={title}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary-100 dark:border-zinc-800 dark:bg-primary-900/50 text-xs font-medium text-foreground">
            {userAvatar ? (
              <img src={userAvatar} alt={userName || title} className="h-full w-full object-cover" />
            ) : (
              (userName || title).trim().slice(0, 1) || '?'
            )}
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{title}</span>
        </button>
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-700"
            aria-label={`会话菜单：${title}`}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="min-w-[10rem]">
          <DropdownMenuItem
            className="text-xs"
            onSelect={() => {
              setMenuOpen(false);
              onClose?.();
            }}
          >
            关闭会话
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
