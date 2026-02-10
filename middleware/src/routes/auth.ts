/**
 * 认证路由：登录（用户名密码 / Token）、Logto SSO、当前用户、登出；Cookie 保持会话
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  loginWithPassword,
  loginWithToken,
  getSessionFromCookie,
  logoutSession,
  getCookieName,
  getLogtoAuthUrl,
  handleLogtoCallback,
} from '../services/auth.js';

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
    const session = getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({ ok: false, error: '未登录' });
    }
    return reply.send({ ok: true, user: session.user, type: session.type });
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const session = getSessionFromCookie(req.headers.cookie);
    if (session) logoutSession(session.sessionId);
    reply.clearCookie(cookieName, { path: '/' }).send({ ok: true });
  });

  app.get('/api/auth/logto', async (req, reply) => {
    const base = getRedirectUriBase(req);
    const redirectUri = `${base}/api/auth/logto/callback`;
    const result = getLogtoAuthUrl(redirectUri);
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
