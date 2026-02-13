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
  updateSession,
  getLogtoAuthUrl,
  handleLogtoCallback,
  createSessionFromLogtoAccessToken,
  getLogtoAccessTokenForSession,
  fetchUserProfileFromLogto,
} from '../services/auth.js';
import { loginAsUser } from '../adapters/matrixClient.js';
import { matrixLoginWithIdentifier, matrixChangePassword } from '../services/matrixAuth.js';
import {
  getMatrixUserIdForSession,
  setMatrixPasswordByAdmin,
  ensureMatrixUser,
  deactivateMatrixUser,
} from '../services/matrixUserSync.js';
import {
  setStoredMatrixPassword,
  deleteStoredMatrixPassword,
} from '../services/matrixPasswordStore.js';
import { ensureMatrixTokenForSession } from '../services/matrixSessionToken.js';
import {
  logtoUpdateUserPassword,
  logtoUpdateUserProfile,
  getLogtoUserCustomDataViaAccountApi,
  patchLogtoUserCustomDataViaAccountApi,
  getLogtoUserCustomData,
  patchLogtoUserCustomData,
  getPreferencesFromCustomData,
  mergePreferencesIntoCustomData,
} from '../services/logtoManagement.js';
import {
  formatPhoneForDisplay,
  toLogtoPrimaryPhone,
} from '../utils/phoneFormat.js';

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

  /** 遗留：Frappe 用户名密码登录，前端已不调用，认证入口为 Logto */
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

  /** 遗留：Frappe Token 登录，前端已不调用 */
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
    const payload: {
      ok: true;
      user: unknown;
      userId: string;
      type: string;
      preferences?: Record<string, unknown>;
      matrixSyncToken?: string;
      matrix_base_url?: string;
      matrix_user_id?: string;
    } = {
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
    if (config.chat?.provider === 'matrix' && session.logtoSub) {
      // 每次 /me 时从 Logto 拉取最新资料并同步到 Matrix，解决重新授权后手机号等未更新的问题
      const logtoToken = await getLogtoAccessTokenForSession(session);
      const freshProfile =
        logtoToken ? await fetchUserProfileFromLogto(logtoToken) : null;
      const displayName =
        freshProfile?.displayName ?? session.userProfile?.name ?? session.user;
      const email = freshProfile?.email ?? session.userProfile?.email;
      const phone = freshProfile?.phone ?? session.userProfile?.phone;
      const username = freshProfile?.username ?? session.userProfile?.username;
      if (freshProfile) {
        const nextUserProfile = {
          name: displayName,
          ...(username && { username }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(freshProfile.avatar && { avatar: freshProfile.avatar }),
        };
        const changed =
          session.userProfile?.phone !== phone ||
          session.userProfile?.email !== email ||
          session.userProfile?.name !== displayName;
        if (changed) {
          await updateSession(session.sessionId, {
            user: displayName,
            userProfile: { ...session.userProfile, ...nextUserProfile },
          });
          Object.assign(payload, { user: nextUserProfile });
        }
      }
      const ensured = await ensureMatrixUser(
        session.logtoSub,
        displayName,
        email,
        phone,
        username
      ).catch((e) => {
        req.log.warn(e, 'ensureMatrixUser 重试失败');
        return null;
      });
      let resolvedMatrixUserId = session.matrixUserId;
      if (ensured?.ok && ensured.matrixUserId) {
        resolvedMatrixUserId = ensured.matrixUserId;
        if (resolvedMatrixUserId !== session.matrixUserId) {
          await updateSession(session.sessionId, { matrixUserId: resolvedMatrixUserId });
        }
      }

      let token = session.matrixAccessToken;
      if (!token) {
        const tokenResult = await ensureMatrixTokenForSession(session);
        if (tokenResult && 'access_token' in tokenResult) token = tokenResult.access_token;
      }
      if (token) {
        payload.matrixSyncToken = token;
        payload.matrix_base_url = config.matrix.baseUrl;
        payload.matrix_user_id = getMatrixUserIdForSession(
          session.logtoSub,
          username ?? session.userProfile?.username,
          resolvedMatrixUserId
        );
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
      // Token 失效（401）或 Account center 未启用（403）时回退到 M2M
      if (
        !result.ok &&
        (result.statusCode === 401 ||
          result.statusCode === 403 ||
          result.error?.includes(ACCOUNT_CENTER_DISABLED) ||
          /token.*not active|token.*invalid|token.*expired/i.test(result.error ?? ''))
      ) {
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

  /** 更新用户资料（邮箱、手机号），需 Logto 登录且配置 M2M */
  app.patch('/api/auth/me/profile', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const body = (req.body as { email?: string; phone?: string }) || {};
    const patch: { primaryEmail?: string | null; primaryPhone?: string | null } = {};
    if (body.email !== undefined) {
      const v = body.email?.trim();
      patch.primaryEmail = v && /^\S+@\S+\.\S+$/.test(v) ? v : (v === '' ? null : undefined);
      if (v && !patch.primaryEmail) {
        return reply.code(400).send({ ok: false, error: '邮箱格式不正确' });
      }
    }
    if (body.phone !== undefined) {
      const raw = body.phone?.trim();
      patch.primaryPhone = raw ? toLogtoPrimaryPhone(raw) : null;
    }
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ ok: false, error: '请提供要更新的字段（email 或 phone）' });
    }
    const result = await logtoUpdateUserProfile(session.logtoSub, patch);
    if (!result.ok) {
      return reply
        .code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 503)
        .send({ ok: false, error: result.error });
    }
    const nextProfile = { ...session.userProfile, name: session.userProfile?.name ?? session.user };
    if (patch.primaryEmail !== undefined) nextProfile.email = patch.primaryEmail ?? undefined;
    if (patch.primaryPhone !== undefined) {
      const formatted = patch.primaryPhone ? formatPhoneForDisplay(patch.primaryPhone) : '';
      nextProfile.phone = formatted || undefined;
    }
    await updateSession(session.sessionId, { userProfile: nextProfile });
    if (config.chat?.provider === 'matrix' && (patch.primaryEmail !== undefined || patch.primaryPhone !== undefined)) {
      ensureMatrixUser(
        session.logtoSub,
        nextProfile.name,
        nextProfile.email,
        nextProfile.phone,
        nextProfile.username
      ).catch((e) => req.log.warn(e, '更新 profile 后 Matrix 同步失败'));
    }
    return reply.send({ ok: true });
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
    const matrixUserId = getMatrixUserIdForSession(
      session.logtoSub,
      session.userProfile?.username,
      session.matrixUserId
    );
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
    // 先 ensure 以解析 409 场景下的正确 MXID，再设密
    const ensured = await ensureMatrixUser(
      session.logtoSub,
      session.userProfile?.name ?? session.user,
      session.userProfile?.email,
      session.userProfile?.phone,
      session.userProfile?.username
    );
    const matrixUserId =
      ensured.ok ? ensured.matrixUserId : getMatrixUserIdForSession(
        session.logtoSub,
        session.userProfile?.username,
        session.matrixUserId
      );
    if (ensured.ok && ensured.matrixUserId && ensured.matrixUserId !== session.matrixUserId) {
      await updateSession(session.sessionId, { matrixUserId: ensured.matrixUserId });
    }
    const result = await setMatrixPasswordByAdmin(matrixUserId, newPassword);
    if (!result.ok) {
      req.log.warn(
        { matrixUserId, statusCode: result.statusCode, error: result.error },
        'setMatrixPasswordByAdmin 失败（403 多为 token 缺 admin 权限或过期，请重签 MATRIX_ACCESS_TOKEN）'
      );
      return reply.code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 400).send({
        ok: false,
        error: result.error,
      });
    }
    try {
      const loginResult = await loginAsUser(matrixUserId, newPassword);
      const expiresInMs = loginResult.expires_in_ms ?? 24 * 60 * 60 * 1000;
      await updateSession(session.sessionId, {
        matrixAccessToken: loginResult.access_token,
        matrixTokenExpiresAt: Date.now() + expiresInMs,
      });
      await setStoredMatrixPassword(session.logtoSub, newPassword);
    } catch (e) {
      req.log.warn(e, 'Matrix 用户登录（存 token）失败，密码已设置');
    }
    return reply.send({ ok: true });
  });

  /** 彻底删除（注销）Matrix 账号：Synapse deactivate + erase，清除会话中的 token 与密码缓存 */
  app.post('/api/auth/matrix/deactivate', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const matrixUserId = getMatrixUserIdForSession(
      session.logtoSub,
      session.userProfile?.username,
      session.matrixUserId
    );
    // 禁止注销配置中的 Matrix 管理员账号，避免误操作导致 Synapse Admin 无法登录
    const adminUserId = config.matrix?.userId?.trim();
    if (adminUserId && matrixUserId === adminUserId) {
      return reply.code(403).send({
        ok: false,
        error: '无法注销：当前账号为 Matrix 管理员，注销将导致 Synapse Admin 无法登录。若确需操作，请先在 .env 中更换 MATRIX_USER_ID。',
      });
    }
    const result = await deactivateMatrixUser(matrixUserId);
    if (!result.ok) {
      const code = result.statusCode && result.statusCode >= 400 ? result.statusCode : 400;
      return reply.code(code).send({ ok: false, error: result.error });
    }
    await deleteStoredMatrixPassword(session.logtoSub);
    await updateSession(session.sessionId, {
      matrixAccessToken: undefined,
      matrixTokenExpiresAt: undefined,
      matrixUserId: undefined,
    });
    return reply.send({ ok: true });
  });

  /** Matrix 登录（已有密码、当前会话无 token 时）：body { password }，成功则写入 session.matrixAccessToken */
  app.post('/api/auth/matrix/session-login', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session?.logtoSub) {
      return reply.code(401).send({ ok: false, error: '请先使用 Logto 登录' });
    }
    const body = (req.body as { password?: string }) || {};
    const password = body.password;
    if (!password) {
      return reply.code(400).send({ ok: false, error: '请填写 Matrix 密码' });
    }
    const matrixUserId = getMatrixUserIdForSession(
      session.logtoSub,
      session.userProfile?.username,
      session.matrixUserId
    );
    try {
      const loginResult = await loginAsUser(matrixUserId, password);
      const expiresInMs = loginResult.expires_in_ms ?? 24 * 60 * 60 * 1000;
      await updateSession(session.sessionId, {
        matrixAccessToken: loginResult.access_token,
        matrixTokenExpiresAt: Date.now() + expiresInMs,
      });
      return reply.send({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { statusCode?: number }).statusCode;
      return reply
        .code(code && code >= 400 ? code : 401)
        .send({ ok: false, error: msg || 'Matrix 登录失败' });
    }
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
