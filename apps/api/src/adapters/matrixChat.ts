/**
 * Matrix 会话后端适配器（在 api 内重新实现，不依赖 middleware）
 * Room = 会话，m.room.message = 消息；不包含 Dify/bot 写入，仅用户消息与列表/历史
 */
import {
  getJoinedRooms,
  getInvitedRooms,
  getRoomName,
  getRoomMessages,
  getRoomLastActivityTs,
  sendRoomMessage,
  createRoom,
  leaveRoom,
  joinRoom,
  inviteToRoom,
  getRoomMembers,
  getRoomCreator,
  verifyMatrixTokenUserId,
} from './matrixClient.js';
import { config } from '../config.js';
import type {
  NormalizedSession,
  NormalizedMessage,
  NormalizedInvitedSession,
  NormalizedRoomMember,
  ListSessionsParams,
  ListMessagesParams,
  StreamMessageParams,
  CreateSessionParams,
  ListInvitedSessionsParams,
  SessionMembersParams,
  JoinSessionParams,
  LeaveSessionParams,
  InviteToSessionParams,
} from './types.js';

function isMatrixConfigured(): boolean {
  const { matrix } = config;
  return Boolean(
    matrix.baseUrl &&
    matrix.serverName &&
    (matrix.accessToken || (matrix.userId && matrix.password))
  );
}

function processMessageText(raw: string): { body: string; formattedBody?: string } {
  return { body: raw.trim() || '(空)', formattedBody: undefined };
}

