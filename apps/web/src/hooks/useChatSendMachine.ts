/**
 * 聊天发送状态机 hook：封装 idle/sending/success/error，在 sending 时执行流式请求并派发 SUCCESS/ERROR
 */
import { useEffect, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { chatSendMachine } from '../machines/chatSendMachine';
import type { ChatSendSubmitPayload } from '../machines/chatSendMachine';

type StreamChatFn = (
  message: string,
  onDelta: (delta: string) => void,
  options?: {
    conversationId?: string;
    signal?: AbortSignal;
    botIds?: string[];
    onSessionCreated?: (payload: { session_id: string; backend_session_id?: string }) => void;
    onThinking?: (delta: string) => void;
    onThinkingFull?: (fullText: string) => void;
    onPhaseChange?: (phase: string) => void;
    onDifyEvent?: (ev: { type: string; data: Record<string, unknown> }) => void;
  }
) => Promise<string>;

export function useChatSendMachine(streamChat: StreamChatFn) {
  const [snapshot, send] = useMachine(chatSendMachine);
  const runRef = useRef(false);

  useEffect(() => {
    if (!snapshot.matches('sending')) {
      runRef.current = false;
      return;
    }
    const payload = snapshot.context.submitPayload;
    const controller = snapshot.context.abortController;
    if (!payload || runRef.current) return;
    runRef.current = true;

    const {
      text,
      conversationId,
      botIds,
      onSessionCreated,
      onDelta,
      onThinking,
      onThinkingFull,
      onPhaseChange,
      onDifyEvent,
      appendUserMessage,
      appendWaitingAssistant,
      commitStreamingMessage,
      discardStreamingMessage,
      onBeforeCommit,
    } = payload;

    appendUserMessage(text);
    if (botIds?.length) appendWaitingAssistant();

    streamChat(text, onDelta, {
      conversationId,
      botIds: botIds ?? undefined,
      signal: controller?.signal,
      onSessionCreated,
      onThinking,
      onThinkingFull,
      onPhaseChange,
      onDifyEvent,
    })
      .then((fullText) => {
        onBeforeCommit?.();
        commitStreamingMessage(fullText);
        send({ type: 'SUCCESS' });
      })
      .catch((e) => {
        discardStreamingMessage();
        const message = e instanceof Error ? e.message : String(e);
        send({ type: 'ERROR', message });
      })
      .finally(() => {
        runRef.current = false;
      });
  }, [snapshot.value, snapshot.context.submitPayload, snapshot.context.abortController, streamChat, send]);

  const isSending = snapshot.matches('sending');
  const errorMessage = snapshot.context.errorMessage;

  const submit = (payload: ChatSendSubmitPayload) => {
    send({ type: 'SUBMIT', payload });
  };

  const abort = () => {
    send({ type: 'ABORT' });
  };

  return {
    snapshot,
    send,
    isSending,
    errorMessage,
    submit,
    abort,
  };
}
