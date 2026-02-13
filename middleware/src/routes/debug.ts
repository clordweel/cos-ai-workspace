/**
 * 调试接口：供 curl 验证 Matrix token、session 状态，排查 token 与用户不匹配等问题
 * 使用方式见 docs/DEBUG_MATRIX_TOKEN.md
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getSessionFromCookie, updateSession } from '../services/auth.js';
import { getMatrixUserIdForSession } from '../services/matrixUserSync.js';
import {
  getMatrixUserIdFromToken,
  getMatrixAdminUserId,
  verifyMatrixTokenUserId,
} from '../adapters/matrixClient.js';
import { ensureMatrixTokenForSession } from '../services/matrixSessionToken.js';
import {
  getMasUserByUsername,
  createMasUser,
  createPersonalSession,
} from '../services/masAdminApi.js';
import { ensureMatrixUser } from '../services/matrixUserSync.js';

export async function debugRoutes(app: FastifyInstance): Promise<void> {
  /** 无需 Cookie：返回 MATRIX_ACCESS_TOKEN 对应的 admin user_id，用于核对配置 */
  app.get('/api/debug/matrix-admin', async (_req, reply) => {
    if (config.chat?.provider !== 'matrix') {
      return reply.send({
        configured: false,
        message: 'CHAT_PROVIDER 不是 matrix',
      });
    }
    const adminUserId = await getMatrixAdminUserId();
    return reply.send({
      configured: true,
      adminUserId: adminUserId ?? null,
      hasAccessToken: Boolean(config.matrix?.accessToken),
      hasUserId: Boolean(config.matrix?.userId?.trim()),
    });
  });

  /**
   * 需 Cookie：返回当前 session 的 Matrix 状态
   * curl -v -b "auth_session=YOUR_SESSION_ID" http://127.0.0.1:3000/api/debug/matrix-session
   */
  app.get('/api/debug/matrix-session', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({
        error: '未登录',
        hint: '请先登录，或传入 Cookie: auth_session=<session_id>',
      });
    }

    const expectedMxid = session.logtoSub
      ? getMatrixUserIdForSession(
          session.logtoSub,
          session.userProfile?.username,
          session.matrixUserId
        )
      : null;
    const adminUserId = await getMatrixAdminUserId();
    let tokenUserId: string | null = null;
    let tokenValid = false;
    let isAdminToken = false;

    if (session.matrixAccessToken) {
      tokenUserId = await getMatrixUserIdFromToken(session.matrixAccessToken);
      tokenValid =
        !!expectedMxid && !!tokenUserId
          ? await verifyMatrixTokenUserId(session.matrixAccessToken, expectedMxid)
          : false;
      isAdminToken =
        !!adminUserId && !!tokenUserId && tokenUserId === adminUserId;
    }

    return reply.send({
      sessionId: session.sessionId?.slice(0, 20) + '...',
      logtoSub: session.logtoSub ?? null,
      username: session.userProfile?.username ?? null,
      expectedMxid,
      sessionMatrixUserId: session.matrixUserId ?? null,
      hasToken: Boolean(session.matrixAccessToken),
      tokenUserId,
      adminUserId,
      tokenValid,
      isAdminToken,
      diagnosis:
        !session.matrixAccessToken
          ? '无 token，需调用 ensureMatrixTokenForSession'
          : isAdminToken && expectedMxid !== adminUserId
            ? 'token 为 admin，但当前用户非 admin，需清除并重新获取'
            : !tokenValid && tokenUserId && tokenUserId !== adminUserId
              ? 'token 属于其他用户（如 MAS 签发 MXID 不同），可采纳并更新 session.matrixUserId'
              : tokenValid
                ? 'token 正常'
                : 'token 无效或未知',
    });
  });

  /**
   * 需 Cookie：强制清除 session 的 matrixAccessToken 并重新获取
   * 用于测试 ensureMatrixTokenForSession 能否正确签发用户 token
   * curl -X POST -v -b "auth_session=YOUR_SESSION_ID" http://127.0.0.1:3000/api/debug/matrix-force-refresh
   */
  app.post('/api/debug/matrix-force-refresh', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({
        error: '未登录或无 logtoSub',
      });
    }

    await updateSession(session.sessionId, {
      matrixAccessToken: undefined,
      matrixTokenExpiresAt: undefined,
    });
    session.matrixAccessToken = undefined;
    session.matrixTokenExpiresAt = undefined;

    const result = await ensureMatrixTokenForSession(session);
    const fresh = await getSessionFromCookie(req.headers.cookie);

    const tokenUserId = fresh?.matrixAccessToken
      ? await getMatrixUserIdFromToken(fresh.matrixAccessToken)
      : null;
    const adminUserId = await getMatrixAdminUserId();
    const isAdminToken =
      !!adminUserId && !!tokenUserId && tokenUserId === adminUserId;

    return reply.send({
      ensured: result && 'access_token' in result ? 'ok' : 'failed',
      error: result && 'error' in result ? (result as { error: string }).error : null,
      errorMessage: result && 'message' in result ? (result as { message?: string }).message : null,
      hasTokenAfterRefresh: Boolean(fresh?.matrixAccessToken),
      tokenUserId,
      adminUserId,
      isAdminToken,
      hint: isAdminToken
        ? '刷新后仍为 admin token，请检查 MAS/Synapse 配置或用户是否即 admin'
        : tokenUserId
          ? '刷新成功，建议重试 POST /api/sessions'
          : '刷新失败，请查看 error 字段',
    });
  });

  /**
   * 需 Cookie：逐步跟踪 MAS/Admin 路径，定位 token 获取失败环节
   * 可选 MAS：login 转发到 MAS 时用户须先存在
   */
  app.get('/api/debug/matrix-trace', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ error: '未登录或无 logtoSub' });
    }

    const localpart =
      session.userProfile?.username ||
      (session.logtoSub?.replace(/[^a-zA-Z0-9._=-]/g, '_').slice(0, 255) || 'user');
    const matrixUserId = getMatrixUserIdForSession(
      session.logtoSub,
      session.userProfile?.username,
      session.matrixUserId
    );
    const trace: Array<{ step: string; ok: boolean; detail?: unknown }> = [];

    const step1 = await getMasUserByUsername(localpart);
    trace.push({
      step: '1.getMasUserByUsername',
      ok: step1 !== null,
      detail:
        step1 === null
          ? 'MAS 无此用户'
          : typeof step1 === 'string'
            ? { ulid: step1 }
            : { deactivated: true, ulid: step1.ulid },
    });

    if (step1 === null) {
      const ensureOut = await ensureMatrixUser(
        session.logtoSub!,
        session.userProfile?.name ?? session.user,
        session.userProfile?.email,
        session.userProfile?.phone,
        session.userProfile?.username
      );
      trace.push({
        step: '2.ensureMatrixUser',
        ok: ensureOut.ok,
        detail: ensureOut.ok ? { matrixUserId: ensureOut.matrixUserId } : { error: (ensureOut as { error?: string }).error },
      });

      await new Promise((r) => setTimeout(r, 800));
      const step3 = await getMasUserByUsername(localpart);
      trace.push({
        step: '3.getMasUserByUsername_retry',
        ok: step3 !== null,
        detail:
          step3 === null
            ? 'MAS 仍无此用户（ensure 可能未补建或 MAS provision 延迟）'
            : typeof step3 === 'string'
              ? { ulid: step3 }
              : { deactivated: true },
      });

      if (step3 === null) {
        const created = await createMasUser(localpart);
        trace.push({
          step: '4.createMasUser_fallback',
          ok: Boolean(created),
          detail: created ? { ulid: created } : '创建失败',
        });
      }
    }

    const masUserNow = await getMasUserByUsername(localpart);
    if (masUserNow && typeof masUserNow === 'string') {
      const psResult = await createPersonalSession(
        masUserNow,
        `workspace-${session.userProfile?.name || localpart}`
      );
      const psOk = Boolean(psResult?.access_token);
      let tokenUserId: string | null = null;
      let isAdminToken = false;
      let needsFallback = false;
      if (psResult?.access_token) {
        tokenUserId = await getMatrixUserIdFromToken(psResult.access_token);
        const adminId = await getMatrixAdminUserId();
        isAdminToken = !!adminId && !!tokenUserId && tokenUserId === adminId;
        needsFallback = isAdminToken && matrixUserId !== adminId;
      }
      trace.push({
        step: '5.createPersonalSession',
        ok: psOk,
        detail: psOk
          ? { tokenUserId, isAdminToken, needsFallback }
          : 'createPersonalSession 返回 null 或无 access_token',
      });
    } else {
      trace.push({
        step: '5.createPersonalSession',
        ok: false,
        detail: masUserNow === null ? '无 MAS 用户，跳过' : '用户已停用',
      });
    }

    const step5 = trace.find((t) => t.step === '5.createPersonalSession');
    const step5Detail = step5?.detail as { needsFallback?: boolean } | undefined;
    const needsFallback = step5Detail?.needsFallback === true;
    const suggestion =
      trace.some((t) => t.step === '3.getMasUserByUsername_retry' && !t.ok) &&
      trace.some((t) => t.step === '4.createMasUser_fallback' && !t.ok)
        ? 'MAS 用户创建失败，检查 MAS Admin API 可达性及 admin_clients 配置'
        : trace.some((t) => t.step === '5.createPersonalSession' && !t.ok)
          ? 'Personal Session 失败，检查 MAS personal-sessions 权限'
          : needsFallback
            ? 'createPersonalSession 返回 admin token，将回退到设密+login，可调用 POST /api/debug/matrix-force-refresh 测试'
            : '按 trace 逐步排查';

    return reply.send({
      localpart,
      matrixUserId,
      trace,
      suggestion,
    });
  });
}