export function createMatrixAdapter() {
  return {
    name: 'matrix' as const,

    supportsStreaming: () => true,
    supportsListSessions: () => true,
    supportsListMessages: () => true,

    async listSessions(params: ListSessionsParams): Promise<NormalizedSession[]> {
      const userToken = params.matrixAccessToken;
      if (!userToken?.trim()) return [];
      const roomIds = await getJoinedRooms(userToken);
      const now = Date.now();
      const results = await Promise.all(
        roomIds.map(async (roomId) => {
          const [title, lastTs] = await Promise.all([
            getRoomName(roomId, userToken).catch(() => roomId),
            getRoomLastActivityTs(roomId, userToken).catch(() => 0),
          ]);
          return {
            id: roomId,
            title: title || roomId,
            updatedAt: lastTs > 0 ? lastTs : now,
            backendSessionId: roomId,
            provider: 'matrix' as const,
          };
        })
      );
      results.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return results;
    },

    async listMessages(
      params: ListMessagesParams
    ): Promise<{ messages: NormalizedMessage[]; nextToken?: string }> {
      const { sessionId, backendSessionId, userId, limit = 50, beforeId, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken?.trim()) return { messages: [] };
      const roomId = backendSessionId || sessionId;
      const currentUserId = currentUserMxid ?? userId;
      const { events, nextToken } = await getRoomMessages(
        roomId,
        Math.min(Number(limit) || 50, 100),
        beforeId ?? undefined,
        userToken
      );
      const replacementByEventId = new Map<string, { body: string }>();
      for (const ev of events) {
        if (ev.type !== 'm.room.message' || ev.content?.body == null) continue;
        const rel = (ev.content as { 'm.relates_to'?: { rel_type?: string; event_id?: string } })['m.relates_to'];
        const newContent = (ev.content as { 'm.new_content'?: { body?: string } })['m.new_content'];
        if (rel?.rel_type === 'm.replace' && rel.event_id && newContent) {
          replacementByEventId.set(rel.event_id, {
            body: typeof newContent.body === 'string' ? newContent.body : (ev.content.body as string).replace(/^\s*\*\s*/, ''),
          });
        }
      }
      const out: NormalizedMessage[] = [];
      for (const ev of events) {
        if (ev.type === 'm.room.member' || ev.type === 'm.room.name') continue;
        if (typeof ev.type === 'string' && ev.type.startsWith('m.call.')) {
          out.push({
            id: ev.event_id,
            role: 'system',
            content: '',
            backendMessageId: ev.event_id,
            createdAt: ev.origin_server_ts,
          });
          continue;
        }
        if (ev.type !== 'm.room.message' || ev.content?.body == null) continue;
        const rel = (ev.content as { 'm.relates_to'?: { rel_type?: string } })['m.relates_to'];
        if (rel?.rel_type === 'm.replace') continue;
        const r = ev.sender === currentUserId ? 'user' : 'assistant';
        let body = typeof ev.content?.body === 'string' ? ev.content.body : '';
        const replacement = replacementByEventId.get(ev.event_id);
        if (replacement) body = replacement.body;
        out.push({
          id: ev.event_id,
          role: r,
          content: body,
          backendMessageId: ev.event_id,
          createdAt: ev.origin_server_ts,
        });
      }
      out.reverse();
      return { messages: out, nextToken };
    },

    async streamMessage(params: StreamMessageParams): Promise<{ backendSessionId?: string } | void> {
      const { sessionId, backendSessionId, message, userId, send, flush, matrixAccessToken: userToken, currentUserMxid } = params;
      let roomId = backendSessionId || sessionId;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token（请先登录）');
      if (currentUserMxid) {
        const valid = await verifyMatrixTokenUserId(userToken, currentUserMxid);
        if (!valid) throw new Error(`token 不属于当前用户 (${currentUserMxid})，禁止以 admin 创建/发消息`);
      }
      if (!roomId) {
        const created = await createRoom(undefined, userToken);
        roomId = created.room_id;
        send('session_created', { session_id: roomId, backend_session_id: roomId });
        flush();
      }
      const { body: msgBody, formattedBody: msgFormattedBody } = processMessageText(message);
      await sendRoomMessage(
        roomId,
        msgBody,
        'm.text',
        userToken,
        params.replyToMessageId,
        msgFormattedBody ?? undefined
      );
      send('message_end', { conversation_id: roomId, message_id: '' });
      flush();
      return { backendSessionId: roomId };
    },

    async createSession(params: CreateSessionParams): Promise<NormalizedSession> {
      const { title, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token（请先登录）');
      if (currentUserMxid) {
        const valid = await verifyMatrixTokenUserId(userToken, currentUserMxid);
        if (!valid) throw new Error(`token 不属于当前用户 (${currentUserMxid})，禁止以 admin 创建房间`);
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

    async listInvitedSessions(params: ListInvitedSessionsParams): Promise<NormalizedInvitedSession[]> {
      const userToken = params.matrixAccessToken;
      if (!userToken?.trim()) return [];
      const invited = await getInvitedRooms(userToken);
      return invited.map((r) => ({ roomId: r.roomId, name: r.name }));
    },

    async joinSession(params: JoinSessionParams): Promise<void> {
      const { sessionId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token（请先登录）');
      await joinRoom(sessionId, userToken);
    },

    async leaveSession(params: LeaveSessionParams): Promise<void> {
      const { sessionId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token（请先登录）');
      await leaveRoom(sessionId, userToken);
    },

    async listSessionMembers(params: SessionMembersParams): Promise<NormalizedRoomMember[]> {
      const { sessionId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) return [];
      const entries = await getRoomMembers(sessionId, userToken);
      let creator: string | undefined;
      try {
        creator = await getRoomCreator(sessionId, userToken);
      } catch {
        creator = undefined;
      }
      return entries.map((e) => ({
        userId: e.userId,
        membership: e.membership,
        displayName: e.displayName,
        avatarUrl: e.avatarUrl,
        isOwner: creator !== undefined && e.userId === creator,
      }));
    },

    async inviteToSession(params: InviteToSessionParams): Promise<void> {
      const { sessionId, inviteeUserId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token（请先登录）');
      await inviteToRoom(sessionId, inviteeUserId, userToken);
    },
  };
}

export { isMatrixConfigured };
