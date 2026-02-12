import { ref } from 'vue'

/** 左侧消息来源类型：其它用户、机器人、系统或外部程序 */
export type MessageSourceType = 'other_user' | 'bot' | 'system'
export type MessageSource = { type: MessageSourceType; label?: string }

/** 消息互动：点赞/反对，支持多人 */
export type MessageReactionType = 'like' | 'dislike'
export type MessageReaction = { type: MessageReactionType; by: MessageSource }

/**
 * 消息接收/送达状态（已读以外的状态在此管理）
 * - 我发的消息：sending → sent → delivered → read；失败为 failed
 * - 收到的消息：unread → read（未设则视为 unread）
 */
export type MessageReceiptStatus =
  | 'sending'   // 发送中
  | 'sent'     // 已发送
  | 'delivered' // 已送达
  | 'read'     // 已读
  | 'unread'   // 未读（仅收到的消息）
  | 'failed'   // 发送失败

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  /** 左侧消息可标注多种来源（含多机器人协作），头像堆叠展示 */
  sources?: MessageSource[]
  /** 流式输出时按片段推送，用于渐显动画；非流式时由 content 展示 */
  contentChunks?: string[]
  /** 多人参与：点赞/反对列表 */
  reactions?: MessageReaction[]
  /** 有编辑权限者的修改 */
  editedAt?: number
  editedBy?: MessageSource
  /** 接收/送达状态；未设时：我发的视为 sent，收到的视为 unread */
  receiptStatus?: MessageReceiptStatus
  /** 可选：已读时展示的读者来源（我发的消息为已读时，对方头像在气泡右上角展示） */
  readBy?: MessageSource[]
  /** 可选：消息唯一 id，便于更新状态 */
  id?: string
  /** 消息时间戳（毫秒），用于展示与连续消息合并判断 */
  createdAt?: number
  /**
   * 可选：当前用户是否可编辑该条对方消息。
   * 为 false 时表示发送方为更高权限等，不展示编辑按钮；未设或 true 时依全局编辑权限决定。
   */
  editableByCurrentUser?: boolean
}

const chats = ref<Array<{ id: string; title: string; updatedAt?: number }>>([
  { id: 'default', title: '当前会话', updatedAt: Date.now() },
])
const messagesByChatId = ref<Record<string, ChatMessage[]>>({})
const conversationIds = ref<Record<string, string | undefined>>({})

export function useChatSessions() {
  const getMessages = (chatId: string): ChatMessage[] => {
    return messagesByChatId.value[chatId] ?? []
  }

  const setMessages = (chatId: string, list: ChatMessage[]) => {
    messagesByChatId.value = { ...messagesByChatId.value, [chatId]: list }
  }

  const appendMessage = (chatId: string, msg: ChatMessage) => {
    const list = getMessages(chatId)
    setMessages(chatId, [...list, msg])
    touchChatUpdatedAt(chatId)
  }

  const updateLastMessage = (chatId: string, updater: (m: ChatMessage) => void) => {
    const list = getMessages(chatId)
    if (list.length === 0) return
    const next = [...list]
    updater(next[next.length - 1])
    setMessages(chatId, next)
  }

  const ensureChat = (id: string, title: string) => {
    const now = Date.now()
    if (!chats.value.some((c) => c.id === id)) {
      chats.value = [{ id, title, updatedAt: now }, ...chats.value]
    } else {
      chats.value = chats.value.map((c) =>
        c.id === id ? { ...c, title: c.title !== title ? title : c.title } : c,
      )
    }
  }

  const touchChatUpdatedAt = (id: string) => {
    const now = Date.now()
    chats.value = chats.value.map((c) => (c.id === id ? { ...c, updatedAt: now } : c))
  }

  /** 设置某会话的 updatedAt（用于从 API 拉取会话列表后保持正确排序） */
  const setChatUpdatedAt = (id: string, updatedAt: number) => {
    chats.value = chats.value.map((c) => (c.id === id ? { ...c, updatedAt } : c))
  }

  const getConversationId = (chatId: string) => conversationIds.value[chatId]
  const setConversationId = (chatId: string, cid: string | undefined) => {
    conversationIds.value = { ...conversationIds.value, [chatId]: cid }
  }

  const createNewChat = () => {
    const id = `session-${Date.now()}`
    ensureChat(id, '新会话')
    return id
  }

  /** 从列表中移除会话（删除后调用） */
  const removeChat = (chatId: string) => {
    chats.value = chats.value.filter((c) => c.id !== chatId)
    const nextMessages = { ...messagesByChatId.value }
    delete nextMessages[chatId]
    messagesByChatId.value = nextMessages
    const nextIds = { ...conversationIds.value }
    delete nextIds[chatId]
    conversationIds.value = nextIds
  }

  /** 更新某条消息的接收状态 */
  const updateMessageReceipt = (chatId: string, index: number, status: MessageReceiptStatus) => {
    const list = getMessages(chatId)
    if (index < 0 || index >= list.length) return
    const next = [...list]
    next[index] = { ...next[index]!, receiptStatus: status }
    setMessages(chatId, next)
  }

  /** 将会话内所有收到的消息标记为已读 */
  const markChatAsRead = (chatId: string) => {
    const list = getMessages(chatId)
    let changed = false
    const next = list.map((m) => {
      if (m.role === 'assistant' && m.receiptStatus !== 'read') {
        changed = true
        return { ...m, receiptStatus: 'read' as const }
      }
      return m
    })
    if (changed) setMessages(chatId, next)
  }

  /** 是否视为「非已读」：未读、发送中、已发/已送达、失败（我发的消息未设状态时视为已读） */
  const isNonReadStatus = (msg: ChatMessage): boolean => {
    const s = msg.receiptStatus
    if (msg.role === 'user') return s === 'sending' || s === 'sent' || s === 'delivered' || s === 'failed'
    return s === 'unread' || s === undefined
  }

  /** 某会话下非已读消息条数 */
  const getNonReadCount = (chatId: string): number => {
    return getMessages(chatId).filter(isNonReadStatus).length
  }

  return {
    chats,
    getMessages,
    setMessages,
    appendMessage,
    updateLastMessage,
    ensureChat,
    removeChat,
    touchChatUpdatedAt,
    setChatUpdatedAt,
    getConversationId,
    setConversationId,
    createNewChat,
    updateMessageReceipt,
    markChatAsRead,
    isNonReadStatus,
    getNonReadCount,
  }
}
