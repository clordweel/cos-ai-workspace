import type { ChatMessageItem } from '@/components/chat/chatMessageTypes';
import type { ChatDisplayItem } from '@/components/chat/ChatPane';
import { parseMessageBodyToSegments, ASSOC_OPEN } from '@/types/messageSegments';
import type { MessageSegment } from '@/types/messageSegments';
import { formatDateLabel } from '@/lib/time';

/** 为消息列表插入日期分隔项（按日分组）；含 ASSOC 的消息按段拆成多条，ASSOC 每条独占一条 */
export function buildChatDisplayItems(messages: ChatMessageItem[]): ChatDisplayItem[] {
  const out: ChatDisplayItem[] = [];
  let lastDateLabel: string | null = null;
  for (const msg of messages) {
    const ts = msg.createdAt ?? Date.now();
    const label = formatDateLabel(ts);
    if (label !== lastDateLabel) {
      out.push({ type: 'date', label });
      lastDateLabel = label;
    }
    const content = msg.content ?? '';
    const segments = parseMessageBodyToSegments(content);
    const hasAssoc = segments.some((s) => s.type === 'association') || content.includes(ASSOC_OPEN);
    if (!hasAssoc || segments.length === 0) {
      out.push({ type: 'message', message: msg });
      continue;
    }
    const visibleSegments = segments.filter(
      (s) => s.type === 'association' || (s.type === 'text' && s.content.trim().length > 0)
    );
    if (visibleSegments.length === 0) {
      out.push({ type: 'message', message: msg });
      continue;
    }
    visibleSegments.forEach((segment, i) => {
      out.push({
        type: 'messageSegment',
        message: msg,
        segment,
        segmentIndex: i,
        isFirstSegment: i === 0,
        isLastSegment: i === visibleSegments.length - 1,
      });
    });
  }
  return out;
}
