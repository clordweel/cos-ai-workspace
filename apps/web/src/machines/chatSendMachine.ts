/**
 * 聊天发送流程状态机（xstate 试点）
 * 状态：idle → sending → success | error；支持 ABORT 取消
 */
import { setup, assign } from 'xstate';

export interface ChatSendSubmitPayload {
  text: string;
  conversationId: string | undefined;
  botIds: string[] | undefined;
  onSessionCreated?: (p: { session_id: string; backend_session_id?: string }) => void;
  onDelta: (delta: string) => void;
  onThinking?: (delta: string) => void;
  onThinkingFull?: (full: string) => void;
  /** 流阶段变化（connecting/thinking/streaming/completed），便于 UI 展示 */
  onPhaseChange?: (phase: string) => void;
  /** Dify 事件（agent_thought、tool_call 等），用于展示「正在调用工具」 */
  onDifyEvent?: (ev: { type: string; data: Record<string, unknown> }) => void;
  appendUserMessage: (content: string) => void;
  appendWaitingAssistant: () => void;
  commitStreamingMessage: (finalContent: string, thinking?: string) => void;
  discardStreamingMessage: () => void;
  /** 在 commitStreamingMessage 前调用，用于 flush 批处理等 */
  onBeforeCommit?: () => void;
}

export interface ChatSendContext {
  submitPayload: ChatSendSubmitPayload | null;
  abortController: AbortController | null;
  errorMessage: string | null;
}

export type ChatSendEvent =
  | { type: 'SUBMIT'; payload: ChatSendSubmitPayload }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; message: string }
  | { type: 'ABORT' };

export const chatSendMachine = setup({
  types: {
    context: {} as ChatSendContext,
    events: {} as ChatSendEvent,
  },
  actions: {
    abortController: assign({
      abortController: ({ context }) => {
        context.abortController?.abort();
        return null;
      },
    }),
  },
}).createMachine({
  id: 'chatSend',
  context: {
    submitPayload: null,
    abortController: null,
    errorMessage: null,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        SUBMIT: {
          target: 'sending',
          actions: assign({
            submitPayload: ({ event }) => (event.type === 'SUBMIT' ? event.payload : null),
            abortController: () => new AbortController(),
            errorMessage: () => null,
          }),
        },
      },
    },
    sending: {
      on: {
        SUCCESS: { target: 'success' },
        ERROR: {
          target: 'error',
          actions: assign({
            errorMessage: ({ event }) => (event.type === 'ERROR' ? event.message : null),
          }),
        },
        ABORT: {
          target: 'idle',
          actions: 'abortController',
        },
      },
    },
    success: {
      on: {
        SUBMIT: {
          target: 'sending',
          actions: assign({
            submitPayload: ({ event }) => (event.type === 'SUBMIT' ? event.payload : null),
            abortController: () => new AbortController(),
            errorMessage: () => null,
          }),
        },
      },
    },
    error: {
      on: {
        SUBMIT: {
          target: 'sending',
          actions: assign({
            submitPayload: ({ event }) => (event.type === 'SUBMIT' ? event.payload : null),
            abortController: () => new AbortController(),
            errorMessage: () => null,
          }),
        },
      },
    },
  },
});
