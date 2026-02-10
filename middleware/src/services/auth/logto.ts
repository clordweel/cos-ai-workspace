/**
 * Logto SSO：授权 URL、回调换 token、用 access token 建会话；登录成功后同步 Matrix 用户
 */
import { config } from '../../config.js';
import { ensureMatrixUser } from '../matrixUserSync.js';
import {
  generateSessionId,
  saveSession,
  updateSession,
  SESSION_TTL_MS,
  type Session,
  type UserProfile,
} from './sessionStore.js';

export interface LogtoAuthUrlResult {
  ok: true;
  url: string;
  state: string | null;
}

export interface LogtoAuthUrlError {
  ok: false;
  error: string;
}

/** Logto SSO：生成授权 URL */
export function getLogtoAuthUrl(
  redirectUri: string,
  state?: string,
  options?: { prompt?: 'consent' | 'login' }
): LogtoAuthUrlResult | LogtoAuthUrlError {
  const { endpoint, appId } = config.logto || {};
  if (!endpoint || !appId) {
    return { ok: false, error: '未配置 Logto（LOGTO_ENDPOINT / LOGTO_APP_ID）' };
  }
  // custom_data：Account API PATCH /api/my-account 读写 customData 所需（不传 resource，避免「resource indicator missing or unknown」）
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email offline_access custom_data',
    state: state || generateSessionId(),
  });
  if (options?.prompt) params.set('prompt', options.prompt);
  return { ok: true, url: `${endpoint}/oidc/auth?${params.toString()}`, state: params.get('state') };
}

export interface LogtoCallbackResultOk {
  ok: true;
  sessionId: string;
  user: string;
}

export interface LogtoCallbackResultFail {
  ok: false;
  error: string;
}

function syncMatrixUser(sub: string, displayName: string, email?: string): void {
  if (config.chat?.provider !== 'matrix') return;
  ensureMatrixUser(sub, displayName, email)
    .then((out) => {
      if (out.ok && out.created) {
        console.info(`[auth] Matrix 用户已创建: ${out.matrixUserId} (Logto sub: ${sub})`);
      } else if (!out.ok) {
        console.warn(`[auth] Matrix 用户同步失败 (Logto sub: ${sub}): ${out.error}`);
      }
    })
    .catch((err) => {
      console.warn('[auth] Matrix 用户同步异常:', err instanceof Error ? err.message : err);
    });
}

/** Logto 回调：用 code 换 token，再取用户信息，创建会话 */
export async function handleLogtoCallback(
  code: string,
  redirectUri: string
): Promise<LogtoCallbackResultOk | LogtoCallbackResultFail> {
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
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return {
      ok: false,
      error: tokenData.error_description || tokenData.error || '换取 token 失败',
    };
  }
  const meRes = await fetch(`${endpoint}/oidc/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meData = (await meRes.json().catch(() => ({}))) as {
    name?: string;
    sub?: string;
    username?: string;
    email?: string;
    picture?: string;
  };
  const displayName = meData.name || meData.username || meData.sub || 'Logto User';
  const userProfile: UserProfile = {
    name: displayName,
    ...(meData.email && { email: meData.email }),
    ...(meData.picture && { avatar: meData.picture }),
  };
  const expiresIn = Math.max(Number(tokenData.expires_in) || 3600, 60);
  const session = await saveSession({
    type: 'logto',
    user: displayName,
    userProfile,
    logtoSub: meData.sub,
    logtoAccessToken: accessToken,
    ...(tokenData.refresh_token && { logtoRefreshToken: tokenData.refresh_token }),
    logtoTokenExpiresAt: Date.now() + expiresIn * 1000,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  if (meData.sub) syncMatrixUser(meData.sub, displayName, meData.email);
  return { ok: true, sessionId: session.sessionId, user: displayName };
}

/** 使用 Logto access token 创建中间层会话（供 @logto/nuxt 回调后同步 session 用） */
export async function createSessionFromLogtoAccessToken(
  accessToken: string
): Promise<LogtoCallbackResultOk | LogtoCallbackResultFail> {
  const { endpoint } = config.logto || {};
  if (!endpoint) return { ok: false, error: '未配置 Logto' };
  const meRes = await fetch(`${endpoint}/oidc/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) return { ok: false, error: 'Token 无效或已过期' };
  const meData = (await meRes.json().catch(() => ({}))) as {
    name?: string;
    sub?: string;
    username?: string;
    email?: string;
    picture?: string;
  };
  if (!meData.sub) return { ok: false, error: '无法获取用户信息' };
  const displayName = meData.name || meData.username || meData.sub || 'Logto User';
  const userProfile: UserProfile = {
    name: displayName,
    ...(meData.email && { email: meData.email }),
    ...(meData.picture && { avatar: meData.picture }),
  };
  // sync-session 仅带 accessToken，无 refresh_token，设 1 小时过期
  const session = await saveSession({
    type: 'logto',
    user: displayName,
    userProfile,
    logtoSub: meData.sub,
    logtoAccessToken: accessToken,
    logtoTokenExpiresAt: Date.now() + 3600 * 1000,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  if (meData.sub) syncMatrixUser(meData.sub, displayName, meData.email);
  return { ok: true, sessionId: session.sessionId, user: displayName };
}

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

/**
 * 获取可用于 Account API 的 Logto access token；若已过期则用 refresh_token 刷新并写回 session。
 * 无 token 或无法刷新时返回 null。
 */
export async function getLogtoAccessTokenForSession(
  session: Session | null | undefined
): Promise<string | null> {
  const { endpoint, appId, appSecret } = config.logto || {};
  if (!endpoint || !appId || !session?.logtoSub) return null;
  const now = Date.now();
  const expiresAt = session.logtoTokenExpiresAt ?? 0;
  if (session.logtoAccessToken && expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
    return session.logtoAccessToken;
  }
  if (!session.logtoRefreshToken) return session.logtoAccessToken || null;
  const refreshRes = await fetch(`${endpoint}/oidc/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.logtoRefreshToken,
      client_id: appId,
      ...(appSecret && { client_secret: appSecret }),
    }),
  });
  const refreshData = (await refreshRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!refreshData.access_token) return null;
  const newExpiresIn = Math.max(Number(refreshData.expires_in) || 3600, 60);
  await updateSession(session.sessionId, {
    logtoAccessToken: refreshData.access_token,
    ...(refreshData.refresh_token && { logtoRefreshToken: refreshData.refresh_token }),
    logtoTokenExpiresAt: now + newExpiresIn * 1000,
  });
  return refreshData.access_token;
}
