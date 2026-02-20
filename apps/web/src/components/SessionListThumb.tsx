'use client';

import { MessageCircle, Sparkle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiAssistantAvatarIcon } from '@/components/icons/AiAssistantAvatarIcon';

export type SessionParticipant = {
  name: string;
  avatar?: string;
  kind?: 'user' | 'bot';
  /** Matrix userId 等，用于识别 @ai-assistant 前缀的机器人以使用占位头像 */
  id?: string;
};

const THUMB_SIZE = 'h-8 w-8';
const THUMB_BASE = 'flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300';

function SingleAvatar({
  participant,
  title,
  className,
}: {
  participant: SessionParticipant;
  title?: string;
  className?: string;
}) {
  const firstChar = participant?.name?.trim?.()?.charAt(0)?.toUpperCase() ?? '?';
  const isAiAssistantNoAvatar =
    !participant?.avatar &&
    (title === 'AI 助手' ||
      participant?.name === 'AI 助手' ||
      (participant?.kind === 'bot' && participant?.id?.toLowerCase().includes('ai-assistant')));

  return (
    <span className={cn(THUMB_SIZE, THUMB_BASE, className)}>
      {participant.avatar ? (
        <img src={participant.avatar} alt={participant.name} className="h-full w-full object-cover" />
      ) : isAiAssistantNoAvatar ? (
        <span className="flex h-full w-full items-center justify-center">
          <AiAssistantAvatarIcon className="h-5 w-5" />
        </span>
      ) : participant.kind === 'bot' ? (
        <Sparkle className="h-4 w-4" />
      ) : (
        <span className="text-xs font-medium">{firstChar}</span>
      )}
    </span>
  );
}

/** 2x2 网格最多 4 个头像 */
function GridAvatars({ participants, title }: { participants: SessionParticipant[]; title?: string }) {
  const list = participants.slice(0, 4);
  return (
    <span
      className={cn(
        THUMB_SIZE,
        'grid shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-500'
      )}
    >
      {list.map((p, i) => (
        <span key={i} className="flex items-center justify-center overflow-hidden bg-zinc-100 dark:bg-zinc-600">
          {p.avatar ? (
            <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" />
          ) : p.kind === 'bot' && (p.id?.toLowerCase().includes('ai-assistant') || p.name === 'AI 助手') ? (
            <AiAssistantAvatarIcon className="h-3 w-3" />
          ) : (
            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
              {p.name?.trim?.()?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function SessionListThumb({
  type,
  participants = [],
  title,
  className,
}: {
  type: 'private' | 'group';
  participants?: SessionParticipant[];
  /** 会话标题；无 participants 时若为「AI 助手」则用占位图标 */
  title?: string;
  className?: string;
}) {
  const count = participants?.length ?? 0;

  // solo：无对方参与者，展示 solo 标识
  if (count === 0) {
    return (
      <span className={cn(THUMB_SIZE, THUMB_BASE, className)} aria-label="仅自己">
        <MessageCircle className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  // 一对一：对方头像
  if (count === 1) {
    return <SingleAvatar participant={participants[0]!} title={title} className={className} />;
  }

  // 一对多：2x2 网格，最多 4 个对方头像
  return <GridAvatars participants={participants} title={title} />;
}
