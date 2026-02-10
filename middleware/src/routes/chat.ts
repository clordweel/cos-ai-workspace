/**
 * 对话相关：流式 SSE、会话列表/历史（适配器驱动）、导出 Markdown（未登录也可会话）
 * 多用户：userId 优先从 Cookie 会话推导，无会话时用 body/query 或 'default'
 */
import type { FastifyInstance } from 'fastify';
import { getChatAdapter } from '../adapters/index.js';
import { getSessionFromCookie, getStableUserId } from '../services/auth.js';
import { messagesToMarkdown } from '../services/exportMarkdown.js';

async function resolveUserId(req: { headers: { cookie?: string }; body?: unknown; query?: unknown }): Promise<string> {
  const session = await getSessionFromCookie(req.headers.cookie);
  if (session) return getStableUserId(session);
  const fromBody = (req.body as { user_id?: string })?.user_id;
  const fromQuery = (req.query as { user_id?: string; user?: string })?.user_id ?? (req.query as { user_id?: string; user?: string })?.user;
  return fromBody ?? fromQuery ?? 'default';
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/chat/stream', async (req, reply) => {
    const body = (req.body as { message?: string; conversation_id?: string; user_id?: string }) || {};
    const { message, conversation_id } = body;
    if (!message) {
      return reply.code(400).send({ error: 'message is required' });
    }
    const userId = await resolveUserId(req);

    const adapter = getChatAdapter();
    const useAdapter = adapter && adapter.supportsStreaming();
    if (!useAdapter) {
      return reply.code(502).send({
        error: '聊天后端未配置',
        message: '请设置 CHAT_PROVIDER（如 mock 用于调试）',
      });
    }

    const origin = req.headers.origin || '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    const send = (event: string, data: Record<string, unknown>) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const flush = () => {
      const raw = reply.raw as unknown as { flush?: () => void };
      if (typeof raw.flush === 'function') raw.flush();
    };

    try {
      await adapter.streamMessage({
        sessionId: conversation_id || '',
        backendSessionId: conversation_id || undefined,
        message,
        userId,
        send,
        flush,
      });
    } catch (e) {
      req.log.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      const err = e as { statusCode?: number };
      send('error', {
        message: errMsg,
        ...(err.statusCode && { statusCode: err.statusCode }),
      });
      send('message', { delta: `错误：${errMsg}` });
      flush();
    } finally {
      reply.raw.end();
    }
  });

  app.get('/api/sessions', async (req, reply) => {
    const adapter = getChatAdapter();
    if (
      !adapter ||
      !adapter.supportsListSessions() ||
      typeof adapter.listSessions !== 'function'
    ) {
      return reply.code(501).send({
        error: '当前后端不支持会话列表',
        message: '请使用支持 listSessions 的 CHAT_PROVIDER（如 mock）',
      });
    }
    const userId = await resolveUserId(req);
    try {
      const list = await adapter.listSessions({ userId });
      return reply.send({ sessions: list });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取会话列表失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get<{ Params: { id?: string }; Querystring: { user_id?: string; user?: string; limit?: string; before_id?: string } }>(
    '/api/sessions/:id/messages',
    async (req, reply) => {
      const adapter = getChatAdapter();
      if (
        !adapter ||
        !adapter.supportsListMessages() ||
        typeof adapter.listMessages !== 'function'
      ) {
        return reply.code(501).send({
          error: '当前后端不支持会话历史',
          message: '请使用支持 listMessages 的 CHAT_PROVIDER（如 mock）',
        });
      }
      const sessionId = req.params?.id;
      if (!sessionId) {
        return reply.code(400).send({ error: 'session id is required' });
      }
      const userId = await resolveUserId(req);
      const limit = req.query?.limit ?? 50;
      const beforeId = req.query?.before_id;
      try {
        const messages = await adapter.listMessages({
          sessionId,
          backendSessionId: sessionId,
          userId,
          limit: Number(limit) || 50,
          beforeId: beforeId || undefined,
        });
        return reply.send({ messages });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '拉取会话历史失败',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  app.post('/api/chat/export-markdown', async (req, reply) => {
    const body = (req.body as { messages?: Array<{ role: 'user' | 'assistant'; content?: string; thinking?: string }> }) || {};
    const messages = body.messages ?? [];
    const markdown = messagesToMarkdown(messages);
    return reply.send({ markdown });
  });
}
