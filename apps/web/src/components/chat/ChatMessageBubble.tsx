'use client';

import { cn } from '@/lib/utils';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessageBubble({ message }: { message: ChatMessageItem }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex w-full', isUser ? 'flex-col items-end' : 'flex-col items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-4 py-2.5 text-xs',
          isUser
            ? 'rounded-tr-none bg-primary text-primary-foreground'
            : 'rounded-tl-none bg-[var(--session-frame-panel-bg)] text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
