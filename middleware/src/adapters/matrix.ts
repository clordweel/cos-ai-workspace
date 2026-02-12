/**
 * Matrix 会话后端适配器
 * 与 SESSION_ADAPTER_MATRIX.md 对应：Room = 会话，m.room.message = 消息
 * 使用 Matrix Client-Server API（matrixClient）
 * 注：Dify 流式接入已暂时移除，助手回复为占位文案
 */
import {
  getJoinedRooms,
  getRoomName,
  getRoomMessages,
  sendRoomMessage,
  createRoom,
  inviteToRoom,
  leaveRoom,
  setRoomName,
  verifyMatrixTokenUserId,
} from './matrixClient.js';
import { config } from '../config.js';
import type {
  ChatBackendAdapter,
  NormalizedSession,
  NormalizedMessage,
  StreamMessageParams,
  StreamMessageResult,
  ListSessionsParams,
  ListMessagesParams,
  CreateSessionParams,
  InviteToSessionParams,
  DeleteSessionParams,
  RenameSessionParams,
  SSESend,
} from './types.js';

function isMatrixConfigured(): boolean {
  const { matrix } = config;
  // 需 baseUrl + Admin 认证（ensureMatrixUser 等），会话操作一律用当前用户 token
  return Boolean(matrix.baseUrl && matrix.serverName && (matrix.accessToken || (matrix.userId && matrix.password)));
}

/**
 * 创建 Matrix 适配器实例
 */
