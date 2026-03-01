/**
 * 用户偏好：从 Logto customData 读写（Account API 优先，M2M 回退）
 * 在 api 内实现，与 middleware logtoManagement 行为对齐
 */
import { config } from '../config.js';

export const LOGTO_CUSTOM_DATA_PREFERENCES_KEY = 'preferences' as const;

export const PREF_KEYS = {
  theme: 'theme',
  uiFontSizeStep: 'uiFontSizeStep',
  notificationsEnabled: 'notificationsEnabled',
} as const;

const PREF_KEY_SET = new Set<string>(Object.values(PREF_KEYS));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function getPreferencesFromCustomData(customData: Record<string, unknown>): Record<string, unknown> {
  const prefs = customData[LOGTO_CUSTOM_DATA_PREFERENCES_KEY];
  if (!isPlainObject(prefs)) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(prefs)) {
    if (PREF_KEY_SET.has(key)) out[key] = prefs[key];
  }
  return out;
}

export function mergePreferencesIntoCustomData(
  customData: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const prefs = customData[LOGTO_CUSTOM_DATA_PREFERENCES_KEY];
  const current = isPlainObject(prefs) ? prefs : {};
  const next: Record<string, unknown> = { ...current };
  for (const key of Object.keys(patch)) {
    if (PREF_KEY_SET.has(key)) next[key] = patch[key];
  }
  return { ...customData, [LOGTO_CUSTOM_DATA_PREFERENCES_KEY]: next };
}

function getApiIndicator(): string {
  const { endpoint } = config.logto;
  return endpoint?.includes('.logto.app') ? `${endpoint}/api` : 'https://default.logto.app/api';
}

/** 使用用户 access token 调 Account API 获取 customData */
export async function getLogtoUserCustomDataViaAccountApi(
  accessToken: string
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  const { endpoint } = config.logto;
  if (!endpoint) return { ok: false, error: '未配置 Logto', statusCode: 503 };
  try {
    const res = await fetch(`${endpoint}/api/my-account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      const errMsg = body ? (() => {
        try {
          const o = JSON.parse(body) as { error?: string; message?: string };
          return o.error ?? o.message ?? body.slice(0, 200);
        } catch {
          return body.slice(0, 200);
        }
      })() : res.statusText;
      return { ok: false, error: errMsg || '获取 my-account 失败', statusCode: res.status };
    }
    const data = (await res.json().catch(() => ({}))) as { custom_data?: Record<string, unknown>; customData?: Record<string, unknown> };
    const customData = data.custom_data ?? data.customData ?? {};
    return { ok: true, customData };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/** 使用用户 access token 调 Account API 更新 customData */
export async function patchLogtoUserCustomDataViaAccountApi(
  accessToken: string,
  customData: Record<string, unknown>
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  const { endpoint } = config.logto;
  if (!endpoint) return { ok: false, error: '未配置 Logto', statusCode: 503 };
  try {
    const res = await fetch(`${endpoint}/api/my-account`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customData }),
    });
    if (!res.ok) {
      const body = await res.text();
      const errMsg = body ? (() => {
        try {
          const o = JSON.parse(body) as { error?: string; message?: string };
          return o.error ?? o.message ?? body.slice(0, 200);
        } catch {
          return body.slice(0, 200);
        }
      })() : res.statusText;
      return { ok: false, error: errMsg || '更新 my-account 失败', statusCode: res.status };
    }
    const data = (await res.json().catch(() => ({}))) as { custom_data?: Record<string, unknown>; customData?: Record<string, unknown> };
    const out = data.custom_data ?? data.customData ?? customData;
    return { ok: true, customData: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
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

/** M2M：获取用户 customData */
export async function getLogtoUserCustomData(
  userId: string
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  if (!userId?.trim()) return { ok: false, error: '用户 ID 为空', statusCode: 400 };
  if (!isM2mConfigured()) return { ok: false, error: '未配置 Logto M2M', statusCode: 503 };
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, error: '获取 M2M token 失败', statusCode: 503 };
  const apiIndicator = getApiIndicator();
  try {
    const res = await fetch(`${apiIndicator}/users/${encodeURIComponent(userId.trim())}/custom-data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: body ? (() => {
          try {
            const o = JSON.parse(body) as { message?: string };
            return o.message ?? body.slice(0, 200);
          } catch {
            return body.slice(0, 200);
          }
        })() : res.statusText,
        statusCode: res.status,
      };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: true, customData: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/** M2M：部分更新用户 customData */
export async function patchLogtoUserCustomData(
  userId: string,
  customData: Record<string, unknown>
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  if (!userId?.trim()) return { ok: false, error: '用户 ID 为空', statusCode: 400 };
  if (!isM2mConfigured()) return { ok: false, error: '未配置 Logto M2M', statusCode: 503 };
  const token = await getM2mAccessToken();
  if (!token) return { ok: false, error: '获取 M2M token 失败', statusCode: 503 };
  const apiIndicator = getApiIndicator();
  try {
    const res = await fetch(`${apiIndicator}/users/${encodeURIComponent(userId.trim())}/custom-data`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customData }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: body ? (() => {
          try {
            const o = JSON.parse(body) as { message?: string };
            return o.message ?? body.slice(0, 200);
          } catch {
            return body.slice(0, 200);
          }
        })() : res.statusText,
        statusCode: res.status,
      };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const out = data && typeof data === 'object' && 'customData' in data
      ? (data.customData as Record<string, unknown>)
      : data ?? customData;
    return { ok: true, customData: out as Record<string, unknown> };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}
