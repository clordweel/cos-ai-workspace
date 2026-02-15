/**
 * 认证路由（阶段 1 最小集）：Logto 回调、GET /api/auth/me
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getSessionFromCookie, getStableUserId, getCookieName } from '../services/sessionStore.js';
import { getLogtoAuthUrl, handleLogtoCallback } from '../services/logto.js';

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

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const cookieName = getCookieName();

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
      return reply.redirect(redirectToFront(query.redirect_uri, '/space?auth_error=missing_code'), 302);
    }
    const result = await handleLogtoCallback(code, redirectUri);
    if (!result.ok) {
      return reply.redirect(redirectToFront(query.redirect_uri, `/space?auth_error=${encodeURIComponent(result.error)}`), 302);
    }
    const frontOrigin =
      frontOriginFromRedirectUri(query.redirect_uri) ?? config.frontendOrigin.replace(/\/$/, '');
    return reply
      .setCookie(cookieName, result.sessionId, { ...COOKIE_OPTS, domain: undefined })
      .redirect(`${frontOrigin}/space?auth=ok`, 302);
  });

  app.get('/api/auth/me', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({ ok: false, error: '未登录' });
    }
    const user = session.userProfile ?? { name: session.user };
    const userId = getStableUserId(session);
    const payload = {
      ok: true as const,
      user,
      userId,
      type: session.type,
      preferences: {} as Record<string, unknown>,
    };
    return reply.send(payload);
  });
}
