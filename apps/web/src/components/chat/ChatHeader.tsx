'use client';

import { MoreVertical, User } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  /** 当前用户头像（顶栏菜单左侧） */
  currentUserAvatar?: string | null;
  /** 当前用户名称（头像 fallback 首字） */
  currentUserName?: string | null;
  showBack?: boolean;
  onClose?: () => void;
  className?: string;
}

export function ChatHeader({
  title,
  userAvatar,
  userName,
  currentUserAvatar,
  currentUserName,
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
          'flex h-12 shrink-0 items-center justify-end gap-2 px-3',
          'bg-transparent'
        )}
      >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-0 overflow-hidden rounded-lg text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
            aria-label={`聊天会话菜单：${title}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-l-lg">
              <MoreVertical className="h-3.5 w-3.5" />
            </span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-zinc-800">
              <Avatar className="h-6 w-6">
                {currentUserAvatar && <AvatarImage src={currentUserAvatar} alt="" />}
                <AvatarFallback
                  className={cn(
                    'text-[10px] font-medium',
                    !currentUserAvatar && !currentUserName && 'bg-muted'
                  )}
                >
                  {(currentUserAvatar || currentUserName) ? (
                    currentUserName?.trim().slice(0, 1)?.toUpperCase() ?? '?'
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  )}
                </AvatarFallback>
              </Avatar>
            </span>
          </button>
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
