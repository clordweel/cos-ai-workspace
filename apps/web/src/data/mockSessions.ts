/**
 * Mock 会话与消息：从共享包 @cosai/mock 获取，与 frontend 共用同一数据源。
 */

import {
  getSessionList,
  getMessages,
  type MockSessionItem,
  type MockMessage,
} from '@cosai/mock';

/** 会话列表（与 frontend mock 一致） */
export const MOCK_SESSION_LIST: MockSessionItem[] = getSessionList();

export type { MockSessionItem };

/** 聊天栏展示用消息：仅 user/assistant，含 id/role/content/createdAt */
export interface MockChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

function toChatMessage(m: MockMessage): MockChatMessage | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  };
}

/** 按会话 id 返回该会话的 mock 消息（仅 user/assistant），用于聊天栏展示 */
export function getMockMessagesForSession(sessionId: string): MockChatMessage[] {
  const list = getMessages(sessionId)
    .map(toChatMessage)
    .filter((m): m is MockChatMessage => m != null);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}
