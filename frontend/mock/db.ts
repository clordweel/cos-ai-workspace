/**
 * Mock 会话数据库：全部从 @cosai/mock 获取，与 apps/web 共用同一数据源。
 * 仅做 MockMessage → ChatMessage 的映射（含调试全情景的扩展字段）。
 */

import type { ChatMessage } from '~/composables/useChatSessions'
import {
  getSessionList as getSessionListBase,
  getSessionById as getSessionByIdBase,
  getMessages as getMessagesBase,
  MOCK_DEBUG_SESSION_ID,
} from '@cosai/mock'
import type { MockMessage } from '@cosai/mock'

export { MOCK_DEBUG_SESSION_ID }

/** 将共享包消息映射为 frontend ChatMessage（透传全部字段，含调试全情景的 receiptStatus/sources 等） */
function mapMockMessageToChatMessage(m: MockMessage): ChatMessage {
  const msg = { ...m } as ChatMessage
  if (m.role === 'assistant' && !msg.sources) {
    msg.sources = [{ type: 'bot', label: 'AI 助手' }]
  }
  return msg
}

export function getSessionList() {
  return getSessionListBase()
}

export function getSessionById(id: string) {
  return getSessionByIdBase(id)
}

export function getMessages(sessionId: string): ChatMessage[] {
  return getMessagesBase(sessionId).map(mapMockMessageToChatMessage)
}
