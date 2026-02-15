/**
 * 会话与聊天 API（阶段 3.1）：与现 middleware 路径与响应结构对齐，mock 适配器
 */
import type { FastifyInstance } from 'fastify';
import { getSessionFromCookie, getStableUserId } from '../services/sessionStore.js';
import { getMockChatAdapter } from '../adapters/mockChat.js';

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const adapter = getMockChatAdapter();

  app.get('/api/sessions', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    try {
      const sessions = await adapter.listSessions({ userId });
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
    try {
      const created = await adapter.createSession({
        userId,
        title: body.title?.trim(),
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
      try {
        const result = await adapter.listMessages({
          sessionId: decodeURIComponent(sessionId),
          userId,
          limit,
          beforeId: beforeId || undefined,
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

    const origin = req.headers.origin || '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
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