export function createMatrixAdapter(): ChatBackendAdapter {
  return {
    name: 'matrix',

    supportsStreaming() {
      return true;
    },

    supportsListSessions() {
      return true;
    },

    supportsListMessages() {
      return true;
    },

    async listSessions(params: ListSessionsParams): Promise<NormalizedSession[]> {
      const userToken = params.matrixAccessToken;
      if (!userToken) {
        throw new Error('需要 Matrix 用户 token（请先登录）');
      }
      const roomIds = await getJoinedRooms(userToken);
      const sessions: NormalizedSession[] = [];
      for (const roomId of roomIds) {
        let title = roomId;
        try {
          title = await getRoomName(roomId, userToken);
        } catch {
          // 忽略单房间名失败
        }
        sessions.push({
          id: roomId,
          title: title || roomId,
          updatedAt: Date.now(),
          backendSessionId: roomId,
          provider: 'matrix',
        });
      }
      sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return sessions;
    },

    async listMessages(params: ListMessagesParams): Promise<NormalizedMessage[]> {
      const { sessionId, backendSessionId, userId, limit = 50, beforeId, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken) {
        throw new Error('需要 Matrix 用户 token（请先登录）');
      }
      const roomId = backendSessionId || sessionId;
      const { events } = await getRoomMessages(
        roomId,
        Math.min(Number(limit) || 50, 100),
        beforeId ?? undefined,
        userToken
      );
      const currentUserId = currentUserMxid ?? userId;
      const eventMap = new Map<string, { role: 'user' | 'assistant'; content: string }>();
      for (const ev of events) {
        if (ev.type === 'm.room.message' && ev.content?.body != null) {
          const r = ev.sender === currentUserId ? 'user' : 'assistant';
          eventMap.set(ev.event_id, { role: r, content: ev.content.body });
        }
      }
      const out: NormalizedMessage[] = [];
      for (const ev of events) {
        if (ev.type === 'm.room.member') {
          const membership = ev.content?.membership ?? '';
          const stateKey = ev.state_key ?? ev.sender;
          const displayName = ev.content?.displayname ?? stateKey.replace(/^@/, '').split(':')[0] ?? stateKey;
          let content: string;
          if (membership === 'join') {
            content = `${displayName} 加入了会话`;
          } else if (membership === 'leave') {
            content = `${displayName} 离开了会话`;
          } else if (membership === 'invite') {
            content = `${displayName} 被邀请加入`;
          } else {
            continue;
          }
          out.push({
            id: ev.event_id,
            role: 'system',
            content,
            backendMessageId: ev.event_id,
            createdAt: ev.origin_server_ts,
          });
          continue;
        }
        if (ev.type === 'm.room.name') {
          const name = ev.content?.name?.trim() || '未命名';
          out.push({
            id: ev.event_id,
            role: 'system',
            content: `会话已改名为「${name}」`,
            backendMessageId: ev.event_id,
            createdAt: ev.origin_server_ts,
          });
          continue;
        }
        const r = ev.sender === currentUserId ? 'user' : 'assistant';
        const body = typeof ev.content?.body === 'string' ? ev.content.body : '';
        eventMap.set(ev.event_id, { role: r, content: body });
        const replyEventId = ev.content?.['m.relates_to']?.['m.in_reply_to']?.event_id;
        const inReplyTo =
          replyEventId
            ? (() => {
                const parent = eventMap.get(replyEventId);
                return {
                  id: replyEventId,
                  role: parent?.role,
                  content: parent?.content,
                };
              })()
            : undefined;
        out.push({
          id: ev.event_id,
          role: r,
          content: body,
          backendMessageId: ev.event_id,
          createdAt: ev.origin_server_ts,
          inReplyTo,
        });
      }
      out.reverse();
      return out;
    },

    async streamMessage(params: StreamMessageParams): Promise<StreamMessageResult | void> {
      const { sessionId, backendSessionId, message, userId, send, flush, matrixAccessToken: userToken, currentUserMxid } = params;
      let roomId = backendSessionId || sessionId;

      // 必须使用当前用户 token，否则消息和房间会归属到 admin（参考 Element/Cinny：Client 绑定单一用户 token）
      if (!userToken?.trim()) {
        throw new Error('需要 Matrix 用户 token（请先登录）');
      }
      if (currentUserMxid) {
        const valid = await verifyMatrixTokenUserId(userToken, currentUserMxid);
        if (!valid) {
          throw new Error(`token 不属于当前用户 (${currentUserMxid})，禁止以 admin 创建/发消息`);
        }
      }

      if (!roomId) {
        const created = await createRoom(undefined, userToken);
        roomId = created.room_id;
        send('session_created', { session_id: roomId, backend_session_id: roomId });
        flush();
      }

      await sendRoomMessage(
        roomId,
        message,
        'm.text',
        userToken,
        params.replyToMessageId
      );

      // 第一步：用户独自使用会话，消息存入 Matrix，无他人参与；AI 回复后续接入
      return { backendSessionId: roomId };
    },

    async createSession(params: CreateSessionParams): Promise<NormalizedSession> {
      const { title, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken?.trim()) {
        throw new Error('需要 Matrix 用户 token（请先登录）');
      }
      if (currentUserMxid) {
        const valid = await verifyMatrixTokenUserId(userToken, currentUserMxid);
        if (!valid) {
          throw new Error(`token 不属于当前用户 (${currentUserMxid})，禁止以 admin 创建房间`);
        }
      }
      const { room_id } = await createRoom(title, userToken);
      return {
        id: room_id,
        title: title || room_id,
        updatedAt: Date.now(),
        backendSessionId: room_id,
        provider: 'matrix',
      };
    },

    async inviteToSession(params: InviteToSessionParams): Promise<void> {
      const { backendSessionId, sessionId, inviteeMxid, matrixAccessToken: userToken } = params;
      const roomId = backendSessionId || sessionId;
      if (!userToken) throw new Error('需要 Matrix token');
      await inviteToRoom(roomId, inviteeMxid, userToken);
    },

    async deleteSession(params: DeleteSessionParams): Promise<void> {
      const { backendSessionId, sessionId, matrixAccessToken: userToken } = params;
      const roomId = backendSessionId || sessionId;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      await leaveRoom(roomId, userToken);
    },

    async renameSession(params: RenameSessionParams): Promise<void> {
      const { backendSessionId, sessionId, title, matrixAccessToken: userToken } = params;
      const roomId = backendSessionId || sessionId;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      await setRoomName(roomId, title.trim(), userToken);
    },
  };
}

export { isMatrixConfigured };
