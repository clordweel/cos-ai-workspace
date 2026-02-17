/**
 * 认证路由（阶段 1 最小集）：Logto 回调、GET /api/auth/me
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getSessionFromCookie, getStableUserId, getCookieName, deleteSession } from '../services/sessionStore.js';
import { getLogtoAuthUrl, handleLogtoCallback } from '../services/logto.js';
import { ensureMatrixUser } from '../services/matrixUserSync.js';
import { ensureMatrixTokenForSession } from '../services/matrixSessionToken.js';
import {
  getPreferencesFromCustomData,
  mergePreferencesIntoCustomData,
  getLogtoUserCustomDataViaAccountApi,
  patchLogtoUserCustomDataViaAccountApi,
  getLogtoUserCustomData,
  patchLogtoUserCustomData,
} from '../services/logtoPreferences.js';

const COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  maxAge: 3 * 24 * 60 * 60,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

function getRedirectUriBase(req: { headers: { [key: string]: string | string[] | undefined }; protocol: string; hostname: string; port?: string | number }): string {
  if (config.publicOrigin) return config.publicOrigin;
  const proto = req.headers['x-forwarded-proto'];
  const host = req.headers['x-forwarded-host'];
  const p = typeof proto === 'string' ? proto : undefined;
  const h = typeof host === 'string' ? host : undefined;
  const base = p && h ? `${p}://${h}` : `${req.protocol}://${req.hostname}${req.port && req.port !== 80 && req.port !== 443 ? `:${req.port}` : ''}`;
  return base;
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
  const fallback = config.frontendOrigin.replace(/\/$/, '');
  return `${fallback}${path.startsWith('/') ? path : '/' + path}`;
}

/** Logto 代理：转发到 Logto 并在响应中放宽 CSP、重写 Location，便于 iframe 嵌入 */
async function handleLogtoProxy(
  req: { method: string; url: string; headers: { [key: string]: string | string[] | undefined }; protocol: string; hostname: string; port?: string | number },
  reply: import('fastify').FastifyReply,
  body?: string | Buffer
): Promise<void> {
  const logtoOrigin = config.logto.endpoint.replace(/\/$/, '');
  if (!logtoOrigin) {
    return reply.code(503).send({ ok: false, error: '未配置 Logto' });
  }
  const pathAndQuery = req.url.replace(/^\/api\/logto-proxy\/?/, '/') || '/';
  const targetUrl = `${logtoOrigin}${pathAndQuery}`;
  const proxyBase = `${getRedirectUriBase(req)}/api/logto-proxy`;
  const frontOrigin = config.frontendOrigin.replace(/\/$/, '') || proxyBase.replace(/\/api\/logto-proxy$/, '');
  const relaxedCsp = `frame-ancestors 'self' ${frontOrigin} *`;

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v || k.toLowerCase() === 'host') continue;
    headers[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  headers.host = new URL(logtoOrigin).host;

  const fetchBody = req.method !== 'GET' && req.method !== 'HEAD' ? (body ?? undefined) : undefined;
  const res = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: fetchBody,
    redirect: 'manual',
  });

  for (const [k, v] of res.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'content-security-policy') continue;
    if (lower === 'location' && v && v.startsWith(logtoOrigin)) {
      reply.header('Location', v.replace(logtoOrigin, proxyBase));
      continue;
    }
    reply.header(k, v);
  }
  reply.header('Content-Security-Policy', relaxedCsp);
  reply.status(res.status).send(res.body);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const cookieName = getCookieName();

  /** Logto 反向代理：放宽 CSP、重写 Location，供 iframe 嵌入授权页 */
  app.all('/api/logto-proxy/*', async (req, reply) => {
    let body: string | Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
      if (typeof req.body === 'string') body = req.body;
      else if (Buffer.isBuffer(req.body)) body = req.body;
      else body = new URLSearchParams(req.body as Record<string, string>).toString();
    }
    await handleLogtoProxy(req, reply, body);
  });

  /** 供前端（apps/web 等）按 @cosai/logto-auth 构建授权 URL 的公开配置 */
  app.get('/api/auth/logto/config', async (_req, reply) => {
    const { endpoint, appId } = config.logto;
    if (!endpoint || !appId) {
      return reply.code(503).send({ ok: false, error: '未配置 Logto' });
    }
    const appOrigin = config.frontendOrigin.replace(/\/$/, '') || config.publicOrigin || '';
    /** iframe 嵌入时用此 base 构建授权 URL，请求经本服务代理并放宽 CSP */
    const logtoProxyBase = appOrigin ? `${appOrigin}/api/logto-proxy` : '';
    return reply.send({ ok: true, endpoint, appId, appOrigin, logtoProxyBase });
  });

  /** 阶段 2：前端 /logto 请求此 URL 后重定向到 Logto；redirect_uri 为前端 /logto-callback */
  app.get('/api/auth/logto/url', async (req, reply) => {
    const frontOrigin = config.frontendOrigin.replace(/\/$/, '');
    const redirectUri = `${frontOrigin}/logto-callback`;
    const prompt = (req.query as { prompt?: string }).prompt;
    const promptOpt = prompt === 'consent' || prompt === 'login' ? prompt : undefined;
    const result = getLogtoAuthUrl(redirectUri, promptOpt ? { prompt: promptOpt } : undefined);
    if (!result.ok) {
      return reply.code(503).send({ ok: false, error: result.error });
    }
    return reply.send({ ok: true, url: result.url });
  });

  app.get('/api/auth/logto/callback', async (req, reply) => {
    const query = req.query as { code?: string; redirect_uri?: string };
    const code = query.code;
    const base = getRedirectUriBase(req);
    const redirectUri =
      typeof query.redirect_uri === 'string' && query.redirect_uri.trim()
        ? query.redirect_uri.trim()
        : `${base}/api/auth/logto/callback`;
    if (!code) {
      return reply.redirect(redirectToFront(query.redirect_uri, '/#/space?auth_error=missing_code'), 302);
    }
    const result = await handleLogtoCallback(code, redirectUri);
    if (!result.ok) {
      return reply.redirect(redirectToFront(query.redirect_uri, `/#/space?auth_error=${encodeURIComponent(result.error)}`), 302);
    }
    const frontOrigin =
      frontOriginFromRedirectUri(query.redirect_uri) ?? config.frontendOrigin.replace(/\/$/, '');
    /** 前端为 HashRouter 时需带 hash，以便路由匹配且 auth=ok 可被读取 */
    return reply
      .setCookie(cookieName, result.sessionId, { ...COOKIE_OPTS, domain: undefined })
      .redirect(`${frontOrigin}/#/space?auth=ok`, 302);
  });

  /** 注销：删除服务端会话并清除 Cookie */
  app.post('/api/auth/logout', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (session) {
      deleteSession(session.sessionId);
    }
    return reply
      .clearCookie(cookieName, { path: '/', domain: undefined })
      .send({ ok: true });
  });

  app.get('/api/auth/me', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({ ok: false, error: '未登录' });
    }
    const user = session.userProfile ?? { name: session.user };
    const userId = getStableUserId(session);
    const payload: {
      ok: true;
      user: unknown;
      userId: string;
      type: string;
      preferences: Record<string, unknown>;
      matrixSyncToken?: string;
      matrix_base_url?: string;
      matrix_user_id?: string;
      matrix_device_id?: string;
    } = {
      ok: true,
      user,
      userId,
      type: session.type,
      preferences: {},
    };
    if (session.logtoSub) {
      let customData: Record<string, unknown> | null = null;
      const token = session.logtoAccessToken;
      if (token) {
        const prefRes = await getLogtoUserCustomDataViaAccountApi(token);
        if (prefRes.ok) customData = prefRes.customData;
      }
      if (customData === null) {
        const m2mRes = await getLogtoUserCustomData(session.logtoSub);
        if (m2mRes.ok) customData = m2mRes.customData;
      }
      if (customData !== null) {
        payload.preferences = getPreferencesFromCustomData(customData);
      }
    }
    if (config.chat.provider === 'matrix' && config.matrix.baseUrl) {
      payload.matrix_base_url = config.matrix.baseUrl;
      if (session.logtoSub) {
        const ensureOut = await ensureMatrixUser(
          session.logtoSub,
          session.userProfile?.name ?? session.user,
          session.userProfile?.email,
          session.userProfile?.phone,
          session.userProfile?.username
        );
        if (ensureOut.ok && ensureOut.matrixUserId) {
          if (session.matrixUserId !== ensureOut.matrixUserId) {
            const { updateSession } = await import('../services/sessionStore.js');
            await updateSession(session.sessionId, { matrixUserId: ensureOut.matrixUserId });
            session.matrixUserId = ensureOut.matrixUserId;
          }
        }
        const tokenResult = await ensureMatrixTokenForSession(session);
        if (tokenResult && 'access_token' in tokenResult) {
          session.matrixAccessToken = tokenResult.access_token;
          session.matrixUserId = tokenResult.matrix_user_id ?? session.matrixUserId;
          session.matrixDeviceId = tokenResult.device_id;
          payload.matrixSyncToken = tokenResult.access_token;
          payload.matrix_user_id = session.matrixUserId;
          payload.matrix_device_id = tokenResult.device_id ?? session.matrixDeviceId;
        } else if (session.matrixAccessToken) {
          payload.matrixSyncToken = session.matrixAccessToken;
          if (session.matrixUserId) payload.matrix_user_id = session.matrixUserId;
          if (session.matrixDeviceId) payload.matrix_device_id = session.matrixDeviceId;
        }
      } else if (session.matrixAccessToken) {
        payload.matrixSyncToken = session.matrixAccessToken;
        if (session.matrixUserId) payload.matrix_user_id = session.matrixUserId;
        if (session.matrixDeviceId) payload.matrix_device_id = session.matrixDeviceId;
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
      return reply.code(400).send({ ok: false, error: '请提供要更新的偏好字段（theme、uiFontSizeStep、notificationsEnabled）' });
    }
    const token = session.logtoAccessToken;
    let result: { ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number };
    if (token) {
      const current = await getLogtoUserCustomDataViaAccountApi(token);
      const toWrite = current.ok ? mergePreferencesIntoCustomData(current.customData, patch) : { preferences: patch };
      result = await patchLogtoUserCustomDataViaAccountApi(token, toWrite);
      const needM2mFallback =
        !result.ok &&
        (result.statusCode === 401 ||
          result.statusCode === 403 ||
          /token.*not active|token.*invalid|token.*expired|account.*center/i.test(result.error ?? ''));
      if (needM2mFallback) {
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
      return reply
        .code(result.statusCode && result.statusCode >= 400 ? result.statusCode : 503)
        .send({ ok: false, error: result.error });
    }
    return reply.send({ ok: true, preferences: getPreferencesFromCustomData(result.customData) });
  });
}
