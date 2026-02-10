/**
 * Frappe 用户名密码 / Token 登录
 */
import { config } from '../../config.js';
import { saveSession, SESSION_TTL_MS } from './sessionStore.js';

function getFrappeBase(): string {
  const base = config.cos?.baseUrl || '';
  return base.replace(/\/api\/?$/, '') || base;
}

export interface LoginResultOk {
  ok: true;
  sessionId: string;
  user: string;
}

export interface LoginResultFail {
  ok: false;
  error: string;
}

export type LoginResult = LoginResultOk | LoginResultFail;

/** Frappe 用户名密码登录：POST /api/method/login，返回 Set-Cookie sid */
export async function loginWithPassword(usr: string, pwd: string): Promise<LoginResult> {
  const base = getFrappeBase();
  if (!base) return { ok: false, error: '未配置 COS_ERP_BASE' };
  const url = `${base}/api/method/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usr, pwd }),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; exc?: string; full_name?: string };
  if (!res.ok) {
    return { ok: false, error: data.message || data.exc || `HTTP ${res.status}` };
  }
  const sid = res.headers.get('set-cookie')?.match(/sid=([^;]+)/)?.[1];
  if (!sid) return { ok: false, error: '登录成功但未返回会话' };
  const fullName = data.full_name || usr;
  const session = saveSession({
    type: 'frappe',
    user: fullName,
    frappeSid: sid,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return { ok: true, sessionId: session.sessionId, user: fullName };
}

/** Token 登录：用 api_key:api_secret 调 get_logged_user 校验 */
export async function loginWithToken(token: string): Promise<LoginResult> {
  const base = getFrappeBase();
  if (!base) return { ok: false, error: '未配置 COS_ERP_BASE' };
  const [apiKey, apiSecret] = String(token).split(':');
  if (!apiKey?.trim()) return { ok: false, error: 'Token 格式应为 api_key:api_secret' };
  const auth = apiSecret ? `token ${apiKey}:${apiSecret}` : `Bearer ${apiKey}`;
  const url = `${base}/api/method/frappe.auth.get_logged_user`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: auth },
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string | { message?: string }; exc?: string };
  if (!res.ok) {
    return { ok: false, error: (data.message as string) || data.exc || `HTTP ${res.status}` };
  }
  const user =
    typeof data.message === 'string'
      ? data.message
      : (data.message as { message?: string } | undefined)?.message ?? (data.message as string) ?? '';
  if (!user) return { ok: false, error: '无法获取当前用户' };
  const session = saveSession({
    type: 'token',
    user,
    frappeToken: token,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return { ok: true, sessionId: session.sessionId, user };
}
