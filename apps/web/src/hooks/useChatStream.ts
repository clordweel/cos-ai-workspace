import { useCallback } from 'react';

/**
 * 调用 POST /api/chat/stream，解析 SSE，与现 frontend useChatStream 行为对照
 */
export function useChatStream() {
  const streamChat = useCallback(
    async (
      message: string,
      onDelta: (delta: string) => void,
      options?: {
        conversationId?: string;
        signal?: AbortSignal;
        /** 消息中 @ 的机器人 id 列表（如 assistant），有则走 Dify 流式回复 */
        botIds?: string[];
        onSessionCreated?: (payload: { session_id: string; backend_session_id?: string }) => void;
        /** 深度思考过程（<think> 标签内容）增量 */
        onThinking?: (delta: string) => void;
        /** 深度思考过程完整文本（流结束时的 fullText） */
        onThinkingFull?: (fullText: string) => void;
      }
    ): Promise<string> => {
      const body: Record<string, unknown> = {
        message,
        conversation_id: options?.conversationId || undefined,
      };
      if (options?.botIds?.length) body.bot_ids = options.botIds;
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      if (res.status === 401) throw new Error('需要登录');
      if (!res.ok) {
        const text = await res.text();
        let msg = res.statusText || '请求失败';
        try {
          const data = JSON.parse(text) as { error?: string; message?: string };
          if (data?.error) msg = data.error;
          else if (data?.message) msg = data.message;
        } catch {
          if (text) msg = text.slice(0, 200);
        }
        throw new Error(msg);
      }
      if (!res.body) throw new Error('无法读取流');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastEvent = '';
      let fullText = '';
      while (true) {
        if (options?.signal?.aborted) break;
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : '连接中断，请重试');
        }
        const { done, value } = chunk;
        if (value) buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            lastEvent = line.slice(6).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (lastEvent === 'error' && data?.message != null) {
                throw new Error(String(data.message));
              }
              if (lastEvent === 'session_created' && data?.session_id) {
                options?.onSessionCreated?.({
                  session_id: String(data.session_id),
                  backend_session_id: data.backend_session_id != null ? String(data.backend_session_id) : undefined,
                });
              } else if (lastEvent === 'message' && data?.delta != null) {
                const delta = String(data.delta);
                fullText += delta;
                onDelta(delta);
              } else if (lastEvent === 'thinking') {
                if (data?.delta != null) options?.onThinking?.(String(data.delta));
                if (data?.fullText != null) options?.onThinkingFull?.(String(data.fullText));
              } else if (data?.delta != null) {
                const delta = String(data.delta);
                fullText += delta;
                onDelta(delta);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== undefined && e.name === 'Error') throw e;
              // 忽略非 JSON 行
            }
          }
        }
        if (done || options?.signal?.aborted) break;
      }
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6)) as Record<string, unknown>;
          if (lastEvent === 'error' && data?.message != null) throw new Error(String(data.message));
          if (lastEvent === 'thinking') {
            if (data?.delta != null) options?.onThinking?.(String(data.delta));
            if (data?.fullText != null) options?.onThinkingFull?.(String(data.fullText));
          } else if (lastEvent === 'message' && data?.delta != null) {
            const delta = String(data.delta);
            fullText += delta;
            onDelta(delta);
          }
        } catch (e) {
          if (e instanceof Error && e.message) throw e;
        }
      }
      return fullText;
    },
    []
  );

  return { streamChat };
}
