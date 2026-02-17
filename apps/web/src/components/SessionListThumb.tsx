'use client';

import { Sparkle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SessionParticipant = {
  name: string;
  avatar?: string;
  kind?: 'user' | 'bot';
};

export function SessionListThumb({
  type,
  participants = [],
  className,
}: {
  type: 'private' | 'group';
  participants?: SessionParticipant[];
  className?: string;
}) {
  const first = participants?.[0];
  const firstChar = first?.name?.trim?.()?.charAt(0)?.toUpperCase() ?? '?';

  if (type === 'private') {
    return (
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300',
          className
        )}
      >
        {first?.avatar ? (
          <img
            src={first.avatar}
            alt={first.name}
            className="h-full w-full object-cover"
          />
        ) : first?.kind === 'bot' ? (
          <Sparkle className="h-4 w-4" />
        ) : (
          <span className="text-xs font-medium">{firstChar}</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        className
      )}
    >
      <Users className="h-4 w-4" />
    </span>
  );
}
