/**
 * Matrix 会话后端适配器（在 api 内重新实现，不依赖 middleware）
 * Room = 会话，m.room.message = 消息；@ 助手时可选走 Dify 流式回复并写回 Matrix
 */
import { marked } from 'marked';
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
  setRoomName,
  verifyMatrixTokenUserId,
} from './matrixClient.js';
import { resolveInviteeToMatrixUserId } from '../services/matrixUserSync.js';
import { runStreamWithParams } from '../services/difyStream.js';
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
  GetSessionCreatorParams,
  RenameSessionParams,
} from './types.js';

function isMatrixConfigured(): boolean {
  const { matrix } = config;
  return Boolean(
    matrix.baseUrl &&
    matrix.serverName &&
    (matrix.accessToken || (matrix.userId && matrix.password))
  );
}

/** 将 Markdown 转为纯文本（用于 Matrix body 回退），去掉格式符号 */
function markdownToPlain(md: string): string {
  let s = md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return s.trim() || '(空)';
}

/** 将消息文本（支持 Markdown）转为 Matrix body + formatted_body，便于 Element 等客户端正确显示格式 */
function processMessageText(raw: string): { body: string; formattedBody?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { body: '(空)', formattedBody: undefined };
  const body = markdownToPlain(trimmed);
  let formattedBody: string | undefined;
  try {
    const html = marked.parse(trimmed);
    formattedBody = typeof html === 'string' ? html.trim() : undefined;
  } catch {
    formattedBody = undefined;
  }
  return { body, formattedBody };
}

/** 发往 Dify 前去掉 @ 提及，避免模型收到 "@AI 助手test" 等导致不回复；与前端 BOTS 名称一致 */
function stripBotMentionsForDify(message: string): string {
  const text = message
    .replace(/@AI\s*助手/g, '')
    .replace(/\[\s*@\s*[^\]]*id\s*=\s*["']?assistant["']?[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text;
  return '（请直接回复）';
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
        const formattedBody = typeof (ev.content as { formatted_body?: string })?.formatted_body === 'string'
          ? (ev.content as { formatted_body: string }).formatted_body
          : undefined;
        const senderId = r === 'assistant' ? ev.sender : undefined;
        out.push({
          id: ev.event_id,
          role: r,
          content: body,
          formattedContent: formattedBody,
          backendMessageId: ev.event_id,
          createdAt: ev.origin_server_ts,
          senderId,
        });
      }
      out.reverse();
      return { messages: out, nextToken };
    },

    async streamMessage(params: StreamMessageParams): Promise<{ backendSessionId?: string } | void> {
      const { sessionId, backendSessionId, message, userId, send, flush, matrixAccessToken: userToken, currentUserMxid, botIds } = params;
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
      if (botIds?.length && config.dify?.apiKey?.trim()) {
        try {
          const queryForDify = stripBotMentionsForDify(message);
          const fullAnswer = await runStreamWithParams(
            { message: queryForDify, conversation_id: '', user_id: userId },
            send,
            flush
          );
          if (fullAnswer?.trim() && config.matrix.botUserId?.trim() && config.matrix.botAccessToken?.trim()) {
            try {
              await inviteToRoom(roomId, config.matrix.botUserId, userToken);
            } catch {
              /* 可能已在房间 */
            }
            try {
              await joinRoom(roomId, config.matrix.botAccessToken);
            } catch {
              /* 可能已加入 */
            }
            try {
              const { body: botBody, formattedBody: botFormattedBody } = processMessageText(fullAnswer.trim());
              await sendRoomMessage(
                roomId,
                botBody,
                'm.text',
                config.matrix.botAccessToken,
                undefined,
                botFormattedBody ?? undefined
              );
            } catch {
              /* 助手回复写入 Matrix 失败时仅忽略 */
            }
          }
        } catch (e) {
          send('error', { message: e instanceof Error ? e.message : String(e) });
          flush();
        }
      } else {
        send('message_end', { conversation_id: roomId, message_id: '' });
        flush();
      }
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
      const inviteeMatrixId = resolveInviteeToMatrixUserId(inviteeUserId);
      await inviteToRoom(sessionId, inviteeMatrixId, userToken);
    },

    async getSessionCreator(params: GetSessionCreatorParams): Promise<string | undefined> {
      const { sessionId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) return undefined;
      return getRoomCreator(sessionId, userToken);
    },

    async renameSession(params: RenameSessionParams): Promise<void> {
      const { sessionId, title, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token（请先登录）');
      await setRoomName(sessionId, title.trim() || sessionId, userToken);
    },
  };
}

export { isMatrixConfigured };
