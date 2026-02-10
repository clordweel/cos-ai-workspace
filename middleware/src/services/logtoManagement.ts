/**
 * Logto Management API：使用 @logto/api 调用修改用户密码等
 * 需 M2M 应用（LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET，不填则用 APP_ID/APP_SECRET）
 */
import { createManagementApi } from '@logto/api/management';
import { config } from '../config.js';

function isConfigured(): boolean {
  const { logto } = config;
  return Boolean(logto?.endpoint && logto?.m2mAppId && logto?.m2mAppSecret);
}

let apiClient: ReturnType<typeof createManagementApi>['apiClient'] | null = null;

function getApiClient(): ReturnType<typeof createManagementApi>['apiClient'] {
  if (!apiClient) {
    if (!isConfigured()) {
      throw new Error('未配置 Logto M2M（LOGTO_ENDPOINT + LOGTO_M2M_APP_ID + LOGTO_M2M_APP_SECRET）');
    }
    const { endpoint, m2mAppId, m2mAppSecret } = config.logto;
    const { apiClient: client } = createManagementApi('default', {
      clientId: m2mAppId,
      clientSecret: m2mAppSecret,
      baseUrl: endpoint,
      apiIndicator: `${endpoint}/api`,
    });
    apiClient = client;
  }
  return apiClient;
}

/** 应用在 Logto customData 中的偏好 key（与前端约定） */
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

/**
 * 获取用户在 Logto 的 customData（用于偏好等）
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
      return {
        ok: false,
        error: (res.error as { message?: string })?.message || res.response?.statusText || '更新 customData 失败',
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
