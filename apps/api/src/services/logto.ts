/**
 * Logto 回调：code 换 token、拉 /oidc/me、建会话（阶段 1 最小集，无 Matrix/Account API 补全）
 */
import { config } from '../config.js';
import { saveSession, type UserProfile } from './sessionStore.js';

const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export interface CallbackOk {
  ok: true;
  sessionId: string;
  user: string;
}
export interface CallbackFail {
  ok: false;
  error: string;
}

export async function handleLogtoCallback(
  code: string,
  redirectUri: string
): Promise<CallbackOk | CallbackFail> {
  const { endpoint, appId, appSecret } = config.logto;
  if (!endpoint || !appId) {
    return { ok: false, error: '未配置 Logto（LOGTO_ENDPOINT / LOGTO_APP_ID）' };
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
  const email = (meData.email as string) ?? (meData.primaryEmail as string) ?? undefined;
  const avatarVal = meData.picture ?? meData.avatar;
  const logtoSub = typeof meData.sub === 'string' ? meData.sub : undefined;
  const userProfile: UserProfile = {
    name: displayName,
    ...(username && { username }),
    ...(email && { email }),
    ...(typeof avatarVal === 'string' && avatarVal && { avatar: avatarVal }),
  };
  const expiresIn = Math.max(Number(tokenData.expires_in) || 3600, 60);
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
  return { ok: true, sessionId: session.sessionId, user: displayName };
}
