import type { ChatMessageItem } from '@/components/chat/ChatMessageBubble';
import type { ChatDisplayItem } from '@/components/chat/ChatPane';

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 为消息列表插入日期分隔项（按日分组），与 frontend displayItems 结构一致 */
export function buildChatDisplayItems(
  messages: Array<ChatMessageItem & { createdAt?: number }>
): ChatDisplayItem[] {
  const out: ChatDisplayItem[] = [];
  let lastDateLabel: string | null = null;
  for (const msg of messages) {
    const ts = msg.createdAt ?? Date.now();
    const label = formatDateLabel(ts);
    if (label !== lastDateLabel) {
      out.push({ type: 'date', label });
      lastDateLabel = label;
    }
    out.push({ type: 'message', message: { id: msg.id, role: msg.role, content: msg.content } });
  }
  return out;
}
