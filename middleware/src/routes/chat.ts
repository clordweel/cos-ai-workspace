/**
 * 对话相关：流式 SSE、会话列表/历史（适配器驱动）、导出 Markdown（未登录也可会话）
 * 多用户：userId 优先从 Cookie 会话推导，无会话时用 body/query 或 'default'
 * Matrix 混合方案：provider 为 matrix 时会话 API 需 Logto 登录且 matrixAccessToken，否则 401
 */
import type { FastifyInstance } from 'fastify';
import { getChatAdapter } from '../adapters/index.js';
import { getSessionFromCookie, getStableUserId, updateSession } from '../services/auth.js';
import { getMatrixUserId, getMatrixUserIdForSession, ensureMatrixUser } from '../services/matrixUserSync.js';
import {
  verifyMatrixTokenUserId,
  getMatrixUserIdFromToken,
  getMatrixAdminUserId,
  getAccountData,
  setAccountData,
  getInvitedRooms,
  joinRoom,
} from '../adapters/matrixClient.js';
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

const MATRIX_TOKEN_ERROR_MESSAGES: Record<string, string> = {
  user_not_synced: '用户未同步到 Matrix，请联系管理员',
  user_deactivated: 'Matrix 用户已停用，无法使用会话',
  token_failed: '无法使用会话，请稍后重试',
};

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
    if (session.logtoSub) {
      await ensureMatrixUser(
        session.logtoSub,
        session.userProfile?.name ?? session.user,
        session.userProfile?.email,
        session.userProfile?.phone,
        session.userProfile?.username
      ).catch(() => {});
    }
    const ensured = await ensureMatrixTokenForSession(session);
    const fresh = await getSessionFromCookie(req.headers.cookie);
    if (fresh?.matrixAccessToken) {
      session.matrixAccessToken = fresh.matrixAccessToken;
      session.matrixTokenExpiresAt = fresh.matrixTokenExpiresAt;
    }
    if (!session.matrixAccessToken) {
      const errMsg =
        ensured && 'error' in ensured
          ? MATRIX_TOKEN_ERROR_MESSAGES[ensured.error] ?? ensured.message ?? '无法使用会话，请稍后重试'
          : '无法使用会话，请稍后重试';
      reply.code(401).send({ error: errMsg });
      return true;
    }
  }
  // 确保使用最新 session（避免竞态导致使用错误的 token）
  const latest = await getSessionFromCookie(req.headers.cookie);
  if (latest?.matrixAccessToken) {
    session.matrixAccessToken = latest.matrixAccessToken;
    session.matrixTokenExpiresAt = latest.matrixTokenExpiresAt;
  }
  return false;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/chat/stream', async (req, reply) => {
    const body = (req.body as {
      message?: string;
      conversation_id?: string;
      user_id?: string;
      reply_to_message_id?: string;
      bot_ids?: string[];
    }) || {};
    const { message, conversation_id, reply_to_message_id, bot_ids } = body;
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

    // Matrix 适配器必须使用当前用户 token，否则消息会归属到 admin
    if (adapter?.name === 'matrix' && !session?.matrixAccessToken) {
      return reply.code(401).send({ error: '需要 Matrix 会话，请刷新后重试' });
    }

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
        replyToMessageId: reply_to_message_id?.trim() || undefined,
        botIds: Array.isArray(bot_ids) ? bot_ids.filter((id): id is string => typeof id === 'string') : undefined,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid: session?.logtoSub
          ? getMatrixUserIdForSession(session.logtoSub, session.userProfile?.username, session.matrixUserId)
          : undefined,
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
    try {
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

      // 校验 token 属于当前用户；admin token 需清除刷新，否则采纳
      let expectedMxid = getMatrixUserIdForSession(
        session!.logtoSub,
        session!.userProfile?.username,
        session!.matrixUserId
      );
      const tokenValid = await verifyMatrixTokenUserId(
        session!.matrixAccessToken!,
        expectedMxid
      );
      if (!tokenValid && session!.logtoSub) {
        const actualUserId = await getMatrixUserIdFromToken(session!.matrixAccessToken!);
        const adminUserId = await getMatrixAdminUserId();
        if (actualUserId && adminUserId && actualUserId === adminUserId) {
          if (expectedMxid === adminUserId) {
            session!.matrixUserId = actualUserId;
          } else {
            session!.matrixAccessToken = undefined;
            session!.matrixTokenExpiresAt = undefined;
            await updateSession(session!.sessionId, {
              matrixAccessToken: undefined,
              matrixTokenExpiresAt: undefined,
              matrixDeviceId: undefined,
            });
            await ensureMatrixTokenForSession(session!);
            const fresh = await getSessionFromCookie(req.headers.cookie);
            if (fresh?.matrixAccessToken) {
              session!.matrixAccessToken = fresh.matrixAccessToken;
              session!.matrixTokenExpiresAt = fresh.matrixTokenExpiresAt;
              const afterActual = await getMatrixUserIdFromToken(session!.matrixAccessToken!);
              if (afterActual && afterActual !== adminUserId) {
                await updateSession(session!.sessionId, { matrixUserId: afterActual });
                session!.matrixUserId = afterActual;
              }
            }
            if (!session!.matrixAccessToken) {
              return reply.code(401).send({
                error: 'Matrix token 已失效，请刷新后重试',
              });
            }
          }
        } else if (actualUserId && actualUserId !== adminUserId) {
          await updateSession(session!.sessionId, { matrixUserId: actualUserId });
          session!.matrixUserId = actualUserId;
        } else {
          return reply.code(401).send({
            error: 'Matrix token 已失效，请刷新后重试',
          });
        }
      }

      const userId = await resolveUserId(req);
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

  /** Matrix 置顶会话：读写 account_data com.workspace.pinned_rooms，仅 provider=matrix 时有效 */
  const PINNED_ACCOUNT_DATA_TYPE = 'com.workspace.pinned_rooms';

  app.get('/api/sessions/pinned', async (req, reply) => {
    if (config.chat?.provider !== 'matrix') {
      return reply.code(501).send({ error: '当前后端不支持置顶列表', pinnedRoomIds: [] });
    }
    try {
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;
      const data = await getAccountData(session!.matrixAccessToken!, PINNED_ACCOUNT_DATA_TYPE);
      const pinnedRoomIds = Array.isArray(data.pinnedRoomIds)
        ? (data.pinnedRoomIds as string[]).filter((id): id is string => typeof id === 'string')
        : [];
      return reply.send({ pinnedRoomIds });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取置顶列表失败',
        pinnedRoomIds: [],
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.put('/api/sessions/pinned', async (req, reply) => {
    if (config.chat?.provider !== 'matrix') {
      return reply.code(501).send({ error: '当前后端不支持置顶列表' });
    }
    try {
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;
      const body = (req.body as { pinnedRoomIds?: unknown }) ?? {};
      const pinnedRoomIds = Array.isArray(body.pinnedRoomIds)
        ? (body.pinnedRoomIds as string[]).filter((id): id is string => typeof id === 'string')
        : [];
      await setAccountData(session!.matrixAccessToken!, PINNED_ACCOUNT_DATA_TYPE, { pinnedRoomIds });
      return reply.send({ pinnedRoomIds });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '保存置顶列表失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get<{ Params: { id?: string }; Querystring: { user_id?: string; user?: string; limit?: string; before_id?: string } }>(
    '/api/sessions/:id/messages',
    async (req, reply) => {
      try {
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
        const messages = await adapter.listMessages({
          sessionId,
          backendSessionId: sessionId,
          userId,
          limit: Number(limit) || 50,
          beforeId: beforeId || undefined,
          matrixAccessToken: session?.matrixAccessToken,
          currentUserMxid: session?.logtoSub
            ? getMatrixUserIdForSession(session.logtoSub, session.userProfile?.username, session.matrixUserId)
            : undefined,
        });
        return reply.send({ messages });
      } catch (e) {
        req.log.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        const isNotInRoom =
          msg.includes('not in room') && msg.includes('room previews are disabled');
        if (isNotInRoom) {
          return reply.code(403).send({
            error: '拉取会话历史失败',
            message: msg,
            code: 'USER_NOT_IN_ROOM',
          });
        }
        return reply.code(502).send({
          error: '拉取会话历史失败',
          message: msg,
        });
      }
    }
  );

  app.patch<{
    Params: { id: string; messageId: string };
    Body: { content?: string; formatted_body?: string };
  }>('/api/sessions/:id/messages/:messageId', async (req, reply) => {
    try {
      const adapter = getChatAdapter();
      if (!adapter || typeof adapter.editMessage !== 'function') {
        return reply.code(501).send({
          error: '当前后端不支持编辑消息',
          message: '请使用支持 editMessage 的 CHAT_PROVIDER（如 matrix）',
        });
      }
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;
      const sessionId = decodeURIComponent(req.params.id ?? '');
      const messageId = decodeURIComponent(req.params.messageId ?? '');
      if (!messageId) {
        return reply.code(400).send({ error: 'messageId is required' });
      }
      const body = (req.body as { content?: string; formatted_body?: string }) ?? {};
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!content) {
        return reply.code(400).send({ error: 'content is required' });
      }
      const userId = await resolveUserId(req);
      const currentUserMxid = session?.logtoSub
        ? getMatrixUserIdForSession(
            session.logtoSub,
            session.userProfile?.username,
            session.matrixUserId
          )
        : undefined;
      await adapter.editMessage({
        sessionId,
        backendSessionId: sessionId,
        messageId,
        content,
        formattedBody: typeof body.formatted_body === 'string' ? body.formatted_body : undefined,
        userId,
        matrixAccessToken: session?.matrixAccessToken,
        currentUserMxid,
      });
      return reply.send({ ok: true });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '编辑消息失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.delete<{ Params: { id: string; messageId: string } }>(
    '/api/sessions/:id/messages/:messageId',
    async (req, reply) => {
      try {
        const adapter = getChatAdapter();
        if (!adapter || typeof adapter.redactMessage !== 'function') {
          return reply.code(501).send({
            error: '当前后端不支持撤回/删除消息',
            message: '请使用支持 redactMessage 的 CHAT_PROVIDER（如 matrix）',
          });
        }
        const session = await getSessionFromCookie(req.headers.cookie);
        if (await requireMatrixToken(req, session, reply)) return;
        const sessionId = decodeURIComponent(req.params.id ?? '');
        const messageId = decodeURIComponent(req.params.messageId ?? '');
        if (!messageId) {
          return reply.code(400).send({ error: 'messageId is required' });
        }
        const userId = await resolveUserId(req);
        const currentUserMxid = session?.logtoSub
          ? getMatrixUserIdForSession(
              session.logtoSub,
              session.userProfile?.username,
              session.matrixUserId
            )
          : undefined;
        await adapter.redactMessage({
          sessionId,
          backendSessionId: sessionId,
          messageId,
          userId,
          matrixAccessToken: session?.matrixAccessToken,
          currentUserMxid,
        });
        return reply.send({ ok: true });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '撤回消息失败',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  app.post('/api/sessions', async (req, reply) => {
    try {
      const adapter = getChatAdapter();
      if (!adapter || typeof adapter.createSession !== 'function') {
        return reply.code(501).send({
          error: '当前后端不支持创建会话',
          message: '请使用支持 createSession 的 CHAT_PROVIDER（如 matrix）',
        });
      }
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;
      if (!session?.matrixAccessToken?.trim()) {
        return reply.code(401).send({ error: '需要 Matrix 会话，请刷新后重试' });
      }

      // 校验 token 属于当前用户；admin token 需清除刷新，否则采纳（MXID 可能不同）
      let currentUserMxid: string | undefined =
        session?.logtoSub
          ? getMatrixUserIdForSession(
              session.logtoSub,
              session.userProfile?.username,
              session.matrixUserId
            )
          : undefined;

      if (session.logtoSub && currentUserMxid) {
        const tokenValid = await verifyMatrixTokenUserId(
          session.matrixAccessToken!,
          currentUserMxid
        );
        if (!tokenValid) {
          const actualUserId = await getMatrixUserIdFromToken(session.matrixAccessToken!);
          const adminUserId = await getMatrixAdminUserId();
          if (actualUserId && adminUserId && actualUserId === adminUserId) {
            if (currentUserMxid === adminUserId) {
              req.log.info(
                { mxid: currentUserMxid, sessionId: session.sessionId },
                'createSession: 当前用户即为 Matrix 管理员，采纳 token'
              );
              currentUserMxid = actualUserId;
            } else {
              req.log.info(
                { expectedMxid: currentUserMxid, sessionId: session.sessionId },
                'createSession: token 为 admin 但当前用户非 admin，清除并重新获取'
              );
              session.matrixAccessToken = undefined;
              session.matrixTokenExpiresAt = undefined;
              await updateSession(session.sessionId, {
                matrixAccessToken: undefined,
                matrixTokenExpiresAt: undefined,
                matrixDeviceId: undefined,
              });
              await ensureMatrixTokenForSession(session);
              const fresh = await getSessionFromCookie(req.headers.cookie);
              if (fresh?.matrixAccessToken) {
                session.matrixAccessToken = fresh.matrixAccessToken;
                session.matrixTokenExpiresAt = fresh.matrixTokenExpiresAt;
              }
              if (!session.matrixAccessToken?.trim()) {
                return reply.code(401).send({
                  error: 'Matrix token 已失效，请刷新页面后重试',
                });
              }
              const afterActual = await getMatrixUserIdFromToken(session.matrixAccessToken!);
              if (!afterActual) {
                return reply.code(401).send({
                  error: 'Matrix token 无效，请刷新页面后重试',
                });
              }
              if (afterActual === adminUserId && afterActual !== currentUserMxid) {
                req.log.warn(
                  { expectedMxid: currentUserMxid, actualUserId: afterActual, sessionId: session.sessionId },
                  'createSession: 刷新后仍为 admin token，请退出登录后重新登录'
                );
                return reply.code(401).send({
                  error: '无法获取用户会话，请退出登录后重新登录',
                });
              }
              currentUserMxid = afterActual;
              await updateSession(session.sessionId, { matrixUserId: afterActual });
              session.matrixUserId = afterActual;
            }
          } else if (actualUserId && actualUserId !== adminUserId) {
            req.log.info(
              { expectedMxid: currentUserMxid, actualUserId, sessionId: session.sessionId },
              'createSession: token 属用户但 MXID 与 Logto 推导不一致，采纳 token 并更新 session'
            );
            await updateSession(session.sessionId, { matrixUserId: actualUserId });
            session.matrixUserId = actualUserId;
            currentUserMxid = actualUserId;
          } else {
            return reply.code(401).send({
              error: 'Matrix token 已失效，请刷新页面后重试',
            });
          }
        }
      }

      const userId = await resolveUserId(req);
      const body = (req.body as { title?: string }) || {};
      const created = await adapter.createSession({
        userId,
        title: body.title,
        matrixAccessToken: session.matrixAccessToken,
        currentUserMxid,
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

  /** 待接受邀请列表（仅 Matrix：通过 sync 解析 rooms.invite） */
  app.get('/api/sessions/invited', async (req, reply) => {
    if (config.chat?.provider !== 'matrix') {
      return reply.send({ invited: [] });
    }
    const session = await getSessionFromCookie(req.headers.cookie);
    if (await requireMatrixToken(req, session, reply)) return;
    try {
      const list = await getInvitedRooms(session!.matrixAccessToken!);
      const invited = list.map((r) => ({ id: r.roomId, title: r.name || r.roomId }));
      return reply.send({ invited });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取邀请列表失败',
        message: e instanceof Error ? e.message : String(e),
        invited: [],
      });
    }
  });

  /** 接受邀请（仅 Matrix：join 房间） */
  app.post<{ Params: { id?: string } }>('/api/sessions/:id/join', async (req, reply) => {
    if (config.chat?.provider !== 'matrix') {
      return reply.code(501).send({ error: '当前后端不支持接受邀请' });
    }
    const roomId = req.params?.id;
    if (!roomId) return reply.code(400).send({ error: 'session id is required' });
    const session = await getSessionFromCookie(req.headers.cookie);
    if (await requireMatrixToken(req, session, reply)) return;
    try {
      await joinRoom(roomId, session!.matrixAccessToken!);
      return reply.send({ ok: true });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '接受邀请失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  /** 会话成员列表（仅 Matrix：join + invite） */
  app.get<{ Params: { id?: string } }>('/api/sessions/:id/members', async (req, reply) => {
    const adapter = getChatAdapter();
    if (!adapter || typeof adapter.listSessionMembers !== 'function') {
      return reply.send({ members: [] });
    }
    const sessionId = req.params?.id;
    if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
    const session = await getSessionFromCookie(req.headers.cookie);
    if (config.chat?.provider === 'matrix' && (await requireMatrixToken(req, session, reply))) return;
    try {
      const members = await adapter.listSessionMembers({
        sessionId,
        backendSessionId: sessionId,
        matrixAccessToken: session?.matrixAccessToken,
      });
      return reply.send({ members });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '拉取成员列表失败',
        message: e instanceof Error ? e.message : String(e),
        members: [],
      });
    }
  });

  /** 踢出会话 / 取消邀请（仅 Matrix：对目标用户 kick） */
  app.post<{ Params: { id?: string }; Body: { userId?: string; reason?: string } }>(
    '/api/sessions/:id/kick',
    async (req, reply) => {
      const adapter = getChatAdapter();
      if (!adapter || typeof adapter.kickFromSession !== 'function') {
        return reply.code(501).send({
          error: '当前后端不支持踢出/取消邀请',
          message: '请使用支持 kickFromSession 的 CHAT_PROVIDER（如 matrix）',
        });
      }
      const sessionId = req.params?.id;
      if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
      const body = (req.body as { userId?: string; reason?: string }) || {};
      const targetUserId = body.userId?.trim();
      if (!targetUserId) return reply.code(400).send({ error: 'userId is required' });
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;
      const targetMxid = targetUserId.includes(':') ? targetUserId : getMatrixUserId(targetUserId);
      try {
        await adapter.kickFromSession({
          sessionId,
          backendSessionId: sessionId,
          targetUserId: targetMxid,
          matrixAccessToken: session!.matrixAccessToken,
          reason: body.reason,
        });
        return reply.send({ ok: true });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '操作失败',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  /** 屏蔽用户（仅 Matrix：ban，禁止其再次加入） */
  app.post<{ Params: { id?: string }; Body: { userId?: string; reason?: string } }>(
    '/api/sessions/:id/ban',
    async (req, reply) => {
      const adapter = getChatAdapter();
      if (!adapter || typeof adapter.banFromSession !== 'function') {
        return reply.code(501).send({
          error: '当前后端不支持屏蔽用户',
          message: '请使用支持 banFromSession 的 CHAT_PROVIDER（如 matrix）',
        });
      }
      const sessionId = req.params?.id;
      if (!sessionId) return reply.code(400).send({ error: 'session id is required' });
      const body = (req.body as { userId?: string; reason?: string }) || {};
      const targetUserId = body.userId?.trim();
      if (!targetUserId) return reply.code(400).send({ error: 'userId is required' });
      const session = await getSessionFromCookie(req.headers.cookie);
      if (await requireMatrixToken(req, session, reply)) return;
      const targetMxid = targetUserId.includes(':') ? targetUserId : getMatrixUserId(targetUserId);
      try {
        await adapter.banFromSession({
          sessionId,
          backendSessionId: sessionId,
          targetUserId: targetMxid,
          matrixAccessToken: session!.matrixAccessToken,
          reason: body.reason,
        });
        return reply.send({ ok: true });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '屏蔽失败',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  app.patch<{ Params: { id?: string }; Body: { title?: string } }>(
    '/api/sessions/:id',
    async (req, reply) => {
      try {
        const adapter = getChatAdapter();
        if (!adapter || typeof adapter.renameSession !== 'function') {
          return reply.code(501).send({
            error: '当前后端不支持重命名会话',
            message: '请使用支持 renameSession 的 CHAT_PROVIDER（如 matrix、mock）',
          });
        }
        const sessionId = req.params?.id;
        if (!sessionId) {
          return reply.code(400).send({ error: 'session id is required' });
        }
        const body = (req.body as { title?: string }) || {};
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title) {
          return reply.code(400).send({ error: 'title is required and must be non-empty' });
        }
        const session = await getSessionFromCookie(req.headers.cookie);
        if (config.chat?.provider === 'matrix' && (await requireMatrixToken(req, session, reply))) return;
        if (config.chat?.provider === 'matrix' && !session?.matrixAccessToken?.trim()) {
          return reply.code(401).send({ error: '需要 Matrix 会话，请刷新后重试' });
        }

        const userId = await resolveUserId(req);
        await adapter.renameSession({
          sessionId,
          backendSessionId: sessionId,
          userId,
          title,
          matrixAccessToken: session?.matrixAccessToken,
        });
        return reply.send({ ok: true, title });
      } catch (e) {
        req.log.error(e);
        return reply.code(502).send({
          error: '重命名会话失败',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  app.delete<{ Params: { id?: string } }>('/api/sessions/:id', async (req, reply) => {
    try {
      const adapter = getChatAdapter();
      if (!adapter || typeof adapter.deleteSession !== 'function') {
        return reply.code(501).send({
          error: '当前后端不支持删除会话',
          message: '请使用支持 deleteSession 的 CHAT_PROVIDER（如 matrix、mock）',
        });
      }
      const sessionId = req.params?.id;
      if (!sessionId) {
        return reply.code(400).send({ error: 'session id is required' });
      }
      const session = await getSessionFromCookie(req.headers.cookie);
      if (config.chat?.provider === 'matrix' && (await requireMatrixToken(req, session, reply))) return;
      if (config.chat?.provider === 'matrix' && !session?.matrixAccessToken?.trim()) {
        return reply.code(401).send({ error: '需要 Matrix 会话，请刷新后重试' });
      }

      const userId = await resolveUserId(req);
      await adapter.deleteSession({
        sessionId,
        backendSessionId: sessionId,
        userId,
        matrixAccessToken: session?.matrixAccessToken,
      });
      return reply.send({ ok: true });
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: '删除会话失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post('/api/chat/export-markdown', async (req, reply) => {
    const body = (req.body as { messages?: Array<{ role: 'user' | 'assistant'; content?: string; thinking?: string }> }) || {};
    const messages = body.messages ?? [];
    const markdown = messagesToMarkdown(messages);
    return reply.send({ markdown });
  });
}
