/**
 * Mock 会话 Composable：统一开关、列表、消息与注入逻辑。
 * 数据来自 ~/mock，可独立替换为专业 mock 库（如 @faker-js/faker、msw）。
 */

import type { ChatMessage } from '~/composables/useChatSessions'
import {
  getMockSessionById as getById,
  getMockSessionMessages as getMessagesForSession,
  mockSessionList,
} from '~/mock'

/** 是否启用 mock 会话列表（仿真演示）。设为 false 则仅显示真实会话。 */
export const MOCK_SESSION_LIST_ENABLED = true

export function isMockSession(id: string): boolean {
  return id.startsWith('mock-')
}

export function getMockSessionList() {
  return mockSessionList
}

export function getMockSessionById(id: string) {
  return getById(id)
}

export function getMockSessionMessages(sessionId: string): ChatMessage[] {
  return getMessagesForSession(sessionId)
}

/**
 * 为所有 mock 会话注入演示消息（仅当该会话当前无消息时）。
 * 用于列表预览与打开会话后的消息流。
 */
export function seedMockMessages(
  getMessages: (id: string) => ChatMessage[],
  setMessages: (id: string, list: ChatMessage[]) => void,
): void {
  for (const session of mockSessionList) {
    if (getMessages(session.id).length === 0) {
      const msgs = getMockSessionMessages(session.id)
      if (msgs.length > 0) setMessages(session.id, msgs)
    }
  }
}
