/**
 * Matrix 仅 sync/typing/已读 客户端（混合方案）
 * 使用 /api/auth/me 下发的 matrixSyncToken + matrix_base_url + matrix_user_id，
 * 仅用于：收 sync 新消息、发 typing、发已读回执。禁止用于发消息、拉列表、拉历史。
 */
import type { MatrixClient } from 'matrix-js-sdk'

const syncClient = ref<MatrixClient | null>(null)
const syncReady = ref(false)

export function useMatrixSyncClient() {
  const auth = useAuth()
  const { appendMessage, ensureChat, getMessages } = useChatSessions()

  watch(
    () => (auth.matrixSyncToken as { value?: string })?.value,
    (v) => {
      if (!v) stopSyncClient()
    }
  )

  /** 当前是否有 sync 用 token（有则可能已创建 client） */
  const hasSyncToken = computed(
    () =>
      !!(
        (auth.matrixSyncToken as { value?: string })?.value &&
        (auth.matrixBaseUrl as { value?: string })?.value &&
        (auth.matrixUserId as { value?: string })?.value
      )
  )

  /** 启动仅 sync 的 Matrix Client（在 token 可用时调用，仅客户端） */
  async function startSyncClient(): Promise<MatrixClient | null> {
    if (import.meta.server) return null
    const token = (auth.matrixSyncToken as { value?: string })?.value
    const baseUrl = (auth.matrixBaseUrl as { value?: string })?.value
    const userId = (auth.matrixUserId as { value?: string })?.value
    if (!token || !baseUrl || !userId) return null

    if (syncClient.value) {
      syncReady.value = true
      return syncClient.value
    }

    try {
      const sdk = await import('matrix-js-sdk')
      const c = sdk.createClient({
        baseUrl,
        accessToken: token,
        userId,
      })
      syncClient.value = c
      syncReady.value = false

      c.on(sdk.ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED' || state === 'SYNCING') syncReady.value = true
      })

      c.on(sdk.ClientEvent.Event, (event: { getRoomId?: () => string; getType?: () => string; getContent?: () => { body?: string }; getSender?: () => string; getId?: () => string }) => {
        if (event?.getType?.() !== 'm.room.message') return
        const roomId = event.getRoomId?.()
        if (!roomId) return
        const body = event.getContent?.()?.body
        if (body == null) return
        const eventId = event.getId?.()
        const existing = getMessages(roomId)
        if (eventId && existing.some((m) => m.id === eventId)) return
        ensureChat(roomId, roomId)
        const role = event.getSender?.() === userId ? 'user' : 'assistant'
        appendMessage(roomId, {
          role: role as 'user' | 'assistant',
          content: String(body),
          id: eventId ?? undefined,
        })
      })

      await c.startClient({ initialSyncLimit: 10 })
      return c
    } catch (e) {
      syncClient.value = null
      syncReady.value = false
      return null
    }
  }

  /** 停止 sync 客户端（登出或 token 失效时） */
  function stopSyncClient(): void {
    if (syncClient.value) {
      try {
        syncClient.value.stopClient?.()
      } catch {
        // ignore
      }
      syncClient.value = null
    }
    syncReady.value = false
  }

  /** 发送正在输入状态（仅当 sync client 就绪时） */
  function sendTyping(roomId: string, isTyping: boolean): void {
    const client = syncClient.value
    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) return
    try {
      room.sendTyping(isTyping)
    } catch {
      // ignore
    }
  }

  /** 发送已读回执（仅当 sync client 就绪时；需能解析到对应 MatrixEvent） */
  function sendReadReceipt(roomId: string, eventId: string): void {
    const client = syncClient.value
    if (!client) return
    const room = client.getRoom(roomId)
    const event = room?.findEventById(eventId) ?? null
    if (!event) return
    try {
      client.sendReadReceipt(event, 'm.read')
    } catch {
      // ignore
    }
  }

  return {
    syncClient: readonly(syncClient),
    syncReady: readonly(syncReady),
    hasSyncToken,
    startSyncClient,
    stopSyncClient,
    sendTyping,
    sendReadReceipt,
  }
}
