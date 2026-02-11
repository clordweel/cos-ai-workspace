/**
 * 会话/消息标准化 API 对接（GET /api/sessions、GET /api/sessions/:id/messages）
 * 可选、渐进：拉取后合并到 useChatSessions，当前后端不支持时静默降级
 */
import type { ChatMessage } from '~/composables/useChatSessions'

/** 中间层返回的标准化会话 */
export interface ApiSession {
  id: string
  title: string
  updatedAt: number
  backendSessionId?: string
  provider?: string
}

/** 中间层返回的标准化消息 */
export interface ApiMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  backendMessageId?: string
  createdAt?: number
}

function apiMessageToChatMessage(m: ApiMessage): ChatMessage {
  return {
    role: m.role,
    content: m.content,
    thinking: m.thinking,
    id: m.id ?? m.backendMessageId,
  }
}

export function useChatSessionsApi() {
  const apiBase = useApiBase()
  const {
    ensureChat,
    setChatUpdatedAt,
    setConversationId,
    setMessages,
  } = useChatSessions()

  /**
   * 拉取会话列表并合并到当前会话状态
   * @param userId - 与中间层 user_id 一致；不传时用当前登录用户 id（多用户隔离），未登录为 'default'
   * @returns 是否成功（501/502 时为 false，不抛错）
   */
  async function loadSessions(userId?: string): Promise<boolean> {
    const uid = (userId ?? (useAuth().userId as { value?: string })?.value) || 'default'
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return false
    try {
      const res = await fetch(
        `${base}/api/sessions?user_id=${encodeURIComponent(uid)}`,
        { credentials: 'include' },
      )
      if (res.status === 401) return false
      if (res.status === 501 || res.status === 502) return false
      if (!res.ok) return false
      const json = (await res.json()) as { sessions?: ApiSession[] }
      const sessions = json.sessions ?? []
      for (const s of sessions) {
        ensureChat(s.id, s.title)
        setChatUpdatedAt(s.id, s.updatedAt)
        setConversationId(s.id, s.backendSessionId ?? s.id)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * 拉取某会话历史消息并写入当前状态
   * @param sessionId - 会话 id（与 GET :id 一致，如 Dify 的 conversation_id）
   * @param userId - 不传时用当前登录用户 id，未登录为 'default'
   * @param limit - 条数，默认 50
   * @returns 是否成功
   */
  async function loadSessionMessages(
    sessionId: string,
    userId?: string,
    limit = 50,
  ): Promise<boolean> {
    const uid = (userId ?? (useAuth().userId as { value?: string })?.value) || 'default'
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return false
    try {
      const res = await fetch(
        `${base}/api/sessions/${encodeURIComponent(sessionId)}/messages?user_id=${encodeURIComponent(uid)}&limit=${limit}`,
        { credentials: 'include' },
      )
      if (res.status === 401) return false
      if (res.status === 501 || res.status === 502) return false
      if (!res.ok) return false
      const json = (await res.json()) as { messages?: ApiMessage[] }
      const messages = (json.messages ?? []).map(apiMessageToChatMessage)
      setMessages(sessionId, messages)
      return true
    } catch {
      return false
    }
  }

  return {
    loadSessions,
    loadSessionMessages,
  }
}
