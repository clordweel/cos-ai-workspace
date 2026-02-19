'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

export interface InvitedSessionRowProps {
  roomId: string;
  name?: string;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
  declining?: boolean;
  className?: string;
}

export function InvitedSessionRow({
  roomId,
  name,
  onAccept,
  onDecline,
  accepting = false,
  declining = false,
  className,
}: InvitedSessionRowProps) {
  const title = (name || roomId).trim() || '未命名会话';
  return (
    <li
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-left border-b border-zinc-100 dark:border-zinc-700 last:border-0',
        className
      )}
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground" title={roomId}>
        {title}
      </span>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-primary"
          onClick={onAccept}
          disabled={accepting || declining}
          aria-label="接受邀请"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {accepting ? '加入中…' : '接受'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={onDecline}
          disabled={accepting || declining}
          aria-label="拒绝邀请"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          拒绝
        </Button>
      </div>
    </li>
  );
}
