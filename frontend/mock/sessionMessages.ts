/**
 * Mock 会话消息：从 mock 数据库读取（@faker-js/faker 生成）。
 */

import type { ChatMessage } from '~/composables/useChatSessions'
import { getMessages } from './db'

export function getMockSessionMessages(sessionId: string): ChatMessage[] {
  return getMessages(sessionId)
}
