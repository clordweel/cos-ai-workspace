/**
 * 认证路由：登录（用户名密码 / Token）、Logto SSO、当前用户、登出；Cookie 保持会话
 */
import {
  loginWithPassword,
  loginWithToken,
  getSessionFromCookie,
  logoutSession,
  getCookieName,
  getLogtoAuthUrl,
  handleLogtoCallback,
} from '../services/auth.js';

const COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  maxAge: 3 * 24 * 60 * 60, // 3 天（秒）
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

export async function authRoutes(app) {
  const cookieName = getCookieName();

  /** POST /api/auth/login 用户名密码 */
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body || {};
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

  /** POST /api/auth/token 使用 Token 登录 */
  app.post('/api/auth/token', async (req, reply) => {
    const body = req.body || {};
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

  /** GET /api/auth/me 当前登录用户（从 Cookie 读会话） */
  app.get('/api/auth/me', async (req, reply) => {
    const session = getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({ ok: false, error: '未登录' });
    }
    return reply.send({ ok: true, user: session.user, type: session.type });
  });

  /** POST /api/auth/logout 登出 */
  app.post('/api/auth/logout', async (req, reply) => {
    const session = getSessionFromCookie(req.headers.cookie);
    if (session) logoutSession(session.sessionId);
    reply.clearCookie(cookieName, { path: '/' }).send({ ok: true });
  });

  /** GET /api/auth/logto 跳转至 Logto 登录 */
  app.get('/api/auth/logto', async (req, reply) => {
    const base = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : `${req.protocol}://${req.hostname}${req.port && req.port !== 80 && req.port !== 443 ? `:${req.port}` : ''}`;
    const redirectUri = `${base}/api/auth/logto/callback`;
    const result = getLogtoAuthUrl(redirectUri);
    if (!result.ok) {
      return reply.code(503).send({ ok: false, error: result.error });
    }
    return reply.redirect(302, result.url);
  });

  /** GET /api/auth/logto/callback Logto 回调，写 Cookie 后重定向到前端 */
  app.get('/api/auth/logto/callback', async (req, reply) => {
    const base = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : `${req.protocol}://${req.hostname}${req.port && req.port !== 80 && req.port !== 443 ? `:${req.port}` : ''}`;
    const redirectUri = `${base}/api/auth/logto/callback`;
    const code = req.query?.code;
    if (!code) {
      return reply.redirect(302, `/space?auth_error=missing_code`);
    }
    const result = await handleLogtoCallback(code, redirectUri);
    if (!result.ok) {
      return reply.redirect(302, `/space?auth_error=${encodeURIComponent(result.error)}`);
    }
    const frontOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
    reply
      .setCookie(cookieName, result.sessionId, { ...COOKIE_OPTS, domain: undefined })
      .redirect(302, `${frontOrigin}/space?auth=ok`);
  });
}
