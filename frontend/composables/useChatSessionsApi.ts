/**
 * 会话/消息标准化 API 对接（GET /api/sessions、GET /api/sessions/:id/messages）
 * 可选、渐进：拉取后合并到 useChatSessions，当前后端不支持时静默降级
 */
import { nextTick } from 'vue'
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
  role: 'user' | 'assistant' | 'system'
  content: string
  formattedBody?: string
  thinking?: string
  backendMessageId?: string
  createdAt?: number
  inReplyTo?: { id: string; role?: 'user' | 'assistant'; content?: string }
}

function apiMessageToChatMessage(m: ApiMessage): ChatMessage {
  return {
    role: m.role,
    content: m.content,
    formattedBody: m.formattedBody,
    thinking: m.thinking,
    id: m.id ?? m.backendMessageId,
    createdAt: m.createdAt,
    inReplyTo: m.inReplyTo,
  }
}

/** 按用户维度仅拉取一次会话列表，避免点击切换会话时重复请求导致列表闪动 */
let lastLoadedUserId: string | null = null
/** 置顶列表同用户仅拉取一次，避免重复请求 /api/sessions/pinned 导致列表闪动 */
let lastPinnedLoadedUserId: string | null = null
let lastPinnedIdsCache: string[] | null = null

export function useChatSessionsApi() {
  const apiBase = useApiBase()
  const {
    ensureChat,
    removeChat,
    setChatUpdatedAt,
    setConversationId,
    setMessages,
  } = useChatSessions()

  /**
   * 拉取会话列表并合并到当前会话状态（同用户同会话周期内仅拉取一次，避免重复请求与列表闪动）
   * @param userId - 与中间层 user_id 一致；不传时用当前登录用户 id（多用户隔离），未登录为 'default'
   * @returns { ok, fetched }：ok 表示是否成功；fetched 表示本次是否真的发过请求（未命中 guard 时才为 true，用于决定是否顺带拉取置顶）
   */
  async function loadSessions(userId?: string): Promise<{ ok: boolean; fetched: boolean }> {
    const uid = (userId ?? (useAuth().userId as { value?: string })?.value) || 'default'
    if (lastLoadedUserId === uid) return { ok: true, fetched: false }
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return { ok: false, fetched: false }
    try {
      const res = await fetch(
        `${base}/api/sessions?user_id=${encodeURIComponent(uid)}`,
        { credentials: 'include' },
      )
      if (res.status === 401) return { ok: false, fetched: false }
      if (res.status === 501 || res.status === 502) return { ok: false, fetched: false }
      if (!res.ok) return { ok: false, fetched: false }
      const json = (await res.json()) as { sessions?: ApiSession[] }
      const sessions = json.sessions ?? []
      const isMatrixRoomId = (id: string) => id.startsWith('!') && id.includes(':')
      for (const s of sessions) {
        // 若后端返回的 title 实为房间 ID（如 getRoomName 失败），用占位名避免列表/顶栏显示 ID
        const title =
          isMatrixRoomId(s.id) && (s.title === s.id || !s.title?.trim())
            ? '会话'
            : (s.title?.trim() || '会话')
        ensureChat(s.id, title)
        setChatUpdatedAt(s.id, s.updatedAt)
        setConversationId(s.id, s.backendSessionId ?? s.id)
      }
      lastLoadedUserId = uid
      return { ok: true, fetched: true }
    } catch {
      return { ok: false, fetched: false }
    }
  }

  /** 强制重新拉取会话列表（如用户主动刷新）；会清除「仅拉取一次」标记（含会话与置顶） */
  async function refreshSessions(userId?: string): Promise<{ ok: boolean; fetched: boolean }> {
    lastLoadedUserId = null
    lastPinnedLoadedUserId = null
    lastPinnedIdsCache = null
    return loadSessions(userId)
  }

  /**
   * 创建新会话（POST /api/sessions）
   * @param title - 可选标题
   * @returns 创建的会话 id，或 null（501/502 时表示不支持/失败）
   */
  async function createSession(title?: string): Promise<string | null> {
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return null
    try {
      const res = await fetch(`${base}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title?.trim() || undefined }),
      })
      if (res.status === 401) {
        useAuth().requireAuth()
        return null
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string }
      if (res.status === 501 || res.status === 502 || !res.ok) {
        const errMsg = json.message || json.error || '创建会话失败，请刷新后重试'
        throw new Error(errMsg)
      }
      return json.id ?? null
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('创建会话失败，请刷新后重试')
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

  /**
   * 重命名会话（Matrix 为更新 room name，mock 为更新 title）
   * @param sessionId - 会话 id
   * @param title - 新标题
   * @returns 是否成功
   */
  async function renameSession(sessionId: string, title: string): Promise<boolean> {
    const trimmed = title?.trim()
    if (!trimmed) return false
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return false
    try {
      const res = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: trimmed }),
      })
      if (res.status === 401) {
        useAuth().requireAuth()
        return false
      }
      if (res.status === 501 || res.status === 502 || !res.ok) return false
      // 放入 nextTick，确保在 Vue 更新周期内写入状态，使聊天栏标题与列表及时更新
      nextTick(() => ensureChat(sessionId, trimmed))
      return true
    } catch {
      return false
    }
  }

  /**
   * 邀请用户加入会话（仅 Matrix 等支持 inviteToSession 的后端有效）
   * @param sessionId - 会话 id
   * @param inviteeUserId - 被邀请者 MXID（如 @user:server）
   * @returns 是否成功
   */
  async function inviteToSession(sessionId: string, inviteeUserId: string): Promise<boolean> {
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base || !inviteeUserId?.trim()) return false
    try {
      const res = await fetch(
        `${base}/api/sessions/${encodeURIComponent(sessionId)}/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ inviteeUserId: inviteeUserId.trim() }),
        }
      )
      if (res.status === 401) {
        useAuth().requireAuth()
        return false
      }
      if (res.status === 501 || res.status === 502 || !res.ok) return false
      return true
    } catch {
      return false
    }
  }

  /**
   * 删除会话（Matrix 为 leave 房间，mock 为移除）
   * @param sessionId - 会话 id
   * @returns 是否成功
   */
  async function deleteSession(sessionId: string): Promise<boolean> {
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return false
    try {
      const res = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.status === 401) {
        useAuth().requireAuth()
        return false
      }
      if (res.status === 501 || res.status === 502 || !res.ok) return false
      removeChat(sessionId)
      return true
    } catch {
      return false
    }
  }

  /**
   * 拉取置顶会话 ID 列表（Matrix 时来自 account_data，否则返回 []）；同用户仅请求一次，避免点击会话时重复拉取导致闪动
   */
  async function fetchPinnedSessions(): Promise<string[]> {
    const uid = (useAuth().userId as { value?: string })?.value ?? 'default'
    if (lastPinnedLoadedUserId === uid && lastPinnedIdsCache !== null) return lastPinnedIdsCache
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return []
    try {
      const res = await fetch(`${base}/api/sessions/pinned`, { credentials: 'include' })
      if (res.status === 401 || res.status === 501 || res.status === 502 || !res.ok) return []
      const json = (await res.json()) as { pinnedRoomIds?: string[] }
      const list = json.pinnedRoomIds ?? []
      const ids = Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []
      lastPinnedLoadedUserId = uid
      lastPinnedIdsCache = ids
      return ids
    } catch {
      return []
    }
  }

  /**
   * 保存置顶会话 ID 列表（仅 Matrix 时写入 account_data）；先乐观更新本地缓存，避免 PUT 完成前 fetch 用旧缓存覆盖前端
   */
  async function setPinnedSessions(pinnedRoomIds: string[]): Promise<void> {
    const uid = (useAuth().userId as { value?: string })?.value ?? 'default'
    lastPinnedLoadedUserId = uid
    lastPinnedIdsCache = pinnedRoomIds
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!base) return
    try {
      const res = await fetch(`${base}/api/sessions/pinned`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pinnedRoomIds }),
      })
      if (res.status === 401 || res.status === 501 || res.status === 502 || !res.ok) {
        lastPinnedIdsCache = null
        lastPinnedLoadedUserId = null
      }
    } catch {
      lastPinnedIdsCache = null
      lastPinnedLoadedUserId = null
    }
  }

  return {
    loadSessions,
    refreshSessions,
    loadSessionMessages,
    createSession,
    inviteToSession,
    renameSession,
    deleteSession,
    fetchPinnedSessions,
    setPinnedSessions,
  }
}
