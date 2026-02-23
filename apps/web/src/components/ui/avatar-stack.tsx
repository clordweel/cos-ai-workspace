'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AiAssistantAvatarIcon } from '@/components/icons/AiAssistantAvatarIcon';
import { cn } from '@/lib/utils';
import { AI_ASSISTANT_LABEL, isAiAssistantSender } from '@/components/chat/assistantConstants';

/** 单条用于堆叠展示的用户信息（与 coss Group Avatars 一致） */
export interface AvatarStackItem {
  id?: string;
  name?: string | null;
  avatar?: string | null;
  /** 为 bot 且为 AI 助手（见 assistantConstants）时，头像为空则用占位图标 */
  kind?: 'user' | 'bot';
}

export interface AvatarStackProps {
  /** 用户列表，超出 max 的以 +N 展示 */
  items: AvatarStackItem[];
  /** 最多展示的头像数量，默认 4 */
  max?: number;
  /** 头像尺寸：sm=28px, default=32px, lg=40px */
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  default: 'h-7 w-7',
  lg: 'h-9 w-9',
};

/** 堆叠头像（与 coss Group Avatars 一致：统一由外层描边，成员与机器人 border 一致） */
const ringOffset = { sm: '-space-x-1.5', default: '-space-x-2', lg: '-space-x-2.5' };
const iconSizes = { sm: 'h-3.5 w-3.5', default: 'h-4 w-4', lg: 'h-5 w-5' };

export function AvatarStack({ items, max = 4, size = 'sm', className }: AvatarStackProps) {
  const display = items.slice(0, max);
  const overflow = items.length > max ? items.length - max : 0;
  const sizeClass = sizeClasses[size];

  if (display.length === 0) {
    return null;
  }

  return (
    <span
      className={cn('flex items-center', ringOffset[size], className)}
      role="img"
      aria-label={items.length > 0 ? `共 ${items.length} 人` : undefined}
    >
      {display.map((item, i) => {
        const isAiAssistantBot = !item.avatar && item.kind === 'bot' && (item.id ? isAiAssistantSender(item.id) : item.name === AI_ASSISTANT_LABEL);
        return (
          <span
            key={item.id ?? i}
            className={cn(
              sizeClass,
              'flex shrink-0 overflow-hidden rounded-full border border-white bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-600',
              i > 0 && 'ring-1 ring-white dark:ring-zinc-800'
            )}
          >
            {item.avatar ? (
              <Avatar className={cn(sizeClass, 'h-full w-full border-0')}>
                <AvatarImage src={item.avatar} alt="" />
                <AvatarFallback className="text-xs font-medium text-muted-foreground bg-zinc-100 dark:bg-zinc-600">
                  {item.name?.trim().slice(0, 1)?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            ) : isAiAssistantBot ? (
              <span className="flex h-full w-full items-center justify-center">
                <AiAssistantAvatarIcon className={iconSizes[size]} />
              </span>
            ) : (
              <Avatar className={cn(sizeClass, 'h-full w-full border-0')}>
                <AvatarFallback className="text-xs font-medium text-muted-foreground bg-zinc-100 dark:bg-zinc-600">
                  {item.name?.trim().slice(0, 1)?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            )}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border border-white bg-zinc-100 text-[10px] font-medium text-muted-foreground dark:border-zinc-800 dark:bg-zinc-700',
            sizeClass,
            size === 'sm' && '-ml-1.5',
            size === 'default' && '-ml-2',
            size === 'lg' && '-ml-2.5'
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
