/**
 * 按房间维度的消息存储，供 useMessages 与 useMatrixSyncClient 共用（阶段 4.2）
 * 可订阅，便于 useSyncExternalStore 在任意房间更新时重算当前房间快照
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Matrix formatted_body（HTML），有则优先用于渲染 */
  formattedContent?: string;
  thinking?: string;
  backendMessageId?: string;
  createdAt?: number;
  /** Matrix 发送者 userId（对侧消息有，用于解析显示名；流式占位无） */
  senderId?: string;
}

const messagesByRoom: Record<string, Message[]> = {};
const listeners = new Set<() => void>();

/** 空房间时返回的稳定引用，避免 useSyncExternalStore 的 getSnapshot 每次返回新 [] 导致无限重渲染 */
const EMPTY_MESSAGES: Message[] = [];

function notify() {
  listeners.forEach((f) => f());
}

export function getMessages(roomId: string): Message[] {
  const list = messagesByRoom[roomId];
  return list !== undefined ? list : EMPTY_MESSAGES;
}

export function setMessages(roomId: string, msgs: Message[]): void {
  if (!roomId) return;
  messagesByRoom[roomId] = [...msgs];
  notify();
}

export function appendMessage(roomId: string, msg: Message): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  messagesByRoom[roomId] = [...list, msg];
  notify();
}

/** 从后往前找第一条 role+content（trim 比较）一致且在 recentMs 内的消息，用 realId 替换其 id 并返回 true；否则返回 false（供 Sync 去重，避免重复追加） */
export function replaceLastMessageIdIfMatch(
  roomId: string,
  content: string,
  role: 'user' | 'assistant',
  realId: string,
  recentMs: number = 15000
): boolean {
  if (!roomId) return false;
  const list = messagesByRoom[roomId] ?? [];
  const now = Date.now();
  const contentTrim = (content ?? '').trim();
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]!;
    if (m.role !== role || (m.content ?? '').trim() !== contentTrim) continue;
    const created = typeof m.createdAt === 'number' ? m.createdAt : 0;
    if (now - created > recentMs) break;
    const next = [...list];
    next[i] = { ...m, id: realId };
    messagesByRoom[roomId] = next;
    notify();
    return true;
  }
  return false;
}

/** 在 @AI 助手 发送后、首字到达前显示「正在思考…」占位，避免长时间无反馈 */
export function appendWaitingAssistant(roomId: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && last.id === '__waiting__') return;
  messagesByRoom[roomId] = [...list, { id: '__waiting__', role: 'assistant' as const, content: '', createdAt: Date.now() }];
  notify();
}

export function appendStreamingContent(roomId: string, delta: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && last.id === '__streaming__') {
    messagesByRoom[roomId] = [...list.slice(0, -1), { ...last, content: (last.content || '') + delta }];
  } else if (last?.role === 'assistant' && last.id === '__waiting__') {
    messagesByRoom[roomId] = [...list.slice(0, -1), { id: '__streaming__', role: 'assistant' as const, content: delta }];
  } else {
    messagesByRoom[roomId] = [...list, { id: '__streaming__', role: 'assistant' as const, content: delta }];
  }
  notify();
}

export function commitStreamingMessage(roomId: string, finalContent: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && last.id === '__waiting__') {
    messagesByRoom[roomId] = list.slice(0, -1);
    notify();
    if ((finalContent ?? '').trim() !== '') {
      messagesByRoom[roomId] = [...messagesByRoom[roomId]!, { id: `msg-${Date.now()}`, role: 'assistant' as const, content: finalContent, createdAt: Date.now() }];
      notify();
    }
    return;
  }
  if (last?.role === 'assistant' && last.id === '__streaming__') {
    if ((finalContent ?? '').trim() === '') {
      messagesByRoom[roomId] = list.slice(0, -1);
    } else {
      messagesByRoom[roomId] = [...list.slice(0, -1), { ...last, id: `msg-${Date.now()}`, content: finalContent }];
    }
    notify();
    return;
  }
  if (last?.role === 'assistant' && (finalContent ?? '').trim() !== '' && (last.content ?? '').trim() === (finalContent ?? '').trim()) {
    return;
  }
  if ((finalContent ?? '').trim() !== '') {
    messagesByRoom[roomId] = [...list, { id: `msg-${Date.now()}`, role: 'assistant' as const, content: finalContent, createdAt: Date.now() }];
    notify();
  }
}

export function discardStreamingMessage(roomId: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && (last.id === '__streaming__' || last.id === '__waiting__')) {
    messagesByRoom[roomId] = list.slice(0, -1);
    notify();
  }
}

/** 若最后一条为 __streaming__ 或 __waiting__，用 Sync 收到的真实消息替换，避免重复显示；返回是否已替换 */
export function replaceStreamingWithMessage(roomId: string, msg: Message): boolean {
  if (!roomId) return false;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role !== 'assistant' || (last.id !== '__streaming__' && last.id !== '__waiting__')) return false;
  messagesByRoom[roomId] = [...list.slice(0, -1), { ...msg, id: msg.id ?? msg.backendMessageId }];
  notify();
  return true;
}

/** 将当前房间最后一条消息的 id 设为 newId（用于 Sync 去重：同内容时只更新 id 不追加） */
export function setLastMessageId(roomId: string, newId: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  if (list.length === 0) return;
  const last = list[list.length - 1]!;
  messagesByRoom[roomId] = [...list.slice(0, -1), { ...last, id: newId }];
  notify();
}
/** 简单去掉 Markdown 符号得到可比较的纯文本（与 API markdownToPlain 一致，用于去重比较） */
function stripMarkdownForCompare(s: string): string {
  return (s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}
/** 若最后一条为本端占位用户消息（id 以 u- 开头）且与 Sync 的 body（纯文本）内容一致（去 Markdown 后比较），则用 Sync 的 id/formattedContent 替换并返回 true，避免重复显示 */
export function replaceLastUserMessageIfMatch(
  roomId: string,
  bodyStr: string,
  eventId: string,
  formattedContent?: string,
  recentMs: number = 15000
): boolean {
  if (!roomId) return false;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role !== 'user') return false;
  const id = last.id ?? '';
  if (!id.startsWith('u-')) return false;
  const created = typeof last.createdAt === 'number' ? last.createdAt : 0;
  if (Date.now() - created > recentMs) return false;
  const plainLast = stripMarkdownForCompare(last.content);
  const plainBody = (bodyStr ?? '').trim();
  if (plainLast !== plainBody) return false;
  messagesByRoom[roomId] = [
    ...list.slice(0, -1),
    { ...last, id: eventId, backendMessageId: eventId, formattedContent, createdAt: created },
  ];
  notify();
  return true;
}

/** 供 useSyncExternalStore 使用：订阅任意房间变更 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 供 useSyncExternalStore 使用：当前房间快照 */
export function getSnapshot(roomId: string): Message[] {
  return getMessages(roomId);
}
