/**
 * 认证服务：Frappe 用户名密码 / Token、Logto SSO；会话存 cookie，需认证的请求从 cookie 取会话
 */
import { config } from '../config.js';

const COOKIE_NAME = 'auth_session';
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

/** in-memory 会话：sessionId -> { type, user, frappeSid?, frappeToken?, expiresAt } */
const sessions = new Map();

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

function getFrappeBase() {
  const base = config.cos?.baseUrl || '';
  return base.replace(/\/api\/?$/, '') || base;
}

/**
 * Frappe 用户名密码登录：POST /api/method/login，返回 Set-Cookie sid
 */
export async function loginWithPassword(usr, pwd) {
  const base = getFrappeBase();
  if (!base) {
    return { ok: false, error: '未配置 COS_ERP_BASE' };
  }
  const url = `${base}/api/method/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usr, pwd }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.exc || `HTTP ${res.status}`,
    };
  }
  const sid = res.headers.get('set-cookie')?.match(/sid=([^;]+)/)?.[1];
  if (!sid) {
    return { ok: false, error: '登录成功但未返回会话' };
  }
  const fullName = data.full_name || usr;
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    type: 'frappe',
    user: fullName,
    frappeSid: sid,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return { ok: true, sessionId, user: fullName };
}

/**
 * Token 登录：用 api_key:api_secret 调 get_logged_user 校验
 */
export async function loginWithToken(token) {
  const base = getFrappeBase();
  if (!base) {
    return { ok: false, error: '未配置 COS_ERP_BASE' };
  }
  const [apiKey, apiSecret] = String(token).split(':');
  if (!apiKey?.trim()) {
    return { ok: false, error: 'Token 格式应为 api_key:api_secret' };
  }
  const auth = apiSecret ? `token ${apiKey}:${apiSecret}` : `Bearer ${apiKey}`;
  const url = `${base}/api/method/frappe.auth.get_logged_user`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: auth },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.exc || `HTTP ${res.status}`,
    };
  }
  const user = typeof data.message === 'string' ? data.message : (data.message?.message ?? data.message ?? '');
  if (!user) {
    return { ok: false, error: '无法获取当前用户' };
  }
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    type: 'token',
    user,
    frappeToken: token,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return { ok: true, sessionId, user };
}

/**
 * 从 cookie 中取 sessionId，返回会话信息（并做过期清理）
 */
export function getSessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const sessionId = match?.[1]?.trim();
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { sessionId, ...session };
}

/**
 * 登出：删除服务端会话
 */
export function logoutSession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

export function getCookieName() {
  return COOKIE_NAME;
}

/**
 * 供 cosClient 等使用：根据会话获取请求 Frappe 时的 Authorization 或 Cookie
 */
export function getFrappeAuthForSession(session) {
  if (!session) return {};
  if (session.frappeSid) {
    return { Cookie: `sid=${session.frappeSid}` };
  }
  if (session.frappeToken) {
    const token = session.frappeToken;
    const prefix = token.includes(':') ? 'token ' : 'Bearer ';
    return { Authorization: prefix + token };
  }
  return {};
}

/**
 * Logto SSO：生成授权 URL
 */
export function getLogtoAuthUrl(redirectUri, state) {
  const { endpoint, appId } = config.logto || {};
  if (!endpoint || !appId) {
    return { ok: false, error: '未配置 Logto（LOGTO_ENDPOINT / LOGTO_APP_ID）' };
  }
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile',
    state: state || generateSessionId(),
  });
  return { ok: true, url: `${endpoint}/oidc/auth?${params.toString()}`, state: params.get('state') };
}

/**
 * Logto 回调：用 code 换 token，再取用户信息，创建会话
 */
export async function handleLogtoCallback(code, redirectUri) {
  const { endpoint, appId, appSecret } = config.logto || {};
  if (!endpoint || !appId) {
    return { ok: false, error: '未配置 Logto' };
  }
  const tokenRes = await fetch(`${endpoint}/oidc/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: appId,
      ...(appSecret && { client_secret: appSecret }),
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return { ok: false, error: tokenData.error_description || tokenData.error || '换取 token 失败' };
  }
  const meRes = await fetch(`${endpoint}/oidc/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meData = await meRes.json().catch(() => ({}));
  const user = meData.name || meData.sub || meData.username || 'Logto User';
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    type: 'logto',
    user,
    logtoSub: meData.sub,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return { ok: true, sessionId, user };
}

// 定时清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (s.expiresAt < now) sessions.delete(id);
  }
}, 60 * 60 * 1000);
