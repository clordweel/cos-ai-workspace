import type { ChatMessageItem } from '@/components/chat/chatMessageTypes';
import type { ChatDisplayItem } from '@/components/chat/ChatPane';
import { formatDateLabel } from '@/lib/time';

/** 为消息列表插入日期分隔项（按日分组），与 Element 风格一致；消息完整透传以支持已读/反应/编辑等 */
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
    out.push({ type: 'message', message: msg });
  }
  return out;
}
