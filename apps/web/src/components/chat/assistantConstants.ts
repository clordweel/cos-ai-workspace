/**
 * AI 助手消息相关常量与工具：流式占位 ID、展示名、阶段文案、内容是否未成形、发送者是否助手
 * 供 MessageTile、store、Space、ChatHeader 等统一使用，避免魔法字符串与重复判断
 */

/** 流式回复占位消息 id：首字到达前「正在思考」 */
export const ASSISTANT_WAITING_ID = '__waiting__';
/** 流式回复占位消息 id：正在输出 delta */
export const ASSISTANT_STREAMING_ID = '__streaming__';

/** 助手展示名（列表、顶栏、气泡来源） */
export const AI_ASSISTANT_LABEL = 'AI 助手';

export function isAssistantWaitingId(id: string | undefined): boolean {
  return id === ASSISTANT_WAITING_ID;
}

export function isAssistantStreamingId(id: string | undefined): boolean {
  return id === ASSISTANT_STREAMING_ID;
}

/** 是否为流式占位（等待或输出中） */
export function isAssistantStreamingPlaceholder(id: string | undefined): boolean {
  return id === ASSISTANT_WAITING_ID || id === ASSISTANT_STREAMING_ID;
}

/** 发送者 userId 是否为内置 AI 助手（如 @ai-assistant） */
export function isAiAssistantSender(senderId: string | null | undefined): boolean {
  if (senderId == null) return true;
  return senderId.toLowerCase().includes('ai-assistant');
}

/** 流式内容是否「未成形」：空、仅 <、或未闭合标签，避免展示裸 < + 光标 */
export function isStreamingContentIncomplete(content: string | undefined): boolean {
  if (content == null) return true;
  const t = content.trim();
  if (t.length === 0) return true;
  if (t === '<') return true;
  if (/^\s*<[^>]*\s*$/.test(t)) return true;
  return false;
}

export type StreamPhaseForLabel = 'idle' | 'connecting' | 'thinking' | 'streaming' | 'completed' | 'error';

/** 流阶段 → 输入区上方展示文案（与 streamPhaseMachine 状态一致） */
export function getStreamPhaseLabel(phase: string | undefined): string | null {
  switch (phase) {
    case 'thinking':
      return '思考中…';
    case 'connecting':
      return '连接中…';
    case 'streaming':
      return '回复中…';
    default:
      return null;
  }
}
