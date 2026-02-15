/**
 * 按房间维度的消息存储，供 useMessages 与 useMatrixSyncClient 共用（阶段 4.2）
 * 可订阅，便于 useSyncExternalStore 在任意房间更新时重算当前房间快照
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  backendMessageId?: string;
  createdAt?: number;
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

export function appendStreamingContent(roomId: string, delta: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && last.id === '__streaming__') {
    messagesByRoom[roomId] = [...list.slice(0, -1), { ...last, content: (last.content || '') + delta }];
  } else {
    messagesByRoom[roomId] = [...list, { id: '__streaming__', role: 'assistant' as const, content: delta }];
  }
  notify();
}

export function commitStreamingMessage(roomId: string, finalContent: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && last.id === '__streaming__') {
    messagesByRoom[roomId] = [...list.slice(0, -1), { ...last, id: `msg-${Date.now()}`, content: finalContent }];
  } else {
    messagesByRoom[roomId] = [...list, { id: `msg-${Date.now()}`, role: 'assistant' as const, content: finalContent, createdAt: Date.now() }];
  }
  notify();
}

export function discardStreamingMessage(roomId: string): void {
  if (!roomId) return;
  const list = messagesByRoom[roomId] ?? [];
  const last = list[list.length - 1];
  if (last?.role === 'assistant' && last.id === '__streaming__') {
    messagesByRoom[roomId] = list.slice(0, -1);
    notify();
  }
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
