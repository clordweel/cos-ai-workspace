/**
 * 会话与聊天 API：按 config.chat.provider 使用 mock 或 matrix 适配器（在 api 内实现）
 */
import type { FastifyInstance } from 'fastify';
import { getSessionFromCookie, getStableUserId } from '../services/sessionStore.js';
import { getChatAdapter } from '../adapters/index.js';
import { getMockChatAdapter } from '../adapters/mockChat.js';

function getAdapter(req: { log: { error: (e: unknown) => void } }) {
  const adapter = getChatAdapter();
  if (!adapter) {
    req.log.error('getChatAdapter 返回 null，回退 mock');
    return getMockChatAdapter();
  }
  return adapter;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sessions', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);
    try {
      const sessions = await adapter.listSessions({
        userId,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.matrixUserId,
      });
      return reply.send({ sessions });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取会话列表失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post('/api/sessions', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const body = (req.body as { title?: string }) || {};
    const adapter = getAdapter(req);
    try {
      const created = await adapter.createSession({
        userId,
        title: body.title?.trim(),
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.matrixUserId,
      });
      return reply.send(created);
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '创建会话失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get<{ Params: { id?: string }; Querystring: { limit?: string; before_id?: string } }>(
    '/api/sessions/:id/messages',
    async (req, reply) => {
      const sessionId = req.params?.id;
      if (!sessionId) {
        return reply.code(400).send({ error: 'session id is required' });
      }
      const session = await getSessionFromCookie(req.headers.cookie);
      const userId = session ? getStableUserId(session) : 'default';
      const limit = req.query?.limit ? Number(req.query.limit) : 50;
      const beforeId = req.query?.before_id;
      const adapter = getAdapter(req);
      try {
        const result = await adapter.listMessages({
          sessionId: decodeURIComponent(sessionId),
          userId,
          limit,
          beforeId: beforeId || undefined,
          matrixAccessToken: session?.matrixAccessToken,
          currentUserMxid: session?.matrixUserId,
        });
        return reply.send({
          messages: result.messages,
          next_token: result.nextToken,
        });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '拉取会话历史失败',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  app.post('/api/chat/stream', async (req, reply) => {
    const body = (req.body as {
      message?: string;
      conversation_id?: string;
      user_id?: string;
      reply_to_message_id?: string;
    }) || {};
    const { message, conversation_id } = body;
    if (!message || typeof message !== 'string') {
      return reply.code(400).send({ error: 'message is required' });
    }

    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);

    const origin = req.headers.origin || '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    const send: (event: string, data: Record<string, unknown>) => void = (event, data) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const flush = () => {
      reply.raw.flushHeaders?.();
    };

    try {
      await adapter.streamMessage({
        sessionId: conversation_id || '',
        backendSessionId: conversation_id || undefined,
        message,
        userId,
        send,
        flush,
        replyToMessageId: body.reply_to_message_id,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.matrixUserId,
      });
    } catch (e) {
      req.log.error(e);
      send('error', { message: e instanceof Error ? e.message : String(e) });
      flush();
    } finally {
      reply.raw.end();
    }
  });
}
