'use client';

import { Archive, Download, Link, MoreVertical, Pencil, Phone, Share2, Trash2, User, Users, Video, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarStack } from '@/components/ui/avatar-stack';
import type { AvatarStackItem } from '@/components/ui/avatar-stack';
import { AiAssistantAvatarIcon } from '@/components/icons/AiAssistantAvatarIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AI_ASSISTANT_LABEL } from '@/components/chat/assistantConstants';

/** 顶栏展示的参与者（排除“我”）；与 AvatarStackItem 一致，用于堆叠展示 */
export interface ChatHeaderParticipant {
  id?: string;
  name?: string | null;
  avatar?: string | null;
  kind?: 'user' | 'bot';
}

export interface ChatHeaderProps {
  title: string;
  userAvatar?: string | null;
  userName?: string | null;
  /** 对方为 @ai-assistant 机器人且无头像时，顶栏单头像用占位图标 */
  userIsAiAssistant?: boolean;
  /** 参与会话者（排除当前用户），顶栏左侧堆叠头像 */
  participants?: ChatHeaderParticipant[];
  /** 当前用户头像（顶栏菜单左侧） */
  currentUserAvatar?: string | null;
  /** 当前用户名称（头像 fallback 首字） */
  currentUserName?: string | null;
  showBack?: boolean;
  /** 关闭会话（与 frontend 一致） */
  onClose?: () => void;
  /** 会话成员（与 frontend 一致） */
  onOpenMembers?: () => void;
  /** 重命名会话 */
  onRename?: () => void;
  /** 分享此会话 */
  onShare?: () => void;
  /** 复制会话链接 */
  onCopyLink?: () => void;
  /** 导出：当前屏 */
  onExportScreen?: () => void;
  /** 导出：长屏截图 */
  onExportScreenshot?: () => void;
  /** 导出：Markdown */
  onExportMarkdown?: () => void;
  /** 归档会话 */
  onArchive?: () => void;
  /** 删除会话 */
  onDelete?: () => void;
  /** 离开会话（Matrix：离开房间；提供时菜单显示「离开会话」并调用此回调） */
  onLeave?: () => void;
  className?: string;
}

const MAX_PARTICIPANT_AVATARS = 4;

