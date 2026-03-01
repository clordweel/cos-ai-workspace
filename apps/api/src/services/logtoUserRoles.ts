/**
 * 从 Logto 获取当前用户的角色列表。
 * 仅使用非 M2M 应用（OAuth/第三方应用）返回的角色：ID token、access token 自定义声明、userinfo。
 * 见 https://docs.logto.io/integrate-logto/third-party-applications/permission-management
 */
import { config } from '../config.js';

export interface LogtoRole {
  id: string;
  name: string;
  description?: string;
}

/** 解码 JWT payload（不校验签名，仅用于读取声明） */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function normalizeRoles(raw: unknown): LogtoRole[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r != null)
    .map((r) => {
      if (typeof r === 'string') return { id: r, name: r };
      if (typeof r === 'object' && r !== null && 'name' in r && typeof (r as { name: unknown }).name === 'string') {
        const o = r as { id?: string; name: string; description?: string };
        return { id: typeof o.id === 'string' ? o.id : o.name, name: o.name, ...(typeof o.description === 'string' && o.description && { description: o.description }) };
      }
      return null;
    })
    .filter((r): r is LogtoRole => r !== null);
}

/**
 * 从 Logto 返回的 ID token（JWT）中解析 roles。
 * Logto 将 roles 放在 ID token 的扩展声明中，不在 userinfo；登录回调时用此函数解析并存入 session。
 */
export function getRolesFromIdToken(idToken: string): LogtoRole[] {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return [];
  const raw = payload.roles ?? payload.role;
  return normalizeRoles(raw);
}

/**
 * 从用户 access token（JWT）中解析 roles。
 * 当在 Logto 控制台「自定义 JWT」→「User access token」中通过 getCustomJwtClaims 注入了 roles 时，可由此读取。
 * 若 token 为 opaque 则返回空数组。
 */
export function getRolesFromAccessToken(accessToken: string): LogtoRole[] {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return [];
  const raw = payload.roles ?? payload.role;
  return normalizeRoles(raw);
}

/**
 * 用用户 access token 调 /oidc/me 获取角色（需授权时请求 roles scope，且应用已授予「用户数据权限」中的 roles）。
 * 注意：当前 Logto 可能仅在 ID token 中返回 roles，不在 userinfo，故优先使用登录时从 id_token 解析的 session.logtoUserRoles。
 * 不依赖 M2M，避免 Management API 403。
 */
export async function getLogtoUserRolesViaUserToken(
  accessToken: string,
  log?: { info: (obj: object, msg?: string) => void }
): Promise<{ ok: true; roles: LogtoRole[] } | { ok: false; roles: [] }> {
  const endpoint = config.logto.endpoint?.replace(/\/$/, '');
  if (!endpoint || !accessToken?.trim()) return { ok: false, roles: [] };
  try {
    const res = await fetch(`${endpoint}/oidc/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, roles: [] };
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return { ok: false, roles: [] };
    const rawRoles = data.roles ?? data.role;
    const roles = normalizeRoles(rawRoles);
    if (roles.length === 0 && log) {
      log.info({ oidcMeKeys: Object.keys(data), hasRolesKey: 'roles' in data, hasRoleKey: 'role' in data }, 'oidc/me 未返回角色，请确认应用已授予 roles 权限并重新登录');
    }
    return { ok: true, roles };
  } catch {
    return { ok: false, roles: [] };
  }
}

function isM2mConfigured(): boolean {
  const { logto } = config;
  return Boolean(
    logto?.endpoint &&
    process.env.LOGTO_M2M_APP_ID &&
    process.env.LOGTO_M2M_APP_SECRET
  );
}

let m2mTokenCache: { token: string; expiresAt: number } | null = null;

async function getM2mAccessToken(): Promise<string | null> {
  const { endpoint, m2mAppId, m2mAppSecret } = config.logto;
  if (!endpoint || !m2mAppId || !m2mAppSecret) return null;
  if (m2mTokenCache && m2mTokenCache.expiresAt > Date.now() + 60_000) {
    return m2mTokenCache.token;
  }
  try {
    const resource = endpoint.includes('.logto.app') ? `${endpoint}/api` : 'https://default.logto.app/api';
    const res = await fetch(`${endpoint}/oidc/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: m2mAppId,
        client_secret: m2mAppSecret,
        resource,
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

/**
 * 获取指定 Logto 用户（logtoSub）的角色列表。
 * 未配置 M2M 或请求失败时返回空数组（不抛错），便于 /api/auth/me 照常返回。
 * 注意：仅返回「已关联到 API 资源」的角色；在控制台为用户分配的角色须属于某 API 资源才会在此出现。
 */
export async function getLogtoUserRoles(
  logtoUserId: string,
  log?: { warn: (obj: object, msg: string) => void }
): Promise<{ ok: true; roles: LogtoRole[] } | { ok: false; roles: [] }> {
  if (!logtoUserId?.trim()) return { ok: false, roles: [] };
  if (!isM2mConfigured()) return { ok: false, roles: [] };
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, roles: [] };
  const base = config.logto.endpoint?.replace(/\/$/, '');
  if (!base) return { ok: false, roles: [] };
  try {
    const url = `${base}/api/users/${encodeURIComponent(logtoUserId.trim())}/roles`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      log?.warn(
        { statusCode: res.status, logtoUserId: logtoUserId.slice(0, 8) + '…', body: body.slice(0, 200) },
        'Logto 获取用户角色非 2xx'
      );
      return { ok: false, roles: [] };
    }
    const raw = (await res.json().catch(() => null)) as Array<{ id?: string; name?: string; description?: string }> | null;
    if (!Array.isArray(raw)) return { ok: false, roles: [] };
    const roles: LogtoRole[] = raw
      .filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string')
      .map((r) => ({
        id: r.id!,
        name: r.name!,
        ...(typeof r.description === 'string' && r.description && { description: r.description }),
      }));
    return { ok: true, roles };
  } catch {
    return { ok: false, roles: [] };
  }
}
