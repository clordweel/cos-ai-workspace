/**
 * 会话与聊天 API：按 config.chat.provider 使用 mock 或 matrix 适配器（在 api 内实现）
 * 路由顺序：/api/sessions/invited 必须在 /api/sessions/:id 之前注册，否则 "invited" 会被当作 id。
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { getSessionFromCookie, getStableUserId } from '../services/sessionStore.js';
import { ensureMatrixTokenForSession } from '../services/matrixSessionToken.js';
import { getChatAdapter } from '../adapters/index.js';
import { getMockChatAdapter } from '../adapters/mockChat.js';
import { config } from '../config.js';
import type { Session } from '../services/sessionStore.js';

function getAdapter(req: { log: { error: (e: unknown) => void } }) {
  const adapter = getChatAdapter();
  if (!adapter) {
    req.log.error('getChatAdapter 返回 null，回退 mock');
    return getMockChatAdapter();
  }
  return adapter;
}

/** Matrix 时确保 session 有 matrixAccessToken；若已 reply 则返回 false，否则返回 true 并可能已更新 session */
async function ensureMatrixTokenAndSession(
  session: Session | null,
  reply: FastifyReply
): Promise<{ ok: true; session: Session } | { ok: false }> {
  if (config.chat.provider !== 'matrix' || !session?.logtoSub) {
    return session ? { ok: true, session } : { ok: false };
  }
  if (session.matrixAccessToken?.trim()) {
    return { ok: true, session };
  }
  const tokenResult = await ensureMatrixTokenForSession(session);
  if (tokenResult && 'access_token' in tokenResult) {
    session.matrixAccessToken = tokenResult.access_token;
    session.matrixUserId = tokenResult.matrix_user_id ?? session.matrixUserId;
    session.matrixDeviceId = tokenResult.device_id ?? session.matrixDeviceId;
    return { ok: true, session };
  }
  const msg =
    tokenResult && 'error' in tokenResult
      ? tokenResult.error === 'user_not_synced'
        ? 'Matrix 用户未同步，请刷新页面后重试'
        : tokenResult.message || '无法获取 Matrix 登录态'
      : '需要 Matrix 用户 token（请先登录）';
  await reply.code(401).send({ error: '未就绪', message: msg });
  return { ok: false };
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  /** 待接受邀请列表（Element 风格），仅 Matrix 有数据 */
  app.get('/api/sessions/invited', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    let sess = session;
    if (session && config.chat.provider === 'matrix') {
      const ensured = await ensureMatrixTokenAndSession(session, reply);
      if (!ensured.ok) return;
      sess = ensured.session;
    }
    const adapter = getAdapter(req);
    if (!('listInvitedSessions' in adapter) || typeof adapter.listInvitedSessions !== 'function') {
      return reply.send({ invited: [] });
    }
    try {
      const invited = await adapter.listInvitedSessions({
        userId,
        matrixAccessToken: sess?.matrixAccessToken,
      });
      return reply.send({ invited });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取邀请列表失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get('/api/sessions', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    let sess = session;
    if (session && config.chat.provider === 'matrix') {
      const ensured = await ensureMatrixTokenAndSession(session, reply);
      if (!ensured.ok) return;
      sess = ensured.session;
    }
    const adapter = getAdapter(req);
    try {
      const sessions = await adapter.listSessions({
        userId,
        matrixAccessToken: sess?.matrixAccessToken,
        currentUserMxid: sess?.matrixUserId,
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
    if (!session && config.chat.provider === 'matrix') {
      return reply.code(401).send({ error: '未登录', message: '请先使用 Logto 登录' });
    }
    let sess = session;
    if (session && config.chat.provider === 'matrix') {
      const ensured = await ensureMatrixTokenAndSession(session, reply);
      if (!ensured.ok) return;
      sess = ensured.session;
    }
    const userId = sess ? getStableUserId(sess) : 'default';
    const body = (req.body as { title?: string }) || {};
    const adapter = getAdapter(req);
    try {
      const created = await adapter.createSession({
        userId,
        title: body.title?.trim(),
        matrixAccessToken: sess?.matrixAccessToken,
        currentUserMxid: sess?.matrixUserId,
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

  app.post('/api/sessions/:id/join', async (req, reply) => {
    const sessionId = (req.params as { id?: string })?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);
    if (!('joinSession' in adapter) || typeof adapter.joinSession !== 'function') {
      return reply.code(501).send({ error: '当前后端不支持接受邀请' });
    }
    try {
      await adapter.joinSession({
        sessionId: decodeURIComponent(sessionId),
        userId,
        matrixAccessToken: session?.matrixAccessToken,
      });
      return reply.send({ ok: true });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '接受邀请失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post('/api/sessions/:id/leave', async (req, reply) => {
    const sessionId = (req.params as { id?: string })?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);
    if (!('leaveSession' in adapter) || typeof adapter.leaveSession !== 'function') {
      return reply.code(501).send({ error: '当前后端不支持离开会话' });
    }
    try {
      await adapter.leaveSession({
        sessionId: decodeURIComponent(sessionId),
        userId,
        matrixAccessToken: session?.matrixAccessToken,
      });
      return reply.send({ ok: true });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '离开会话失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get('/api/sessions/:id/members', async (req, reply) => {
    const sessionId = (req.params as { id?: string })?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);
    if (!('listSessionMembers' in adapter) || typeof adapter.listSessionMembers !== 'function') {
      return reply.send({ members: [] });
    }
    try {
      const members = await adapter.listSessionMembers({
        sessionId: decodeURIComponent(sessionId),
        userId,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.matrixUserId,
      });
      return reply.send({ members });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取成员失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  /** 当前用户是否为该会话（房间）创建者；用于删除时区分「删除」与「退出」 */
  app.get('/api/sessions/:id/creator', async (req, reply) => {
    const sessionId = (req.params as { id?: string })?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    let session = await getSessionFromCookie(req.headers.cookie);
    if (session && config.chat.provider === 'matrix') {
      const ensured = await ensureMatrixTokenAndSession(session, reply);
      if (!ensured.ok) return;
      session = ensured.session;
    }
    const adapter = getAdapter(req);
    if (!('getSessionCreator' in adapter) || typeof adapter.getSessionCreator !== 'function') {
      return reply.send({ isCreator: false });
    }
    try {
      const creator = await adapter.getSessionCreator({
        sessionId: decodeURIComponent(sessionId),
        matrixAccessToken: session?.matrixAccessToken,
      });
      const isCreator =
        typeof creator === 'string' &&
        creator.length > 0 &&
        session?.matrixUserId != null &&
        session.matrixUserId === creator;
      return reply.send({ isCreator: !!isCreator });
    } catch (e) {
      req.log.error(e);
      return reply.send({ isCreator: false });
    }
  });

  /** 重命名会话（如 Matrix 房间名称） */
  app.patch('/api/sessions/:id', async (req, reply) => {
    const sessionId = (req.params as { id?: string })?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    const body = (req.body as { title?: string }) || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return reply.code(400).send({ error: 'title is required' });
    let session = await getSessionFromCookie(req.headers.cookie);
    if (session && config.chat.provider === 'matrix') {
      const ensured = await ensureMatrixTokenAndSession(session, reply);
      if (!ensured.ok) return;
      session = ensured.session;
    }
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);
    if (!('renameSession' in adapter) || typeof adapter.renameSession !== 'function') {
      return reply.code(501).send({ error: '当前后端不支持重命名会话' });
    }
    try {
      await adapter.renameSession({
        sessionId: decodeURIComponent(sessionId),
        title,
        userId,
        matrixAccessToken: session?.matrixAccessToken,
      });
      return reply.send({ ok: true });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '重命名失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // user_id：支持完整 MXID（@localpart:server）或本服务器的 logtoSub/username，后端会解析为 MXID
  app.post('/api/sessions/:id/invite', async (req, reply) => {
    const sessionId = (req.params as { id?: string })?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    const body = (req.body as { user_id?: string }) || {};
    const inviteeUserId = body.user_id?.trim();
    if (!inviteeUserId) return reply.code(400).send({ error: 'user_id is required' });
    const session = await getSessionFromCookie(req.headers.cookie);
    const userId = session ? getStableUserId(session) : 'default';
    const adapter = getAdapter(req);
    if (!('inviteToSession' in adapter) || typeof adapter.inviteToSession !== 'function') {
      return reply.code(501).send({ error: '当前后端不支持邀请' });
    }
    try {
      await adapter.inviteToSession({
        sessionId: decodeURIComponent(sessionId),
        inviteeUserId,
        userId,
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
  });

  app.post('/api/chat/stream', async (req, reply) => {
    const body = (req.body as {
      message?: string;
      conversation_id?: string;
      user_id?: string;
      reply_to_message_id?: string;
      bot_ids?: string[];
    }) || {};
    const { message, conversation_id, bot_ids: botIdsRaw } = body;
    const botIds = Array.isArray(botIdsRaw) ? botIdsRaw.filter((id): id is string => typeof id === 'string') : undefined;
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
      try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (e) {
        /* 客户端已断开（如刷新）时写入会失败；记录便于排查「仅首字/首包到达 web」类问题 */
        req.log.warn({ err: e, event }, 'SSE write 失败，客户端可能已断开');
      }
    };
    const flush = () => {
      try {
        reply.raw.flushHeaders?.();
      } catch {
        /* 同上 */
      }
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
        botIds: botIds?.length ? botIds : undefined,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.matrixUserId,
      });
    } catch (e) {
      req.log.error(e);
      send('error', { message: e instanceof Error ? e.message : String(e) });
      flush();
    } finally {
      try {
        reply.raw.end();
      } catch {
        /* 连接已关闭时忽略 */
      }
    }
  });
}