export function ChatHeader({
  title,
  userAvatar,
  userName,
  userIsAiAssistant = false,
  participants = [],
  currentUserAvatar,
  currentUserName,
  showBack = false,
  onClose,
  onOpenMembers,
  onRename,
  onShare,
  onCopyLink,
  onExportScreen,
  onExportScreenshot,
  onExportMarkdown,
  onArchive,
  onDelete,
  onLeave,
  className,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  /** 堆叠头像列表：含“我”和所有成员（含机器人），与 coss 一致 */
  const allMembers: AvatarStackItem[] = useMemo(() => {
    const me: AvatarStackItem = {
      id: 'me',
      name: currentUserName ?? undefined,
      avatar: currentUserAvatar ?? undefined,
      kind: 'user',
    };
    const list: AvatarStackItem[] = [me];
    if (participants.length > 0) {
      list.push(...participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, kind: p.kind })));
    } else if (userAvatar ?? userName ?? userIsAiAssistant) {
      list.push({
        id: userIsAiAssistant ? 'ai-assistant' : 'other',
        name: userName ?? (userIsAiAssistant ? AI_ASSISTANT_LABEL : undefined),
        avatar: userAvatar ?? undefined,
        kind: userIsAiAssistant ? 'bot' : 'user',
      });
    }
    return list;
  }, [currentUserName, currentUserAvatar, participants, userAvatar, userName, userIsAiAssistant]);

  const participantsLabel =
    allMembers.length > 0
      ? `参与会话者（共 ${allMembers.length} 人），点击查看成员`
      : '参与会话者';

  return (
    <header
      className={cn('absolute left-2.5 right-2.5 top-0 z-20 flex flex-col', className)}
      aria-label="会话标题"
    >
      {/* 顶栏：边框、圆角 full、背景毛玻璃 */}
      <div
        className={cn(
          'flex h-[40px] shrink-0 items-center justify-between gap-2 rounded-2xl border-2 border-border bg-white/70 px-[6px] backdrop-blur-md dark:bg-zinc-900/70'
        )}
      >
        {/* 左侧：coss 堆叠头像，含“我”与所有成员（含机器人） */}
        <button
          type="button"
          className="flex items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
          aria-label={participantsLabel}
          title={participantsLabel}
          onClick={() => onOpenMembers?.()}
        >
          {allMembers.length > 0 ? (
            <AvatarStack
              items={allMembers}
              max={MAX_PARTICIPANT_AVATARS}
              size="sm"
            />
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-muted dark:border-zinc-800"
              aria-hidden
            >
              {userAvatar ? (
                <Avatar className="h-full w-full">
                  <AvatarImage src={userAvatar} alt="" />
                  <AvatarFallback className="text-xs font-medium">{userName?.trim().slice(0, 1)?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
              ) : userIsAiAssistant ? (
                <span className="flex h-full w-full items-center justify-center">
                  <AiAssistantAvatarIcon className="h-4 w-4" />
                </span>
              ) : (
                <Avatar className="h-full w-full">
                  <AvatarFallback className="text-xs font-medium">
                    {userName?.trim().slice(0, 1)?.toUpperCase() ?? <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                  </AvatarFallback>
                </Avatar>
              )}
            </span>
          )}
        </button>
        {/* 右侧：语音 / 视频通话 + 菜单 */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
            aria-label="语音通话"
            title="语音通话"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
            aria-label="视频通话"
            title="视频通话"
          >
            <Video className="h-3.5 w-3.5" />
          </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-0 overflow-hidden rounded-full py-0.5 pl-1.5 pr-1 text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
            aria-label={`聊天会话菜单：${title}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
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
        <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="min-w-[10rem] text-[12px]">
          <DropdownMenuItem className="gap-2 text-[12px]" onSelect={() => { closeMenu(); onOpenMembers?.(); }}>
            <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
            会话成员
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-[12px]" onSelect={() => { closeMenu(); onRename?.(); }}>
            <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" />
            重命名会话
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-[12px]" onSelect={() => { closeMenu(); onShare?.(); }}>
            <Share2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
            分享此会话
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-[12px]" onSelect={() => { closeMenu(); onCopyLink?.(); }}>
            <Link className="h-3.5 w-3.5 shrink-0 opacity-70" />
            复制会话链接
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-[12px]" onSelect={() => { closeMenu(); onClose?.(); }}>
            <X className="h-3.5 w-3.5 shrink-0 opacity-70" />
            关闭会话
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-[12px]">
              <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
              导出为…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="text-[12px]">
              <DropdownMenuItem className="text-[12px]" onSelect={() => { closeMenu(); onExportScreen?.(); }}>
                当前屏
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[12px]" onSelect={() => { closeMenu(); onExportScreenshot?.(); }}>
                长屏截图
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[12px]" onSelect={() => { closeMenu(); onExportMarkdown?.(); }}>
                导出 Markdown
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {onLeave != null ? (
            <DropdownMenuItem
              className="gap-2 text-[12px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 focus:text-red-600 dark:focus:text-red-400 data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-900/20 data-[highlighted]:text-red-600 dark:data-[highlighted]:text-red-400"
              onSelect={() => { closeMenu(); onLeave(); }}
            >
              <X className="h-3.5 w-3.5 shrink-0 opacity-80" />
              离开会话
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="gap-2 text-[12px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 focus:text-red-600 dark:focus:text-red-400 data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-900/20 data-[highlighted]:text-red-600 dark:data-[highlighted]:text-red-400"
              onSelect={() => { closeMenu(); onDelete?.(); }}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
              删除会话
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
