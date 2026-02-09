/**
 * Matrix 会话后端适配器
 * 与 SESSION_ADAPTER_MATRIX.md 对应：Room = 会话，m.room.message = 消息
 * 使用 Matrix Client-Server API（matrixClient），流式回复由 Dify 产生并写入房间
 */
import {
  getJoinedRooms,
  getRoomName,
  getRoomMessages,
  sendRoomMessage,
  createRoom,
} from './matrixClient.js';
import { runStreamWithParams } from '../services/difyStream.js';
import { config } from '../config.js';
import type {
  ChatBackendAdapter,
  NormalizedSession,
  NormalizedMessage,
  StreamMessageParams,
  StreamMessageResult,
  ListSessionsParams,
  ListMessagesParams,
  SSESend,
} from './types.js';

function isMatrixConfigured(): boolean {
  const { matrix } = config;
  return Boolean(matrix.baseUrl && (matrix.accessToken || (matrix.userId && matrix.password)));
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

    async listSessions(_params: ListSessionsParams): Promise<NormalizedSession[]> {
      const roomIds = await getJoinedRooms();
      const sessions: NormalizedSession[] = [];
      for (const roomId of roomIds) {
        let title = roomId;
        try {
          title = await getRoomName(roomId);
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
      // 按 updatedAt 需额外请求，此处简化为当前时间
      sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return sessions;
    },

    async listMessages(params: ListMessagesParams): Promise<NormalizedMessage[]> {
      const { sessionId, backendSessionId, userId, limit = 50, beforeId } = params;
      const roomId = backendSessionId || sessionId;
      const { events } = await getRoomMessages(
        roomId,
        Math.min(Number(limit) || 50, 100),
        beforeId ?? undefined
      );
      const currentUserId = config.matrix.userId || userId;
      const out: NormalizedMessage[] = [];
      for (const ev of events) {
        const sender = ev.sender;
        const body = typeof ev.content?.body === 'string' ? ev.content.body : '';
        const role = sender === currentUserId ? 'user' : 'assistant';
        out.push({
          id: ev.event_id,
          role,
          content: body,
          backendMessageId: ev.event_id,
          createdAt: ev.origin_server_ts,
        });
      }
      out.reverse();
      return out;
    },

    async streamMessage(params: StreamMessageParams): Promise<StreamMessageResult | void> {
      const { sessionId, backendSessionId, message, userId, send, flush } = params;
      let roomId = backendSessionId || sessionId;

      if (!roomId) {
        const created = await createRoom();
        roomId = created.room_id;
        send('session_created', { session_id: roomId, backend_session_id: roomId });
        flush();
      }

      await sendRoomMessage(roomId, message, 'm.text');

      let accumulated = '';
      const wrappingSend: SSESend = (event: string, data: Record<string, unknown>) => {
        if (event === 'message' && data && typeof data.delta === 'string') {
          accumulated += data.delta;
        }
        send(event, data);
      };

      if (config.dify.apiKey) {
        await runStreamWithParams(
          {
            message,
            conversation_id: roomId,
            user_id: userId,
          },
          wrappingSend,
          flush,
          config.dify
        );
        if (accumulated.trim()) {
          await sendRoomMessage(roomId, accumulated.trim(), 'm.text');
        }
      } else {
        send('status', { status: 'thinking' });
        flush();
        const placeholder = '（当前未配置 Dify，仅消息已写入 Matrix）';
        send('message', { delta: placeholder });
        flush();
        send('message_end', {});
        flush();
        await sendRoomMessage(roomId, placeholder, 'm.text');
      }

      return { backendSessionId: roomId };
    },
  };
}

export { isMatrixConfigured };
