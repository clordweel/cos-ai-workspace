import { ref } from 'vue'

/** 左侧消息来源类型：其它用户、机器人、系统或外部程序 */
export type MessageSourceType = 'other_user' | 'bot' | 'system'
export type MessageSource = { type: MessageSourceType; label?: string }
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  /** 左侧消息可标注多种来源，头像堆叠展示 */
  sources?: MessageSource[]
  /** 流式输出时按片段推送，用于渐显动画；非流式时由 content 展示 */
  contentChunks?: string[]
}

const chats = ref<Array<{ id: string; title: string }>>([
  { id: 'default', title: '当前会话' },
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
  }

  const updateLastMessage = (chatId: string, updater: (m: ChatMessage) => void) => {
    const list = getMessages(chatId)
    if (list.length === 0) return
    const next = [...list]
    updater(next[next.length - 1])
    setMessages(chatId, next)
  }

  const ensureChat = (id: string, title: string) => {
    if (!chats.value.some((c) => c.id === id)) {
      chats.value = [{ id, title }, ...chats.value]
    } else {
      const c = chats.value.find((x) => x.id === id)
      if (c && c.title !== title) c.title = title
    }
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

  return {
    chats,
    getMessages,
    setMessages,
    appendMessage,
    updateLastMessage,
    ensureChat,
    getConversationId,
    setConversationId,
    createNewChat,
  }
}
