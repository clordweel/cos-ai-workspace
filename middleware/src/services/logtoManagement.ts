/**
 * Logto Management API：使用 @logto/api 调用修改用户密码等
 * 需 M2M 应用（LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET，不填则用 APP_ID/APP_SECRET）
 */
import { createManagementApi } from '@logto/api/management';
import { config } from '../config.js';

/** 仅当显式配置了 M2M 应用时为 true（不使用 APP_ID/APP_SECRET 回退，避免 client_credentials 400） */
function isConfigured(): boolean {
  const { logto } = config;
  return Boolean(
    logto?.endpoint &&
    process.env.LOGTO_M2M_APP_ID &&
    process.env.LOGTO_M2M_APP_SECRET
  );
}

let apiClient: ReturnType<typeof createManagementApi>['apiClient'] | null = null;

function getApiClient(): ReturnType<typeof createManagementApi>['apiClient'] {
  if (!apiClient) {
    if (!isConfigured()) {
      throw new Error('未配置 Logto M2M（LOGTO_ENDPOINT + LOGTO_M2M_APP_ID + LOGTO_M2M_APP_SECRET）');
    }
    const { endpoint, m2mAppId, m2mAppSecret } = config.logto;
    // 自托管 OSS：resource 固定为 https://default.logto.app/api；Logto Cloud 用 endpoint/api
    const apiIndicator = endpoint.includes('.logto.app')
      ? `${endpoint}/api`
      : 'https://default.logto.app/api';
    const { apiClient: client } = createManagementApi('default', {
      clientId: m2mAppId,
      clientSecret: m2mAppSecret,
      baseUrl: endpoint,
      apiIndicator,
    });
    apiClient = client;
  }
  return apiClient;
}

/**
 * Logto customData 约定结构：
 * - preferences：本应用用户偏好（主题、字体、通知），仅本应用读写
 * - 其它顶层 key 预留给其它用途，本应用不读写
 */
export const LOGTO_CUSTOM_DATA_PREFERENCES_KEY = 'preferences' as const;

/** 应用在 customData.preferences 中的字段（与前端约定） */
export const LOGTO_CUSTOM_DATA_KEYS = {
  theme: 'theme',
  uiFontSizeStep: 'uiFontSizeStep',
  notificationsEnabled: 'notificationsEnabled',
} as const;

export type LogtoCustomDataPreferences = {
  theme?: 'light' | 'dark' | 'system';
  uiFontSizeStep?: number;
  notificationsEnabled?: boolean;
};

const PREF_KEYS = new Set<string>(Object.values(LOGTO_CUSTOM_DATA_KEYS));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 从 customData.preferences 中仅提取约定字段，返回给前端的偏好对象 */
export function getPreferencesFromCustomData(customData: Record<string, unknown>): Record<string, unknown> {
  const prefs = customData[LOGTO_CUSTOM_DATA_PREFERENCES_KEY];
  if (!isPlainObject(prefs)) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(prefs)) {
    if (PREF_KEYS.has(key)) out[key] = prefs[key];
  }
  return out;
}

/** 将偏好 patch 合并进 customData.preferences，返回新的 customData（不修改原对象） */
export function mergePreferencesIntoCustomData(
  customData: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const prefs = customData[LOGTO_CUSTOM_DATA_PREFERENCES_KEY];
  const current = isPlainObject(prefs) ? prefs : {};
  const next: Record<string, unknown> = { ...current };
  for (const key of Object.keys(patch)) {
    if (PREF_KEYS.has(key)) next[key] = patch[key];
  }
  return { ...customData, [LOGTO_CUSTOM_DATA_PREFERENCES_KEY]: next };
}

/**
 * 使用用户 access token 调 Account API 获取当前用户 customData（无需 M2M）
 */
