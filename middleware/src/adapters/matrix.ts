/**
 * Matrix 会话后端适配器
 * 与 SESSION_ADAPTER_MATRIX.md 对应：Room = 会话，m.room.message = 消息
 * 使用 Matrix Client-Server API（matrixClient）
 * 当消息 @ 了机器人且配置了 Dify 时，助手回复经 SSE 推送给前端（不写入 Matrix）
 */
import {
  getJoinedRooms,
  getRoomName,
  getRoomMessages,
  getRoomLastActivityTs,
  getRoomEvent,
  getRoomRelations,
  sendRoomMessage,
  editRoomMessage,
  redactRoomMessage,
  createRoom,
  inviteToRoom,
  joinRoom,
  leaveRoom,
  kickFromRoom,
  banUserFromRoom,
  getRoomMembers,
  getRoomCreator,
  setRoomName,
  verifyMatrixTokenUserId,
} from './matrixClient.js';
import { config } from '../config.js';
import { runStreamWithParams } from '../services/difyStream.js';
import { processMessageText } from '../services/messageTextProcessor.js';
import type {
  ChatBackendAdapter,
  NormalizedSession,
  NormalizedMessage,
  NormalizedRoomMember,
  StreamMessageParams,
  StreamMessageResult,
  ListSessionsParams,
  ListSessionMembersParams,
  KickFromSessionParams,
  BanFromSessionParams,
  ListMessagesParams,
  CreateSessionParams,
  InviteToSessionParams,
  DeleteSessionParams,
  RenameSessionParams,
  EditMessageParams,
  RedactMessageParams,
  GetMessageEditHistoryParams,
  EditHistoryEntry,
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

    async listMessages(params: ListMessagesParams): Promise<{ messages: NormalizedMessage[]; nextToken?: string }> {
      const { sessionId, backendSessionId, userId, limit = 50, beforeId, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken) {
        throw new Error('需要 Matrix 用户 token（请先登录）');
      }
      const roomId = backendSessionId || sessionId;
      const { events, nextToken } = await getRoomMessages(
        roomId,
        Math.min(Number(limit) || 50, 100),
        beforeId ?? undefined,
        userToken
      );
      const currentUserId = currentUserMxid ?? userId;
      const eventMap = new Map<string, { role: 'user' | 'assistant'; content: string }>();
      /** 编辑事件（m.replace）对原 event_id 的替换内容，供 listMessages 合并为一条展示 */
      const replacementByEventId = new Map<string, { body: string; formattedBody?: string }>();
      for (const ev of events) {
        if (ev.type !== 'm.room.message' || ev.content?.body == null) continue;
        const rel = (ev.content as { 'm.relates_to'?: { rel_type?: string; event_id?: string } })['m.relates_to'];
        const newContent = (ev.content as { 'm.new_content'?: { body?: string; formatted_body?: string } })['m.new_content'];
        if (rel?.rel_type === 'm.replace' && rel.event_id && newContent) {
          replacementByEventId.set(rel.event_id, {
            body: typeof newContent.body === 'string' ? newContent.body : (ev.content.body as string).replace(/^\s*\*\s*/, ''),
            formattedBody: typeof newContent.formatted_body === 'string' ? newContent.formatted_body : undefined,
          });
          continue;
        }
        const r = ev.sender === currentUserId ? 'user' : 'assistant';
        eventMap.set(ev.event_id, { role: r, content: ev.content.body as string });
      }
      const out: NormalizedMessage[] = [];
      for (const ev of events) {
        if (ev.type === 'm.room.member' || ev.type === 'm.room.name') continue;
        // m.call.* 展示为「语音/视频通话」占位条
        if (typeof ev.type === 'string' && ev.type.startsWith('m.call.')) {
          out.push({
            id: ev.event_id,
            role: 'system',
            content: '',
            eventType: ev.type,
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
        let formattedBody = typeof (ev.content as { formatted_body?: string })?.formatted_body === 'string'
          ? (ev.content as { formatted_body: string }).formatted_body
          : undefined;
        const replacement = replacementByEventId.get(ev.event_id);
        if (replacement) {
          body = replacement.body;
          if (replacement.formattedBody != null) formattedBody = replacement.formattedBody;
        }
        eventMap.set(ev.event_id, { role: r, content: body });
        const replyEventId = (ev.content as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } })['m.relates_to']?.['m.in_reply_to']?.event_id;
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
          ...(formattedBody ? { formattedBody } : {}),
          backendMessageId: ev.event_id,
          createdAt: ev.origin_server_ts,
          inReplyTo,
        });
      }
      out.reverse();
      return { messages: out, nextToken };
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

      const { body: msgBody, formattedBody: msgFormattedBody } = processMessageText(message);
      await sendRoomMessage(
        roomId,
        msgBody,
        'm.text',
        userToken,
        params.replyToMessageId,
        msgFormattedBody || undefined
      );

      // 若 @ 了机器人且配置了 Dify，经 SSE 推送助手流，并可选写入 Matrix（以 bot 身份）
      // Dify 的 conversation_id 须为空或 Dify 返回的 UUID，不能传 Matrix roomId，否则 400
      if (params.botIds?.length && config.dify.apiKey) {
        const fullAnswer = await runStreamWithParams(
          {
            message,
            conversation_id: '',
            user_id: userId,
          },
          send,
          flush
        );
        if (fullAnswer?.trim() && config.matrix.botUserId && config.matrix.botAccessToken) {
          try {
            await inviteToRoom(roomId, config.matrix.botUserId, userToken);
          } catch {
            // 可能已在房间
          }
          try {
            await joinRoom(roomId, config.matrix.botAccessToken);
          } catch {
            // 可能已加入
          }
          try {
            const { body: botBody, formattedBody: botFormattedBody } = processMessageText(fullAnswer.trim());
            await sendRoomMessage(
              roomId,
              botBody,
              'm.text',
              config.matrix.botAccessToken,
              undefined,
              botFormattedBody || undefined
            );
          } catch {
            // 助手回复写入 Matrix 失败时仅忽略，用户已通过 SSE 看到回复
          }
        }
      }

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
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      // 仅邀请制：Client API 发送邀请，对方需接受后才在房间内
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

    async editMessage(params: EditMessageParams): Promise<void> {
      const { backendSessionId, sessionId, messageId, content, formattedBody, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      if (currentUserMxid) {
        const valid = await verifyMatrixTokenUserId(userToken, currentUserMxid);
        if (!valid) throw new Error(`token 不属于当前用户 (${currentUserMxid})`);
      }
      const roomId = backendSessionId || sessionId;
      const { body: msgBody, formattedBody: msgFormattedBody } = processMessageText(content);
      await editRoomMessage(roomId, messageId, msgBody, userToken, msgFormattedBody ?? formattedBody);
    },

    async redactMessage(params: RedactMessageParams): Promise<void> {
      const { backendSessionId, sessionId, messageId, matrixAccessToken: userToken, currentUserMxid } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      if (currentUserMxid) {
        const valid = await verifyMatrixTokenUserId(userToken, currentUserMxid);
        if (!valid) throw new Error(`token 不属于当前用户 (${currentUserMxid})`);
      }
      const roomId = backendSessionId || sessionId;
      await redactRoomMessage(roomId, messageId, userToken);
    },

    async listSessionMembers(params: ListSessionMembersParams): Promise<NormalizedRoomMember[]> {
      const { backendSessionId, sessionId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      const roomId = backendSessionId || sessionId;
      const [memberList, creator] = await Promise.all([
        getRoomMembers(roomId, userToken),
        getRoomCreator(roomId, userToken),
      ]);
      return memberList.map((m) => ({ ...m, isOwner: m.userId === creator }));
    },

    async kickFromSession(params: KickFromSessionParams): Promise<void> {
      const { backendSessionId, sessionId, targetUserId, matrixAccessToken: userToken, reason } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      const roomId = backendSessionId || sessionId;
      await kickFromRoom(roomId, targetUserId, userToken, reason);
    },

    async banFromSession(params: BanFromSessionParams): Promise<void> {
      const { backendSessionId, sessionId, targetUserId, matrixAccessToken: userToken, reason } = params;
      if (!userToken?.trim()) throw new Error('需要 Matrix 用户 token');
      const roomId = backendSessionId || sessionId;
      await banUserFromRoom(roomId, targetUserId, userToken, reason);
    },

    async getMessageEditHistory(params: GetMessageEditHistoryParams): Promise<EditHistoryEntry[]> {
      const { backendSessionId, sessionId, messageId, matrixAccessToken: userToken } = params;
      if (!userToken?.trim()) return [];
      const roomId = backendSessionId || sessionId;
      const [original, relations] = await Promise.all([
        getRoomEvent(roomId, messageId, userToken),
        getRoomRelations(roomId, messageId, 'm.replace', userToken),
      ]);
      const out: EditHistoryEntry[] = [];
      if (original && original.type === 'm.room.message' && original.content?.body != null) {
        const body = typeof original.content.body === 'string' ? original.content.body : '';
        const formattedBody = typeof (original.content as { formatted_body?: string }).formatted_body === 'string'
          ? (original.content as { formatted_body: string }).formatted_body
          : undefined;
        out.push({
          eventId: original.event_id,
          createdAt: original.origin_server_ts,
          body,
          formattedBody: formattedBody || undefined,
          sender: original.sender,
        });
      }
      for (const ev of relations) {
        if (ev.type !== 'm.room.message' || !ev.content) continue;
        const newContent = (ev.content as { 'm.new_content'?: { body?: string; formatted_body?: string } })['m.new_content'];
        if (!newContent || newContent.body == null) continue;
        const body = typeof newContent.body === 'string' ? newContent.body : '';
        const formattedBody = typeof newContent.formatted_body === 'string' ? newContent.formatted_body : undefined;
        out.push({
          eventId: ev.event_id,
          createdAt: ev.origin_server_ts,
          body,
          formattedBody,
          sender: ev.sender,
        });
      }
      out.sort((a, b) => a.createdAt - b.createdAt);
      return out;
    },
  };
}

export { isMatrixConfigured };
