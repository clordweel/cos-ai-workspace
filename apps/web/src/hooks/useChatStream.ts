import { useCallback } from 'react';
import { createActor } from 'xstate';
import { streamPhaseMachine } from '../machines/streamPhaseMachine';
import type { StreamPhase } from '../machines/streamPhaseMachine';

export interface StreamChatOptions {
  conversationId?: string;
  signal?: AbortSignal;
  botIds?: string[];
  onSessionCreated?: (payload: { session_id: string; backend_session_id?: string }) => void;
  onThinking?: (delta: string) => void;
  onThinkingFull?: (fullText: string) => void;
  /** 流阶段变化（connecting → thinking → streaming → completed），便于 UI 展示「思考中/流式中」 */
  onPhaseChange?: (phase: StreamPhase) => void;
  /** API 下发的 status 事件（如 status: thinking），早于首条 thinking delta */
  onStatus?: (status: string) => void;
  /** Dify 事件（agent_thought、tool_call 等），用于展示「正在调用工具」等 */
  onDifyEvent?: (ev: { type: string; data: Record<string, unknown> }) => void;
}

function dispatchStreamEvent(
  eventType: string,
  data: Record<string, unknown>,
  actor: ReturnType<typeof createActor<typeof streamPhaseMachine>>,
  callbacks: {
    onDelta: (delta: string) => void;
    onPhaseChange?: (phase: StreamPhase) => void;
    onThinking?: (delta: string) => void;
    onThinkingFull?: (fullText: string) => void;
    onStatus?: (status: string) => void;
    onDifyEvent?: (ev: { type: string; data: Record<string, unknown> }) => void;
  }
): { fullTextDelta?: string; shouldThrow?: Error } {
  const send = actor.send.bind(actor);
  const phase = () => (actor.getSnapshot().value as StreamPhase);
  const notifyPhase = () => callbacks.onPhaseChange?.(phase());

  if (eventType === 'error') {
    const msg = data?.message != null ? String(data.message) : '请求失败';
    send({ type: 'ERROR', message: msg });
    notifyPhase();
    return { shouldThrow: new Error(msg) };
  }

  if (eventType === 'session_created') {
    // 不改变流阶段，由调用方 onSessionCreated 处理
    return {};
  }

  if (eventType === 'status') {
    const status = data?.status != null ? String(data.status) : '';
    send({ type: 'STATUS', status });
    notifyPhase();
    callbacks.onStatus?.(status);
    return {};
  }

  if (eventType === 'thinking') {
    send(data?.fullText != null ? { type: 'THINKING_FULL' } : { type: 'THINKING_DELTA' });
    notifyPhase();
    if (data?.delta != null) callbacks.onThinking?.(String(data.delta));
    if (data?.fullText != null) callbacks.onThinkingFull?.(String(data.fullText));
    return {};
  }

  if (eventType === 'message') {
    if (data?.delta == null) return {};
    const delta = String(data.delta);
    send({ type: 'MESSAGE_DELTA' });
    notifyPhase();
    callbacks.onDelta(delta);
    return { fullTextDelta: delta };
  }

  if (eventType === 'message_end') {
    send({ type: 'MESSAGE_END' });
    notifyPhase();
    return {};
  }

  if (eventType === 'dify_event') {
    const type = (data?.type != null ? String(data.type) : '') as string;
    const evData = (data?.data != null && typeof data.data === 'object' ? data.data : {}) as Record<string, unknown>;
    send({ type: 'DIFY_EVENT', payload: { type, data: evData } });
    notifyPhase();
    callbacks.onDifyEvent?.({ type, data: evData });
    return {};
  }

  return {};
}

/**
 * 调用 POST /api/chat/stream，解析 SSE，按事件类型严格分发并驱动流阶段状态机
 */
export function useChatStream() {
  const streamChat = useCallback(
    async (
      message: string,
      onDelta: (delta: string) => void,
      options?: StreamChatOptions
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

      const actor = createActor(streamPhaseMachine).start();
      actor.send({ type: 'START' });
      options?.onPhaseChange?.(actor.getSnapshot().value as StreamPhase);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastEvent = '';
      let fullText = '';
      const callbacks = {
        onDelta,
        onPhaseChange: options?.onPhaseChange,
        onThinking: options?.onThinking,
        onThinkingFull: options?.onThinkingFull,
        onStatus: options?.onStatus,
        onDifyEvent: options?.onDifyEvent,
      };

      try {
        while (true) {
          if (options?.signal?.aborted) {
            actor.send({ type: 'ABORT' });
            options?.onPhaseChange?.(actor.getSnapshot().value as StreamPhase);
            break;
          }
          let chunk: ReadableStreamReadResult<Uint8Array>;
          try {
            chunk = await reader.read();
          } catch (e) {
            actor.send({ type: 'ERROR', message: e instanceof Error ? e.message : '连接中断' });
            options?.onPhaseChange?.(actor.getSnapshot().value as StreamPhase);
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
                const result = dispatchStreamEvent(lastEvent, data, actor, callbacks);
                if (result.shouldThrow) throw result.shouldThrow;
                if (result.fullTextDelta != null) fullText += result.fullTextDelta;
              } catch (e) {
                if (e instanceof Error && e.message !== undefined && e.name === 'Error') throw e;
              }
            }
          }
          if (done) break;
        }

        if (buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6)) as Record<string, unknown>;
            const result = dispatchStreamEvent(lastEvent, data, actor, callbacks);
            if (result.shouldThrow) throw result.shouldThrow;
            if (result.fullTextDelta != null) fullText += result.fullTextDelta;
          } catch (e) {
            if (e instanceof Error && e.message) throw e;
          }
        }
      } finally {
        actor.stop();
      }

      return fullText;
    },
    []
  );

  return { streamChat };
}
