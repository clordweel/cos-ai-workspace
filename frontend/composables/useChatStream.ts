import { useRuntimeConfig } from 'nuxt/app'

/**
 * SSE 流式对话封装
 * 调用中间层 POST /api/chat/stream，解析 SSE 实现打字机效果
 */
export function useChatStream() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  async function streamChat(
    message: string,
    onDelta: (delta: string) => void,
    options?: {
      conversationId?: string
      userId?: string
      signal?: AbortSignal
      onThinking?: () => void
      onThinkingDelta?: (delta: string) => void
      /** 流结束时带上完整思考内容，便于前端保留 */
      onThinkingDone?: (fullText: string) => void
    }
  ): Promise<void> {
    const res = await fetch(`${apiBase}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: options?.conversationId,
        user_id: options?.userId ?? 'default',
      }),
      signal: options?.signal,
    })
    if (!res.ok || !res.body) throw new Error('Stream request failed')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lastEvent = ''
    while (true) {
      if (options?.signal?.aborted) break
      const { done, value } = await reader.read()
      if (value) buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('event:')) {
          lastEvent = line.slice(6).trim()
          continue
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (lastEvent === 'status' && data?.status === 'thinking') {
              options?.onThinking?.()
            } else if (lastEvent === 'thinking') {
              if (data?.delta != null) options?.onThinkingDelta?.(String(data.delta))
              if (data?.fullText != null) options?.onThinkingDone?.(String(data.fullText))
            } else if (lastEvent === 'message' && data?.delta != null) {
              onDelta(String(data.delta))
            } else if (data.delta != null) {
              onDelta(String(data.delta))
            } else if (data.message != null) {
              onDelta(String(data.message))
            }
          } catch {
            // 忽略非 JSON 行
          }
        }
      }
      if (done || options?.signal?.aborted) break
    }
    // 不重置 lastEvent，以便末尾 buffer 的 data 能正确归属到 thinking / message
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6))
        if (lastEvent === 'thinking') {
          if (data?.delta != null) options?.onThinkingDelta?.(String(data.delta))
          if (data?.fullText != null) options?.onThinkingDone?.(String(data.fullText))
        } else if (lastEvent === 'message' && data?.delta != null) {
          onDelta(String(data.delta))
        } else if (data.delta != null && lastEvent !== 'thinking') {
          onDelta(String(data.delta))
        } else if (data.message != null) {
          onDelta(String(data.message))
        }
      } catch { /* ignore */ }
    }
  }

  return { streamChat }
}
