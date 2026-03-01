/**
 * Logto Management API 代理：用户列表、角色列表、分配角色等。
 * 需配置 LOGTO_M2M_APP_ID、LOGTO_M2M_APP_SECRET，且 M2M 应用已授予 Management API 权限。
 */
import { config } from '../config.js';

const resource = (endpoint: string) =>
  endpoint.includes('.logto.app') ? `${endpoint}/api` : 'https://default.logto.app/api';

let m2mTokenCache: { token: string; expiresAt: number } | null = null;

async function getM2mAccessToken(): Promise<string | null> {
  const { endpoint, m2mAppId, m2mAppSecret } = config.logto;
  if (!endpoint || !m2mAppId || !m2mAppSecret) return null;
  if (m2mTokenCache && m2mTokenCache.expiresAt > Date.now() + 60_000) {
    return m2mTokenCache.token;
  }
  try {
    const res = await fetch(`${endpoint}/oidc/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: m2mAppId,
        client_secret: m2mAppSecret,
        resource: resource(endpoint),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !data.access_token) return null;
    m2mTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    return m2mTokenCache.token;
  } catch {
    return null;
  }
}

function apiBase(): string {
  const base = config.logto.endpoint?.replace(/\/$/, '');
  return base ? `${base}/api` : '';
}

export function isManagementApiConfigured(): boolean {
  return Boolean(
    config.logto.endpoint &&
    config.logto.m2mAppId &&
    config.logto.m2mAppSecret
  );
}

export interface LogtoUserListItem {
  id: string;
  username?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  name?: string;
  avatar?: string;
  roleNames?: string[];
  createdAt?: number;
}

export interface LogtoRoleListItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

/** GET /api/users 分页列表 */
export async function listUsers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<{ ok: true; data: LogtoUserListItem[]; totalCount?: number } | { ok: false; error: string; statusCode?: number }> {
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, error: '未配置 Logto M2M 或获取 token 失败', statusCode: 503 };
  const base = apiBase();
  if (!base) return { ok: false, error: '未配置 LOGTO_ENDPOINT', statusCode: 503 };
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.page_size != null) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();
  const url = qs ? `${base}/users?${qs}` : `${base}/users`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json().catch(() => null)) as
      | { data?: LogtoUserListItem[]; totalCount?: number }
      | { code?: string; message?: string }
      | null;
    if (!res.ok) {
      const msg = data && typeof data === 'object' && 'message' in data ? String((data as { message?: string }).message) : res.statusText;
      return { ok: false, error: msg || `Logto API ${res.status}`, statusCode: res.status };
    }
    if (data && typeof data === 'object') {
      const d = data as { data?: LogtoUserListItem[]; totalCount?: number; users?: LogtoUserListItem[] };
      if (Array.isArray(d.data)) return { ok: true, data: d.data, totalCount: d.totalCount };
      if (Array.isArray(d.users)) return { ok: true, data: d.users, totalCount: d.totalCount ?? d.users.length };
      if (Array.isArray(data)) return { ok: true, data: data as LogtoUserListItem[], totalCount: (data as LogtoUserListItem[]).length };
    }
    return { ok: true, data: [], totalCount: 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), statusCode: 500 };
  }
}

/** GET /api/roles 角色列表 */
export async function listRoles(): Promise<{
  ok: true;
  data: LogtoRoleListItem[];
} | { ok: false; error: string; statusCode?: number }> {
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, error: '未配置 Logto M2M 或获取 token 失败', statusCode: 503 };
  const base = apiBase();
  if (!base) return { ok: false, error: '未配置 LOGTO_ENDPOINT', statusCode: 503 };
  try {
    const res = await fetch(`${base}/roles`, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json().catch(() => null)) as
      | { data?: LogtoRoleListItem[] }
      | { code?: string; message?: string }
      | null;
    if (!res.ok) {
      const msg = data && typeof data === 'object' && 'message' in data ? String((data as { message?: string }).message) : res.statusText;
      return { ok: false, error: msg || `Logto API ${res.status}`, statusCode: res.status };
    }
    if (data && typeof data === 'object') {
      const d = data as { data?: LogtoRoleListItem[] };
      if (Array.isArray(d.data)) return { ok: true, data: d.data };
      if (Array.isArray(data)) return { ok: true, data: data as LogtoRoleListItem[] };
    }
    return { ok: true, data: [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), statusCode: 500 };
  }
}

/** POST /api/roles/:id/users 将用户加入角色 */
export async function assignRoleToUsers(
  roleId: string,
  userIds: string[]
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, error: '未配置 Logto M2M 或获取 token 失败', statusCode: 503 };
  const base = apiBase();
  if (!base) return { ok: false, error: '未配置 LOGTO_ENDPOINT', statusCode: 503 };
  if (!roleId?.trim()) return { ok: false, error: '缺少 roleId', statusCode: 400 };
  try {
    const res = await fetch(`${base}/roles/${encodeURIComponent(roleId.trim())}/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIds: Array.isArray(userIds) ? userIds : [] }),
    });
    if (res.status === 204 || res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    const msg = data?.message ?? res.statusText;
    return { ok: false, error: msg || `Logto API ${res.status}`, statusCode: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), statusCode: 500 };
  }
}

/** DELETE /api/roles/:id/users/:userId 将用户从角色移除 */
export async function removeRoleFromUser(
  roleId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, error: '未配置 Logto M2M 或获取 token 失败', statusCode: 503 };
  const base = apiBase();
  if (!base) return { ok: false, error: '未配置 LOGTO_ENDPOINT', statusCode: 503 };
  if (!roleId?.trim() || !userId?.trim()) return { ok: false, error: '缺少 roleId 或 userId', statusCode: 400 };
  try {
    const res = await fetch(
      `${base}/roles/${encodeURIComponent(roleId.trim())}/users/${encodeURIComponent(userId.trim())}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 204 || res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    const msg = data?.message ?? res.statusText;
    return { ok: false, error: msg || `Logto API ${res.status}`, statusCode: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), statusCode: 500 };
  }
}
