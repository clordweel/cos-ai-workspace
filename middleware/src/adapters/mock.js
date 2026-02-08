/**
 * Mock 聊天后端适配器：用于功能调试与自动化测试
 * 无外部依赖，返回固定或可预测数据，流式回复为模拟逐字输出
 */

const MOCK_SESSIONS = [
  { id: 'mock-session-1', title: 'Mock 会话一', updatedAt: Date.now() - 3600_000, backendSessionId: 'mock-session-1', provider: 'mock' },
  { id: 'mock-session-2', title: 'Mock 会话二', updatedAt: Date.now() - 7200_000, backendSessionId: 'mock-session-2', provider: 'mock' },
]

const MOCK_MESSAGES_BY_SESSION = new Map([
  ['mock-session-1', [
    { id: 'm1', role: 'user', content: '你好', backendMessageId: 'm1', createdAt: Date.now() - 3600_000 },
    { id: 'm2', role: 'assistant', content: '你好！这是 Mock 适配器的回复。', backendMessageId: 'm2', createdAt: Date.now() - 3600_000 + 1000 },
  ]],
  ['mock-session-2', [
    { id: 'm3', role: 'user', content: '测试', backendMessageId: 'm3', createdAt: Date.now() - 7200_000 },
    { id: 'm4', role: 'assistant', content: '收到测试消息。', backendMessageId: 'm4', createdAt: Date.now() - 7200_000 + 500 },
  ]],
])

/** 模拟流式输出：将回复按字或按块通过 send('message', { delta }) 发送，最后 message_end */
function streamEcho(send, flush, text, chunkSize = 1, delayMs = 20) {
  return new Promise((resolve) => {
    let i = 0
    const tick = () => {
      if (i >= text.length) {
        send('message_end', { conversation_id: 'mock-conversation-' + Date.now(), message_id: 'mock-msg-' + Date.now() })
        flush()
        resolve()
        return
      }
      const chunk = text.slice(i, i + chunkSize)
      i += chunkSize
      send('message', { delta: chunk })
      flush()
      setTimeout(tick, delayMs)
    }
    tick()
  })
}

/**
 * 创建 Mock 适配器实例（无配置依赖）
 * @returns {Object} 实现 ChatBackendAdapter 契约的 Mock 适配器
 */
export function createMockAdapter() {
  return {
    name: 'mock',

    supportsStreaming() {
      return true
    },

    supportsListSessions() {
      return true
    },

    supportsListMessages() {
      return true
    },

    async streamMessage({ message, send, flush }) {
      send('status', { status: 'thinking' })
      flush()
      const reply = `[Mock] 收到：${message}`
      await streamEcho(send, flush, reply)
    },

    async listSessions() {
      return [...MOCK_SESSIONS]
    },

    async listMessages({ sessionId, backendSessionId, limit = 50 }) {
      const id = backendSessionId || sessionId
      const list = MOCK_MESSAGES_BY_SESSION.get(id) || []
      return list.slice(-Math.min(Number(limit) || 20, 100))
    },
  }
}
