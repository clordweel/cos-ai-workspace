/**
 * Mock 会话与消息：从共享包 @cosai/mock 获取；另增全场景 Element 调试会话。
 */

import {
  getSessionList,
  getMessages,
  type MockSessionItem,
  type MockMessage,
} from '@cosai/mock';
import type { ChatMessageItem } from '@/components/chat/chatMessageTypes';
import {
  FULL_SCENARIO_SESSION_ID,
  FULL_SCENARIO_MESSAGES,
  type FullScenarioMessage,
} from './mockMessagesFullScenario';

/** 会话列表：共享 mock + 全场景 Element 调试会话 */
export const MOCK_SESSION_LIST: MockSessionItem[] = [
  ...getSessionList(),
  {
    id: FULL_SCENARIO_SESSION_ID,
    title: '【调试】全场景 Element',
    type: 'private' as const,
    updatedAt: Date.now(),
    participants: [{ name: 'AI 助手', kind: 'bot' as const }],
  },
];

export type { MockSessionItem };

/** 聊天栏展示用消息：仅 user/assistant，含 id/role/content/createdAt（兼容 ChatMessageItem 子集） */
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

/** 将 MockMessage 转为 ChatMessageItem（保留已读/来源/反应/编辑/状态等） */
function toChatMessageItem(m: MockMessage): ChatMessageItem | null {
  if (m.role === 'system')
    return { id: m.id, role: 'system', content: m.content, createdAt: m.createdAt };
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    readBy: m.readBy,
    sources: m.sources,
    thinking: m.thinking,
    reactions: m.reactions,
    editedAt: m.editedAt,
    editedBy: m.editedBy,
    contentChunks: m.contentChunks,
    receiptStatus: m.receiptStatus,
    editableByCurrentUser: m.editableByCurrentUser,
  };
}

/** 全场景消息转为 ChatMessageItem */
function fullScenarioToItem(m: FullScenarioMessage): ChatMessageItem {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    readBy: m.readBy,
    sources: m.sources,
    thinking: m.thinking,
    reactions: m.reactions,
    editedAt: m.editedAt,
    editedBy: m.editedBy,
    contentChunks: m.contentChunks,
    receiptStatus: m.receiptStatus,
    editableByCurrentUser: m.editableByCurrentUser,
    replyToId: m.replyToId,
  };
}

/** 按会话 id 返回该会话的 mock 消息（ChatMessageItem[]，全场景会话含完整 Element 字段） */
export function getMockMessagesForSession(sessionId: string): ChatMessageItem[] {
  if (sessionId === FULL_SCENARIO_SESSION_ID) {
    return [...FULL_SCENARIO_MESSAGES].map(fullScenarioToItem);
  }
  const raw = getMessages(sessionId);
  const list = raw.map(toChatMessageItem).filter((m): m is ChatMessageItem => m != null);
  return list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}
