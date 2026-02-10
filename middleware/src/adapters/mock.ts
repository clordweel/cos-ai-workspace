/**
 * Mock 聊天后端适配器：用于功能调试与自动化测试
 * 多用户：按 userId 隔离会话与消息；无外部依赖，流式回复为模拟逐字输出
 */
import type {
  ChatBackendAdapter,
  NormalizedSession,
  NormalizedMessage,
  SSESend,
  SSEFlush,
  ListSessionsParams,
  ListMessagesParams,
  StreamMessageParams,
} from './types.js';

interface UserData {
  sessions: NormalizedSession[];
  messagesBySession: Map<string, NormalizedMessage[]>;
}

const DEFAULT_SESSIONS: NormalizedSession[] = [
  {
    id: 'mock-session-1',
    title: 'Mock 会话一',
    updatedAt: Date.now() - 3600_000,
    backendSessionId: 'mock-session-1',
    provider: 'mock',
  },
  {
    id: 'mock-session-2',
    title: 'Mock 会话二',
    updatedAt: Date.now() - 7200_000,
    backendSessionId: 'mock-session-2',
    provider: 'mock',
  },
];

const DEFAULT_MESSAGES = new Map<string, NormalizedMessage[]>([
  [
    'mock-session-1',
    [
      { id: 'm1', role: 'user', content: '你好', backendMessageId: 'm1', createdAt: Date.now() - 3600_000 },
      {
        id: 'm2',
        role: 'assistant',
        content: '你好！这是 Mock 适配器的回复。',
        backendMessageId: 'm2',
        createdAt: Date.now() - 3600_000 + 1000,
      },
    ],
  ],
  [
    'mock-session-2',
    [
      { id: 'm3', role: 'user', content: '测试', backendMessageId: 'm3', createdAt: Date.now() - 7200_000 },
      {
        id: 'm4',
        role: 'assistant',
        content: '收到测试消息。',
        backendMessageId: 'm4',
        createdAt: Date.now() - 7200_000 + 500,
      },
    ],
  ],
]);

/** 按用户隔离：userId -> { sessions, messagesBySession } */
const userDataStore = new Map<string, UserData>();

function getUserData(userId: string): UserData {
  let data = userDataStore.get(userId);
  if (!data) {
    if (userId === 'default') {
      data = {
        sessions: [...DEFAULT_SESSIONS],
        messagesBySession: new Map(DEFAULT_MESSAGES),
      };
    } else {
      data = { sessions: [], messagesBySession: new Map() };
    }
    userDataStore.set(userId, data);
  }
  return data;
}

function streamEcho(
  send: SSESend,
  flush: SSEFlush,
  text: string,
  chunkSize = 1,
  delayMs = 20
): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      if (i >= text.length) {
        flush();
        resolve();
        return;
      }
      const chunk = text.slice(i, i + chunkSize);
      i += chunkSize;
      send('message', { delta: chunk });
      flush();
      setTimeout(tick, delayMs);
    };
    tick();
  });
}

/**
 * 创建 Mock 适配器实例（无配置依赖）
 */
export function createMockAdapter(): ChatBackendAdapter {
  return {
    name: 'mock',

    supportsStreaming() {
      return true;
    },

    supportsListSessions() {
      return true;
    },

    supportsListMessages() {
      return true;
    },

    async streamMessage(params: StreamMessageParams): Promise<void> {
      const { sessionId, backendSessionId, message, userId, send, flush } = params;
      let roomId = backendSessionId || sessionId;
      const data = getUserData(userId);

      if (!roomId) {
        roomId = `mock-session-${userId}-${Date.now()}`;
        const newSession: NormalizedSession = {
          id: roomId,
          title: '新会话',
          updatedAt: Date.now(),
          backendSessionId: roomId,
          provider: 'mock',
        };
        data.sessions.unshift(newSession);
        data.messagesBySession.set(roomId, []);
        send('session_created', { session_id: roomId, backend_session_id: roomId });
        flush();
      }

      const messages = data.messagesBySession.get(roomId) || [];
      const userMsg: NormalizedMessage = {
        id: `mock-msg-${Date.now()}-u`,
        role: 'user',
        content: message,
        backendMessageId: `mock-msg-${Date.now()}-u`,
        createdAt: Date.now(),
      };
      messages.push(userMsg);
      data.messagesBySession.set(roomId, messages);

      const session = data.sessions.find((s) => s.id === roomId || s.backendSessionId === roomId);
      if (session) session.updatedAt = Date.now();

      send('status', { status: 'thinking' });
      flush();
      const reply = `[Mock] 收到：${message}`;
      await streamEcho(send, flush, reply);

      const assistantMsg: NormalizedMessage = {
        id: `mock-msg-${Date.now()}-a`,
        role: 'assistant',
        content: reply,
        backendMessageId: `mock-msg-${Date.now()}-a`,
        createdAt: Date.now(),
      };
      const list = data.messagesBySession.get(roomId) || [];
      list.push(assistantMsg);
      data.messagesBySession.set(roomId, list);

      send('message_end', {
        conversation_id: roomId,
        message_id: assistantMsg.backendMessageId,
      });
      flush();
    },

    async listSessions(params: ListSessionsParams): Promise<NormalizedSession[]> {
      const data = getUserData(params.userId);
      return [...data.sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },

    async listMessages(params: ListMessagesParams): Promise<NormalizedMessage[]> {
      const { sessionId, backendSessionId, userId, limit = 50 } = params;
      const id = backendSessionId || sessionId;
      const data = getUserData(userId);
      const list = data.messagesBySession.get(id) || [];
      return list.slice(-Math.min(Number(limit) || 20, 100));
    },
  };
}
