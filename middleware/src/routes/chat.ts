/**
 * 对话相关：流式 SSE、会话列表/历史（适配器驱动）、导出 Markdown（未登录也可会话）
 * 多用户：userId 优先从 Cookie 会话推导，无会话时用 body/query 或 'default'
 * Matrix 混合方案：provider 为 matrix 时会话 API 需 Logto 登录且 matrixAccessToken，否则 401
 */
import type { FastifyInstance } from 'fastify';
import { getChatAdapter } from '../adapters/index.js';
import { getSessionFromCookie, getStableUserId } from '../services/auth.js';
import { getMatrixUserId } from '../services/matrixUserSync.js';
import { ensureMatrixTokenForSession } from '../services/matrixSessionToken.js';
import { config } from '../config.js';
import { messagesToMarkdown } from '../services/exportMarkdown.js';

async function resolveUserId(req: { headers: { cookie?: string }; body?: unknown; query?: unknown }): Promise<string> {
  const session = await getSessionFromCookie(req.headers.cookie);
  if (session) return getStableUserId(session);
  const fromBody = (req.body as { user_id?: string })?.user_id;
  const fromQuery = (req.query as { user_id?: string; user?: string })?.user_id ?? (req.query as { user_id?: string; user?: string })?.user;
  return fromBody ?? fromQuery ?? 'default';
}

/** Matrix 时会话 API 需 Logto + matrixAccessToken；无 token 时先尝试自动获取，仍无则 401，返回 true 表示已 401；成功后可能已改写 session 的 matrixAccessToken */
async function requireMatrixToken(
  req: { headers: { cookie?: string } },
  session: Awaited<ReturnType<typeof getSessionFromCookie>>,
  reply: { code: (n: number) => { send: (body: object) => unknown } }
): Promise<boolean> {
  if (config.chat?.provider !== 'matrix') return false;
  if (!session?.logtoSub) {
    reply.code(401).send({ error: '需要登录' });
    return true;
  }
  if (!session.matrixAccessToken) {
    await ensureMatrixTokenForSession(session);
    const fresh = await getSessionFromCookie(req.headers.cookie);
    if (fresh?.matrixAccessToken) {
      session.matrixAccessToken = fresh.matrixAccessToken;
      session.matrixTokenExpiresAt = fresh.matrixTokenExpiresAt;
    }
  }
  if (!session.matrixAccessToken) {
    reply.code(401).send({ error: '无法使用会话，请稍后重试' });
    return true;
  }
  return false;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/chat/stream', async (req, reply) => {
    const body = (req.body as { message?: string; conversation_id?: string; user_id?: string }) || {};
    const { message, conversation_id } = body;
    if (!message) {
      return reply.code(400).send({ error: 'message is required' });
    }

    const adapter = getChatAdapter();
    const useAdapter = adapter && adapter.supportsStreaming();
    if (!useAdapter) {
      return reply.code(502).send({
        error: '聊天后端未配置',
        message: '请设置 CHAT_PROVIDER（如 mock 用于调试）',
      });
    }

    const session = await getSessionFromCookie(req.headers.cookie);
    if (await requireMatrixToken(req, session, reply)) return;

    const userId = await resolveUserId(req);

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
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.logtoSub ? getMatrixUserId(session.logtoSub, session.userProfile?.username) : undefined,
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
    const session = await getSessionFromCookie(req.headers.cookie);
    if (await requireMatrixToken(req, session, reply)) return;

    const userId = await resolveUserId(req);
    try {
      const list = await adapter.listSessions({
        userId,
        matrixAccessToken: session?.matrixAccessToken,
      });
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
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;

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
          matrixAccessToken: session?.matrixAccessToken,
          currentUserMxid: session?.logtoSub ? getMatrixUserId(session.logtoSub, session.userProfile?.username) : undefined,
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

  app.post('/api/sessions', async (req, reply) => {
    const adapter = getChatAdapter();
    if (!adapter || typeof adapter.createSession !== 'function') {
      return reply.code(501).send({
        error: '当前后端不支持创建会话',
        message: '请使用支持 createSession 的 CHAT_PROVIDER（如 matrix）',
      });
    }
    const session = await getSessionFromCookie(req.headers.cookie);
    if (await requireMatrixToken(req, session, reply)) return;

    const userId = await resolveUserId(req);
    const body = (req.body as { title?: string }) || {};
    try {
      const created = await adapter.createSession({
        userId,
        title: body.title,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.logtoSub ? getMatrixUserId(session.logtoSub, session.userProfile?.username) : undefined,
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

  app.post<{ Params: { id?: string }; Body: { inviteeUserId?: string } }>(
    '/api/sessions/:id/invite',
    async (req, reply) => {
      const adapter = getChatAdapter();
      if (!adapter || typeof adapter.inviteToSession !== 'function') {
        return reply.code(501).send({
          error: '当前后端不支持邀请成员',
          message: '请使用支持 inviteToSession 的 CHAT_PROVIDER（如 matrix）',
        });
      }
      const sessionId = req.params?.id;
      if (!sessionId) {
        return reply.code(400).send({ error: 'session id is required' });
      }
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;

      const body = (req.body as { inviteeUserId?: string }) || {};
      const inviteeUserId = body.inviteeUserId?.trim();
      if (!inviteeUserId) {
        return reply.code(400).send({ error: 'inviteeUserId is required' });
      }
      const inviteeMxid = inviteeUserId.includes(':') ? inviteeUserId : getMatrixUserId(inviteeUserId);
      const userId = await resolveUserId(req);
      try {
        await adapter.inviteToSession({
          sessionId,
          backendSessionId: sessionId,
          userId,
          inviteeUserId,
          inviteeMxid,
          matrixAccessToken: session?.matrixAccessToken,
        });
        return reply.send({ ok: true });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '邀请失败',
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
