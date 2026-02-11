/**
 * Logto SSO：授权 URL、回调换 token、用 access token 建会话；登录成功后同步 Matrix 用户
 */
import { config } from '../../config.js';
import { formatPhoneForDisplay } from '../../utils/phoneFormat.js';
import { ensureMatrixUser, isMatrixConfigured } from '../matrixUserSync.js';
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
  // custom_data：Account API PATCH /api/my-account 读写 customData 所需；phone 用于同步手机号到 Matrix
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email phone offline_access custom_data',
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

/** 从 Logto /oidc/me 响应中提取手机号（兼容多种字段名与结构） */
function extractPhoneFromMeData(meData: Record<string, unknown>): string | undefined {
  const v = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
  const phone =
    v(meData.phone) ??
    v(meData.primaryPhone) ??
    v(meData.primary_phone) ??
    v(meData.phone_number) ??
    v(meData.phoneNumber);
  if (phone) return phone;
  const customData = meData.custom_data as Record<string, unknown> | undefined;
  if (customData && typeof customData === 'object') {
    const cd =
      v(customData.phone) ?? v(customData.primaryPhone) ?? v(customData.primary_phone);
    if (cd) return cd;
  }
  const ids = meData.identifiers as Array<{ type?: string; value?: string }> | undefined;
  if (Array.isArray(ids)) {
    const phoneId = ids.find((i) => /phone|msisdn/i.test(String(i?.type ?? '')));
    if (phoneId?.value) return v(phoneId.value);
  }
  return undefined;
}

/** Logto 回调：用 code 换 token，再取用户信息，创建会话；会 await Matrix 用户同步后再返回，确保重定向前用户已创建 */
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
  const meData = (await meRes.json().catch(() => ({}))) as Record<string, unknown>;
  const displayName =
    (meData.name as string) || (meData.username as string) || (meData.sub as string) || 'Logto User';
  const username = typeof meData.username === 'string' ? meData.username : undefined;
  const email =
    (meData.email as string) ?? (meData.primaryEmail as string) ?? undefined;
  const phoneRaw = extractPhoneFromMeData(meData);
  const phone = phoneRaw ? formatPhoneForDisplay(phoneRaw) : undefined;
  const avatarVal = meData.picture ?? meData.avatar;
  const userProfile: UserProfile = {
    name: displayName,
    ...(username && { username }),
    ...(email && { email }),
    ...(phone && { phone }),
    ...(typeof avatarVal === 'string' && avatarVal && { avatar: avatarVal }),
  };
  const expiresIn = Math.max(Number(tokenData.expires_in) || 3600, 60);
  const logtoSub = typeof meData.sub === 'string' ? meData.sub : undefined;
  const session = await saveSession({
    type: 'logto',
    user: displayName,
    userProfile,
    logtoSub,
    logtoAccessToken: accessToken,
    ...(tokenData.refresh_token && { logtoRefreshToken: tokenData.refresh_token }),
    logtoTokenExpiresAt: Date.now() + expiresIn * 1000,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  if (logtoSub) {
    const out = await ensureMatrixUser(logtoSub, displayName, email, phone, username)
      .catch((err) => {
        console.warn('[auth] Matrix 用户同步异常:', err instanceof Error ? err.message : err, err);
        return null;
      });
    if (out?.ok) {
      if (out.created) {
        console.info(`[auth] Matrix 用户已创建: ${out.matrixUserId} (Logto sub: ${logtoSub} username: ${username || '-'})`);
      } else {
        console.info(`[auth] Matrix 用户已存在: ${out.matrixUserId} (Logto sub: ${logtoSub})`);
      }
    } else if (out && !out.ok) {
      console.warn(
        `[auth] Matrix 用户同步失败 (Logto sub: ${logtoSub} username: ${username || '-'}): status=${(out as { statusCode?: number }).statusCode} err=${out.error}`
      );
    }
  }
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
  if (!meRes.ok) {
    const body = await meRes.text();
    const logtoErr =
      body &&
      (() => {
        try {
          const o = JSON.parse(body) as { error?: string; message?: string };
          return o.error ?? o.message;
        } catch {
          return undefined;
        }
      })();
    const msg =
      /token.*not active|token.*invalid|token.*expired/i.test(logtoErr ?? '')
        ? '登录已失效，请重新登录'
        : logtoErr || 'Token 无效或已过期';
    return { ok: false, error: msg };
  }
  const meData = (await meRes.json().catch(() => ({}))) as Record<string, unknown>;
  const logtoSub = typeof meData.sub === 'string' ? meData.sub : undefined;
  if (!logtoSub) return { ok: false, error: '无法获取用户信息' };
  const displayName =
    (meData.name as string) || (meData.username as string) || logtoSub || 'Logto User';
  const username = typeof meData.username === 'string' ? meData.username : undefined;
  const email =
    (meData.email as string) ?? (meData.primaryEmail as string) ?? undefined;
  const phoneRaw = extractPhoneFromMeData(meData);
  const phone = phoneRaw ? formatPhoneForDisplay(phoneRaw) : undefined;
  const avatarVal = meData.picture ?? meData.avatar;
  const userProfile: UserProfile = {
    name: displayName,
    ...(username && { username }),
    ...(email && { email }),
    ...(phone && { phone }),
    ...(typeof avatarVal === 'string' && avatarVal && { avatar: avatarVal }),
  };
  // sync-session 仅带 accessToken，无 refresh_token，设 1 小时过期
  const session = await saveSession({
    type: 'logto',
    user: displayName,
    userProfile,
    logtoSub,
    logtoAccessToken: accessToken,
    logtoTokenExpiresAt: Date.now() + 3600 * 1000,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  if (logtoSub && isMatrixConfigured()) {
    await ensureMatrixUser(logtoSub, displayName, email, phone, username)
      .then((out) => {
        if (out.ok && out.created) {
          console.info(`[auth] sync-session Matrix 用户已创建: ${out.matrixUserId}`);
        } else if (!out.ok) {
          console.warn(`[auth] sync-session Matrix 同步失败: ${out.error}`);
        }
      })
      .catch((err) => {
        console.warn('[auth] sync-session Matrix 同步异常:', err instanceof Error ? err.message : err);
      });
  }
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
