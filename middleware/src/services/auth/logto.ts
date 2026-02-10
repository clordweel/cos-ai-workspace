/**
 * Logto SSO：授权 URL、回调换 token、用 access token 建会话；登录成功后同步 Matrix 用户
 */
import { config } from '../../config.js';
import { ensureMatrixUser } from '../matrixUserSync.js';
import {
  generateSessionId,
  saveSession,
  SESSION_TTL_MS,
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
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
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
  const session = saveSession({
    type: 'logto',
    user: displayName,
    userProfile,
    logtoSub: meData.sub,
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
  const session = saveSession({
    type: 'logto',
    user: displayName,
    userProfile,
    logtoSub: meData.sub,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  if (meData.sub) syncMatrixUser(meData.sub, displayName, meData.email);
  return { ok: true, sessionId: session.sessionId, user: displayName };
}
