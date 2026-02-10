/**
 * 认证路由：登录（用户名密码 / Token）、Logto SSO、当前用户、登出；Cookie 保持会话
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  loginWithPassword,
  loginWithToken,
  getSessionFromCookie,
  getStableUserId,
  logoutSession,
  getCookieName,
  getLogtoAuthUrl,
  handleLogtoCallback,
  createSessionFromLogtoAccessToken,
  getLogtoAccessTokenForSession,
} from '../services/auth.js';
import { matrixLoginWithIdentifier, matrixChangePassword } from '../services/matrixAuth.js';
import { getMatrixUserIdForLogtoSub, setMatrixPasswordByAdmin } from '../services/matrixUserSync.js';
import {
  logtoUpdateUserPassword,
  getLogtoUserCustomDataViaAccountApi,
  patchLogtoUserCustomDataViaAccountApi,
  getLogtoUserCustomData,
  patchLogtoUserCustomData,
  getPreferencesFromCustomData,
  mergePreferencesIntoCustomData,
} from '../services/logtoManagement.js';

const ACCOUNT_CENTER_DISABLED = 'Account center is not enabled';

function getRedirectUriBase(req: { headers: Record<string, string | undefined>; protocol: string; hostname: string; port?: string | number }): string {
  if (config.middlewarePublicOrigin) {
    return config.middlewarePublicOrigin;
  }
  const base =
    req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : `${req.protocol}://${req.hostname}${req.port && req.port !== 80 && req.port !== 443 ? `:${req.port}` : ''}`;
  return base;
}

const COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  maxAge: 3 * 24 * 60 * 60, // 3 天（秒）
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const cookieName = getCookieName();

  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body as { usr?: string; pwd?: string }) || {};
    const usr = body.usr?.trim();
    const pwd = body.pwd;
    if (!usr || !pwd) {
      return reply.code(400).send({ ok: false, error: '请填写用户名和密码' });
    }
    const result = await loginWithPassword(usr, pwd);
    if (!result.ok) {
      return reply.code(401).send({ ok: false, error: result.error });
    }
    reply
      .setCookie(cookieName, result.sessionId, COOKIE_OPTS)
      .send({ ok: true, user: result.user });
  });

  app.post('/api/auth/token', async (req, reply) => {
    const body = (req.body as { token?: string }) || {};
    const token = body.token?.trim();
    if (!token) {
      return reply.code(400).send({ ok: false, error: '请填写 Token' });
    }
    const result = await loginWithToken(token);
    if (!result.ok) {
      return reply.code(401).send({ ok: false, error: result.error });
    }
    reply
      .setCookie(cookieName, result.sessionId, COOKIE_OPTS)
      .send({ ok: true, user: result.user });
  });

  app.get('/api/auth/me', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({ ok: false, error: '未登录' });
    }
    const user = session.userProfile ?? session.user;
    const userId = getStableUserId(session);
    const payload: { ok: true; user: unknown; userId: string; type: string; preferences?: Record<string, unknown> } = {
      ok: true,
      user,
      userId,
      type: session.type,
    };
    if (session.logtoSub) {
      let customData: Record<string, unknown> | null = null;
      const token = await getLogtoAccessTokenForSession(session);
      if (token) {
        const prefRes = await getLogtoUserCustomDataViaAccountApi(token);
        if (prefRes.ok) {
          customData = prefRes.customData;
        }
        if (customData === null) {
          const m2mRes = await getLogtoUserCustomData(session.logtoSub);
          if (m2mRes.ok) customData = m2mRes.customData;
        }
      } else {
        const m2mRes = await getLogtoUserCustomData(session.logtoSub);
        if (m2mRes.ok) customData = m2mRes.customData;
      }
      if (customData !== null) {
        payload.preferences = getPreferencesFromCustomData(customData);
      }
    }
    return reply.send(payload);
  });

  app.patch('/api/auth/me/preferences', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const body = (req.body as Record<string, unknown>) || {};
    const patch: Record<string, unknown> = {};
    if (body.theme !== undefined) patch.theme = body.theme;
    if (body.uiFontSizeStep !== undefined) patch.uiFontSizeStep = Number(body.uiFontSizeStep);
    if (body.notificationsEnabled !== undefined) patch.notificationsEnabled = Boolean(body.notificationsEnabled);
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ ok: false, error: '请提供要更新的偏好字段' });
    }
    const token = await getLogtoAccessTokenForSession(session);
    let result: { ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number };
    if (token) {
      const current = await getLogtoUserCustomDataViaAccountApi(token);
      const toWrite = current.ok ? mergePreferencesIntoCustomData(current.customData, patch) : { preferences: patch };
      result = await patchLogtoUserCustomDataViaAccountApi(token, toWrite);
      if (!result.ok && (result.error?.includes(ACCOUNT_CENTER_DISABLED) || result.statusCode === 403)) {
        const m2mCurrent = await getLogtoUserCustomData(session.logtoSub);
        const toWriteM2m = m2mCurrent.ok ? mergePreferencesIntoCustomData(m2mCurrent.customData, patch) : { preferences: patch };
        result = await patchLogtoUserCustomData(session.logtoSub, toWriteM2m);
      }
    } else {
      const m2mCurrent = await getLogtoUserCustomData(session.logtoSub);
      const toWriteM2m = m2mCurrent.ok ? mergePreferencesIntoCustomData(m2mCurrent.customData, patch) : { preferences: patch };
      result = await patchLogtoUserCustomData(session.logtoSub, toWriteM2m);
    }
    if (!result.ok) {
      console.warn('[auth] PATCH preferences 写回 Logto 失败:', result.statusCode, result.error, 'userId:', session.logtoSub);
      return reply.code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 503).send({
        ok: false,
        error: result.error,
      });
    }
    return reply.send({ ok: true, preferences: getPreferencesFromCustomData(result.customData) });
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (session) await logoutSession(session.sessionId);
    reply.clearCookie(cookieName, { path: '/' }).send({ ok: true });
  });

  app.post('/api/auth/matrix/login', async (req, reply) => {
    const body = (req.body as { identifier?: string; user_id?: string; password?: string; country?: string }) || {};
    const identifier = body.identifier?.trim() || body.user_id?.trim();
    const password = body.password;
    const country = body.country?.trim();
    if (!identifier || !password) {
      return reply.code(400).send({ ok: false, error: '请填写用户名/邮箱/手机号和密码' });
    }
    const result = await matrixLoginWithIdentifier(identifier, password, country || undefined);
    if (!result.ok) {
      return reply.code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 401).send({
        ok: false,
        error: result.error,
      });
    }
    return reply.send({
      ok: true,
      access_token: result.access_token,
      user_id: result.user_id,
      device_id: result.device_id,
      base_url: result.base_url,
    });
  });

  app.post('/api/auth/matrix/change-password', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const body = (req.body as { current_password?: string; new_password?: string }) || {};
    const currentPassword = body.current_password;
    const newPassword = body.new_password;
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ ok: false, error: '请填写当前密码和新密码' });
    }
    const matrixUserId = getMatrixUserIdForLogtoSub(session.logtoSub);
    const result = await matrixChangePassword(matrixUserId, currentPassword, newPassword);
    if (!result.ok) {
      return reply.code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 400).send({
        ok: false,
        error: result.error,
      });
    }
    return reply.send({ ok: true });
  });

  /** 设置 Matrix 密码（仅 Logto 已登录）：Admin API 直接设置，用户无需知晓之前的随机初始密码 */
  app.post('/api/auth/matrix/set-password', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const body = (req.body as { new_password?: string }) || {};
    const newPassword = body.new_password;
    if (!newPassword) {
      return reply.code(400).send({ ok: false, error: '请填写新密码' });
    }
    const matrixUserId = getMatrixUserIdForLogtoSub(session.logtoSub);
    const result = await setMatrixPasswordByAdmin(matrixUserId, newPassword);
    if (!result.ok) {
      return reply.code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 400).send({
        ok: false,
        error: result.error,
      });
    }
    return reply.send({ ok: true });
  });

  /** 修改 Logto 密码（需 Logto 已登录，无需当前密码；使用 Management API） */
  app.post('/api/auth/logto/change-password', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const body = (req.body as { new_password?: string }) || {};
    const newPassword = body.new_password;
    if (!newPassword) {
      return reply.code(400).send({ ok: false, error: '请填写新密码' });
    }
    const result = await logtoUpdateUserPassword(session.logtoSub, newPassword);
    if (!result.ok) {
      return reply.code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 400).send({
        ok: false,
        error: result.error,
      });
    }
    return reply.send({ ok: true });
  });

  /** 使用 @logto/nuxt 回调后的 access token 同步中间层 session（设 Cookie） */
  app.post('/api/auth/logto/sync-session', async (req, reply) => {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) {
      return reply.code(401).send({ ok: false, error: '缺少 Authorization: Bearer <token>' });
    }
    const result = await createSessionFromLogtoAccessToken(token);
    if (!result.ok) {
      return reply.code(401).send({ ok: false, error: result.error });
    }
    reply.setCookie(cookieName, result.sessionId, COOKIE_OPTS).send({ ok: true });
  });

  app.get('/api/auth/logto', async (req, reply) => {
    const base = getRedirectUriBase(req);
    const redirectUri = `${base}/api/auth/logto/callback`;
    const prompt = (req.query as { prompt?: string }).prompt;
    const promptOpt = prompt === 'consent' || prompt === 'login' ? prompt : undefined;
    const result = getLogtoAuthUrl(redirectUri, undefined, promptOpt ? { prompt: promptOpt } : undefined);
    if (!result.ok) {
      return reply.code(503).send({ ok: false, error: result.error });
    }
    return reply.redirect(result.url, 302);
  });

  app.get('/api/auth/logto/callback', async (req, reply) => {
    const query = req.query as { code?: string; redirect_uri?: string };
    const code = query.code;
    // 支持由 Nuxt 承载回调：前端 redirect_uri 为 /logto-callback，换 token 时必须与 Logto 授权时一致
    const base = getRedirectUriBase(req);
    const redirectUri =
      typeof query.redirect_uri === 'string' && query.redirect_uri.trim()
        ? query.redirect_uri.trim()
        : `${base}/api/auth/logto/callback`;
    if (!code) {
      return reply.redirect(redirectToFront(query.redirect_uri, '/space?auth_error=missing_code'));
    }
    const result = await handleLogtoCallback(code, redirectUri);
    if (!result.ok) {
      return reply.redirect(redirectToFront(query.redirect_uri, `/space?auth_error=${encodeURIComponent(result.error)}`));
    }
    const frontOrigin =
      frontOriginFromRedirectUri(query.redirect_uri) ??
      process.env.FRONTEND_ORIGIN ??
      (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
        ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
        : 'http://localhost:3001');
    reply
      .setCookie(cookieName, result.sessionId, { ...COOKIE_OPTS, domain: undefined })
      .redirect(`${frontOrigin}/space?auth=ok`, 302);
  });
}

function frontOriginFromRedirectUri(redirectUri: string | undefined): string | null {
  if (typeof redirectUri !== 'string' || !redirectUri.trim()) return null;
  try {
    const u = new URL(redirectUri);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function redirectToFront(redirectUri: string | undefined, path: string): string {
  const origin = frontOriginFromRedirectUri(redirectUri);
  if (origin) return `${origin}${path.startsWith('/') ? path : '/' + path}`;
  const fallback =
    process.env.FRONTEND_ORIGIN ||
    (process.env.MIDDLEWARE_PUBLIC_ORIGIN && process.env.MIDDLEWARE_PUBLIC_ORIGIN.replace(/\/$/, '')) ||
    'http://localhost:3001';
  return `${fallback}${path.startsWith('/') ? path : '/' + path}`;
}
