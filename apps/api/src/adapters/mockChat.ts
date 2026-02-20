/**
 * Mock 聊天适配器（阶段 3.1）：内存存储，流式回复为逐字 echo，与现 middleware mock 行为对照
 */
import type {
  NormalizedSession,
  NormalizedMessage,
  NormalizedInvitedSession,
  NormalizedRoomMember,
  SSESend,
  SSEFlush,
  ListSessionsParams,
  ListMessagesParams,
  StreamMessageParams,
  CreateSessionParams,
  ListInvitedSessionsParams,
  SessionMembersParams,
  JoinSessionParams,
  LeaveSessionParams,
  InviteToSessionParams,
  GetSessionCreatorParams,
  RenameSessionParams,
} from './types.js';

interface UserData {
  sessions: NormalizedSession[];
  messagesBySession: Map<string, NormalizedMessage[]>;
}

const userDataStore = new Map<string, UserData>();

function getUserData(userId: string): UserData {
  let data = userDataStore.get(userId);
  if (!data) {
    data = { sessions: [], messagesBySession: new Map() };
    userDataStore.set(userId, data);
  }
  return data;
}

/** 默认逐字间隔（ms）与块大小，便于前端看到打字机效果 */
const STREAM_ECHO_DELAY_MS = 50;
const STREAM_ECHO_CHUNK_SIZE = 1;

function streamEcho(
  send: SSESend,
  flush: SSEFlush,
  text: string,
  chunkSize = STREAM_ECHO_CHUNK_SIZE,
  delayMs = STREAM_ECHO_DELAY_MS
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

export function getMockChatAdapter() {
  return {
    async listSessions(params: ListSessionsParams): Promise<NormalizedSession[]> {
      const data = getUserData(params.userId);
      return [...data.sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },

    async listMessages(
      params: ListMessagesParams
    ): Promise<{ messages: NormalizedMessage[]; nextToken?: string }> {
      const { sessionId, backendSessionId, userId, limit = 50 } = params;
      const id = backendSessionId || sessionId;
      const data = getUserData(userId);
      const list = data.messagesBySession.get(id) || [];
      const messages = list.slice(-Math.min(Number(limit) || 20, 100));
      return { messages };
    },

    async createSession(params: CreateSessionParams): Promise<NormalizedSession> {
      const { userId, title = '新会话' } = params;
      const id = `mock-${userId}-${Date.now()}`;
      const session: NormalizedSession = {
        id,
        title: title.trim() || '新会话',
        updatedAt: Date.now(),
        backendSessionId: id,
        provider: 'mock',
      };
      const data = getUserData(userId);
      data.sessions.unshift(session);
      data.messagesBySession.set(id, []);
      return session;
    },

    async streamMessage(params: StreamMessageParams): Promise<void> {
      const { sessionId, backendSessionId, message, userId, send, flush } = params;
      let roomId = backendSessionId || sessionId;
      const data = getUserData(userId);

      if (!roomId) {
        roomId = `mock-${userId}-${Date.now()}`;
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
        id: `mock-${Date.now()}-u`,
        role: 'user',
        content: message,
        backendMessageId: `mock-${Date.now()}-u`,
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
        id: `mock-${Date.now()}-a`,
        role: 'assistant',
        content: reply,
        backendMessageId: `mock-${Date.now()}-a`,
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

    async listInvitedSessions(_params: ListInvitedSessionsParams): Promise<NormalizedInvitedSession[]> {
      return [];
    },

    async joinSession(_params: JoinSessionParams): Promise<void> {
      // mock 无邀请态，无需实现
    },

    async leaveSession(_params: LeaveSessionParams): Promise<void> {
      // mock 可选：从 getUserData 移除该会话
    },

    async listSessionMembers(_params: SessionMembersParams): Promise<NormalizedRoomMember[]> {
      return [];
    },

    async inviteToSession(_params: InviteToSessionParams): Promise<void> {
      // mock 无多用户邀请
    },

    async getSessionCreator(_params: GetSessionCreatorParams): Promise<string | undefined> {
      return undefined;
    },

    async renameSession(_params: RenameSessionParams): Promise<void> {
      // mock 无持久化房间名称
    },
  };
}
