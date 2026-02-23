/**
 * Dify 流阶段状态机：表达从连接到结束的明确阶段，便于 UI 展示与事件分发可控
 * 与 API 侧 SSE 事件（status / thinking / message / message_end / dify_event / error）一一对应
 */
import { setup } from 'xstate';

export type StreamPhase =
  | 'idle'
  | 'connecting'
  | 'thinking'
  | 'streaming'
  | 'completed'
  | 'error';

export type StreamPhaseEvent =
  | { type: 'START' }
  | { type: 'STATUS'; status: string }
  | { type: 'THINKING_DELTA' }
  | { type: 'THINKING_FULL' }
  | { type: 'MESSAGE_DELTA' }
  | { type: 'MESSAGE_END' }
  | { type: 'DIFY_EVENT'; payload: { type: string; data: Record<string, unknown> } }
  | { type: 'ERROR'; message?: string }
  | { type: 'ABORT' };

export const streamPhaseMachine = setup({
  types: {
    events: {} as StreamPhaseEvent,
  },
}).createMachine({
  id: 'streamPhase',
  initial: 'idle',
  states: {
    idle: {
      on: {
        START: 'connecting',
      },
    },
    connecting: {
      on: {
        STATUS: 'thinking',
        THINKING_DELTA: 'thinking',
        THINKING_FULL: 'thinking',
        MESSAGE_DELTA: 'streaming',
        MESSAGE_END: 'completed',
        DIFY_EVENT: 'connecting',
        ERROR: 'error',
        ABORT: 'idle',
      },
    },
    thinking: {
      on: {
        THINKING_DELTA: 'thinking',
        THINKING_FULL: 'thinking',
        MESSAGE_DELTA: 'streaming',
        MESSAGE_END: 'completed',
        DIFY_EVENT: 'thinking',
        ERROR: 'error',
        ABORT: 'idle',
      },
    },
    streaming: {
      on: {
        MESSAGE_DELTA: 'streaming',
        MESSAGE_END: 'completed',
        DIFY_EVENT: 'streaming',
        ERROR: 'error',
        ABORT: 'idle',
      },
    },
    completed: {
      type: 'final',
    },
    error: {
      on: {
        START: 'connecting',
      },
    },
  },
});