export async function getLogtoUserCustomDataViaAccountApi(
  accessToken: string
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  const { endpoint } = config.logto || {};
  if (!endpoint) return { ok: false, error: '未配置 Logto', statusCode: 503 };
  try {
    const res = await fetch(`${endpoint}/api/my-account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      const errMsg = body
        ? (() => {
            try {
              const o = JSON.parse(body) as { error?: string; message?: string };
              return o.error ?? o.message ?? body.slice(0, 200);
            } catch {
              return body.slice(0, 200);
            }
          })()
        : res.statusText;
      return {
        ok: false,
        error: errMsg || '获取 my-account 失败',
        statusCode: res.status,
      };
    }
    const data = (await res.json().catch(() => ({}))) as { custom_data?: Record<string, unknown>; customData?: Record<string, unknown> };
    const customData = data.custom_data ?? data.customData ?? {};
    return { ok: true, customData };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/**
 * 使用用户 access token 调 Account API 更新当前用户 customData（无需 M2M）
 */
export async function patchLogtoUserCustomDataViaAccountApi(
  accessToken: string,
  customData: Record<string, unknown>
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  const { endpoint } = config.logto || {};
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
      const errMsg = body
        ? (() => {
            try {
              const o = JSON.parse(body) as { error?: string; message?: string };
              return o.error ?? o.message ?? body.slice(0, 200);
            } catch {
              return body.slice(0, 200);
            }
          })()
        : res.statusText;
      if (res.status === 400) {
        console.warn('[logto] PATCH my-account 400:', errMsg, 'body 前 200 字:', body.slice(0, 200));
      }
      return {
        ok: false,
        error: errMsg || '更新 my-account 失败',
        statusCode: res.status,
      };
    }
    const data = (await res.json().catch(() => ({}))) as { custom_data?: Record<string, unknown>; customData?: Record<string, unknown> };
    const out = data.custom_data ?? data.customData ?? customData;
    return { ok: true, customData: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/**
 * 获取用户在 Logto 的 customData（用于偏好等，需 M2M）
 */
export async function getLogtoUserCustomData(
  userId: string
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  if (!userId?.trim()) {
    return { ok: false, error: '用户 ID 为空', statusCode: 400 };
  }
  if (!isConfigured()) {
    return { ok: false, error: '未配置 Logto M2M', statusCode: 503 };
  }
  try {
    const client = getApiClient();
    const res = await client.GET('/api/users/{userId}/custom-data', {
      params: { path: { userId: userId.trim() } },
    });
    if (res.error) {
      return {
        ok: false,
        error: (res.error as { message?: string })?.message || res.response?.statusText || '获取 customData 失败',
        statusCode: res.response?.status,
      };
    }
    const data = (res.data ?? {}) as Record<string, unknown>;
    return { ok: true, customData: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/**
 * 部分更新用户在 Logto 的 customData（如主题、字体档位、通知开关）
 */
export async function patchLogtoUserCustomData(
  userId: string,
  customData: Record<string, unknown>
): Promise<{ ok: true; customData: Record<string, unknown> } | { ok: false; error: string; statusCode?: number }> {
  if (!userId?.trim()) {
    return { ok: false, error: '用户 ID 为空', statusCode: 400 };
  }
  if (!isConfigured()) {
    return { ok: false, error: '未配置 Logto M2M', statusCode: 503 };
  }
  try {
    const client = getApiClient();
    const res = await client.PATCH('/api/users/{userId}/custom-data', {
      params: { path: { userId: userId.trim() } },
      body: { customData: customData as Record<string, never> },
    });
    if (res.error) {
      const errMsg = (res.error as { message?: string })?.message || res.response?.statusText || '更新 customData 失败';
      const code = res.response?.status;
      console.warn('[logto] PATCH custom-data 失败:', code, errMsg, 'userId:', userId);
      return {
        ok: false,
        error: errMsg,
        statusCode: code,
      };
    }
    // Logto 200 响应体为更新后的 customData 对象；部分 SDK 可能返回 { customData } 包装
    const raw = res.data as Record<string, unknown> | undefined;
    const data = (raw && typeof raw === 'object' && 'customData' in raw
      ? (raw.customData as Record<string, unknown>)
      : raw) ?? {};
    return { ok: true, customData: data as Record<string, unknown> };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[logto] PATCH custom-data 异常:', msg);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/**
 * 使用 Management API 更新用户资料（邮箱、手机号等）
 * primaryPhone 需为 E.164 数字格式（不含 +），如 8613800138000
 */
export async function logtoUpdateUserProfile(
  userId: string,
  patch: { primaryEmail?: string | null; primaryPhone?: string | null }
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!userId?.trim()) {
    return { ok: false, error: '用户 ID 为空', statusCode: 400 };
  }
  if (!isConfigured()) {
    return { ok: false, error: '未配置 Logto M2M', statusCode: 503 };
  }
  const body: Record<string, string | null> = {};
  if (patch.primaryEmail !== undefined) {
    body.primaryEmail = patch.primaryEmail && patch.primaryEmail.trim() ? patch.primaryEmail.trim() : null;
  }
  if (patch.primaryPhone !== undefined) {
    const raw = patch.primaryPhone?.trim();
    const digits = raw ? raw.replace(/\D/g, '') : '';
    body.primaryPhone = digits ? digits : null;
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, error: '请提供要更新的字段', statusCode: 400 };
  }
  try {
    const client = getApiClient();
    const res = await client.PATCH('/api/users/{userId}', {
      params: { path: { userId: userId.trim() } },
      body: body as Record<string, never>,
    });
    if (res.error) {
      return {
        ok: false,
        error: (res.error as { message?: string })?.message || res.response?.statusText || '更新用户资料失败',
        statusCode: res.response?.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}

/**
 * 使用 Management API 修改用户密码（无需当前密码）
 * @param userId - Logto 用户 ID（如 session.logtoSub）
 * @param newPassword - 新密码
 */
export async function logtoUpdateUserPassword(
  userId: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!userId?.trim()) {
    return { ok: false, error: '用户 ID 为空', statusCode: 400 };
  }
  if (!newPassword || newPassword.length < 1) {
    return { ok: false, error: '新密码不能为空', statusCode: 400 };
  }
  if (!isConfigured()) {
    return { ok: false, error: '未配置 Logto M2M', statusCode: 503 };
  }
  try {
    const client = getApiClient();
    const res = await client.PATCH('/api/users/{userId}/password', {
      params: { path: { userId: userId.trim() } },
      body: { password: newPassword },
    });
    if (res.error) {
      return {
        ok: false,
        error: (res.error as { message?: string })?.message || res.response?.statusText || '修改 Logto 密码失败',
        statusCode: res.response?.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, statusCode: 500 };
  }
}
