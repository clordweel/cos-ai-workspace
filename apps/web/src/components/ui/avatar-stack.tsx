'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** 单条用于堆叠展示的用户信息（与 coss Group Avatars 一致） */
export interface AvatarStackItem {
  id?: string;
  name?: string | null;
  avatar?: string | null;
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
  sm: 'h-7 w-7',
  default: 'h-8 w-8',
  lg: 'h-10 w-10',
};

/** 堆叠头像（与 coss Group Avatars 一致：-space-x-2 + ring 分隔） */
export function AvatarStack({ items, max = 4, size = 'sm', className }: AvatarStackProps) {
  const display = items.slice(0, max);
  const overflow = items.length > max ? items.length - max : 0;
  const sizeClass = sizeClasses[size];

  if (display.length === 0) {
    return null;
  }

  return (
    <span
      className={cn('flex items-center', size === 'sm' && '-space-x-2', size === 'default' && '-space-x-2', size === 'lg' && '-space-x-3', className)}
      role="img"
      aria-label={items.length > 0 ? `共 ${items.length} 人` : undefined}
    >
      {display.map((item, i) => (
        <Avatar
          key={item.id ?? i}
          className={cn(
            sizeClass,
            'shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-600',
            i > 0 && 'ring-2 ring-white dark:ring-zinc-800'
          )}
        >
          {item.avatar ? <AvatarImage src={item.avatar} alt="" /> : null}
          <AvatarFallback className="text-xs font-medium text-muted-foreground bg-zinc-100 dark:bg-zinc-600">
            {item.name?.trim().slice(0, 1)?.toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-medium text-muted-foreground dark:border-zinc-800 dark:bg-zinc-700',
            sizeClass,
            size === 'sm' && '-ml-2',
            size === 'default' && '-ml-2',
            size === 'lg' && '-ml-3'
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
