/** 可选 MAS：Admin API 客户端，配置 MAS_ADMIN_* 时用于签发用户 token 与设密回退。 */
import { config } from '../config.js';

const LOG_TAG = '[masAdminApi]';
const SCOPE_MATRIX = 'urn:matrix:org.matrix.msc2967.client:api:*';
const DEFAULT_EXPIRES_MS = 24 * 60 * 60 * 1000;

function isMasConfigured(): boolean {
  const { mas } = config;
  return Boolean(mas.baseUrl && mas.clientId && mas.clientSecret);
}

/** 获取 admin OAuth token（client_credentials） */
async function getAdminToken(): Promise<string> {
  const { mas } = config;
  const url = `${mas.baseUrl}/oauth2/token`;
  const auth = Buffer.from(`${mas.clientId}:${mas.clientSecret}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'urn:mas:admin',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `OAuth token 失败: ${res.status}`);
  }
  return data.access_token;
}

/**
 * 通过 MAS Admin API 创建用户（MAS 会 provision 到 Synapse）
 * @param username Matrix localpart
 * @returns MAS 用户 ULID 或 null
 */
export async function createMasUser(
  username: string
): Promise<string | null> {
  if (!isMasConfigured()) return null;
  try {
    const token = await getAdminToken();
    const url = `${config.mas.baseUrl}/api/admin/v1/users`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'user',
          attributes: { username },
        },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      data?: { id?: string };
      errors?: Array<{ title?: string }>;
    };
    if (!res.ok) {
      console.warn(
        `${LOG_TAG} createMasUser 失败 (username=${username}): ${data.errors?.[0]?.title || res.status} resp=${JSON.stringify(data).slice(0, 300)}`
      );
      return null;
    }
    return data.data?.id ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`${LOG_TAG} createMasUser 异常 (username=${username}): ${msg}`);
    return null;
  }
}

/** MAS 用户查询结果：ulid 字符串 | 已停用对象（含 ulid 供激活）| null */
export type MasUserResult = string | { deactivated: true; ulid: string } | null;

/** 通过 username 获取 MAS 用户：{ ulid } | { deactivated: true, ulid } | null。含已停用用户的回退查询 */
export async function getMasUserByUsername(
  username: string
): Promise<MasUserResult> {
  if (!isMasConfigured()) return null;
  const token = await getAdminToken();
  const fetchUser = async (statusFilter?: string) => {
    let u = `${config.mas.baseUrl}/api/admin/v1/users?filter[username]=${encodeURIComponent(username)}&page[first]=1`;
    if (statusFilter) u += `&filter[status]=${encodeURIComponent(statusFilter)}`;
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        id?: string;
        attributes?: { username?: string; deactivated_at?: string | null };
      }>;
      errors?: Array<{ title?: string }>;
    };
    if (!res.ok) {
      console.warn(`${LOG_TAG} getMasUserByUsername 失败: ${data.errors?.[0]?.title || res.status}`);
      return null;
    }
    return data.data?.[0] ?? null;
  };
  let first = await fetchUser();
  if (!first) {
    first = await fetchUser('deactivated') ?? null;
  }
  if (!first?.id) return null;
  if (first.attributes?.deactivated_at) {
    console.warn(`${LOG_TAG} MAS 用户已停用 (username=${username})`);
    return { deactivated: true, ulid: first.id };
  }
  return first.id;
}

/**
 * 通过 MAS Admin API 激活已停用用户（Logto 重新授权后恢复 Matrix 账号）
 * @param masUserUlid MAS 用户 ULID
 * @returns ok 或带 error/statusCode 的失败
 */
export async function activateMasUser(
  masUserUlid: string
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!isMasConfigured()) {
    return { ok: false, error: 'MAS 未配置' };
  }
  try {
    const token = await getAdminToken();
    const url = `${config.mas.baseUrl}/api/admin/v1/users/${masUserUlid}/reactivate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.api+json',
      },
      body: '{}',
    });
    const data = (await res.json().catch(() => ({}))) as { errors?: Array<{ title?: string }> };
    if (!res.ok) {
      const errTitle = data.errors?.[0]?.title || res.statusText;
      return {
        ok: false,
        error: errTitle,
        statusCode: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `MAS 激活失败: ${msg}` };
  }
}

/**
 * 通过 MAS Admin API 停用用户（MAS 会通知 Synapse 执行 deactivate 与 GDPR erase）
 * @param masUserUlid MAS 用户 ULID
 * @param options.skipErase 为 true 时跳过向 Synapse 请求 GDPR 擦除，默认 false
 * @returns ok 或带 error/statusCode 的失败
 */
export async function deactivateMasUser(
  masUserUlid: string,
  options?: { skipErase?: boolean }
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!isMasConfigured()) {
    return { ok: false, error: 'MAS 未配置' };
  }
  try {
    const token = await getAdminToken();
    const url = `${config.mas.baseUrl}/api/admin/v1/users/${masUserUlid}/deactivate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify(options?.skipErase === true ? { skip_erase: true } : {}),
    });
    const data = (await res.json().catch(() => ({}))) as { errors?: Array<{ title?: string }> };
    if (!res.ok) {
      const errTitle = data.errors?.[0]?.title || res.statusText;
      return {
        ok: false,
        error: errTitle,
        statusCode: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `MAS 停用失败: ${msg}` };
  }
}

/** 创建 Personal Session，返回 Matrix access_token */
export async function createPersonalSession(
  actorUserUlid: string,
  humanName?: string
): Promise<{ access_token: string; expires_in_ms?: number } | null> {
  if (!isMasConfigured()) return null;
  const token = await getAdminToken();
  const url = `${config.mas.baseUrl}/api/admin/v1/personal-sessions`;
  // MAS 要求扁平 JSON 请求体，human_name 必填
  const body = {
    actor_user_id: actorUserUlid,
    scope: SCOPE_MATRIX,
    human_name: humanName || 'Workspace',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: {
      id?: string;
      attributes?: { access_token?: string; expires_at?: string };
      meta?: { access_token?: string };
    };
    errors?: Array<{ title?: string }>;
  };
  if (!res.ok) {
    console.warn(
      `${LOG_TAG} createPersonalSession 失败: ${data.errors?.[0]?.title || res.status}`
    );
    return null;
  }
  const accessToken =
    data.data?.attributes?.access_token ?? data.data?.meta?.access_token ?? '';
  if (!accessToken) {
    console.warn(`${LOG_TAG} createPersonalSession 响应无 access_token`);
    return null;
  }
  const expiresAt = data.data?.attributes?.expires_at;
  const expiresInMs = expiresAt
    ? Math.max(0, new Date(expiresAt).getTime() - Date.now())
    : DEFAULT_EXPIRES_MS;
  return { access_token: accessToken, expires_in_ms: expiresInMs };
}

/**
 * 通过 MAS Admin API 设置用户密码（用于 Synapse Admin API 返回 "Password change disabled" 时的回退）
 * @param localpart Matrix localpart（MXID 的 @ 与 : 之间部分），对应 MAS username
 * @param newPassword 新密码，至少 8 位
 * @param knownUlid 已知 MAS 用户 ULID 时可直接传入（如刚激活后），避免再次查询
 * @returns ok 或带 error/statusCode 的失败
 */
export async function setMasUserPassword(
  localpart: string,
  newPassword: string,
  knownUlid?: string
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!isMasConfigured()) {
    return { ok: false, error: 'MAS 未配置' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: '密码至少 8 位', statusCode: 400 };
  }
  let ulid = knownUlid;
  if (!ulid) {
    const masUser = await getMasUserByUsername(localpart);
    if (masUser === null) {
      return { ok: false, error: `MAS 用户不存在 (username=${localpart})`, statusCode: 404 };
    }
    if (typeof masUser === 'object') {
      return { ok: false, error: 'MAS 用户已停用', statusCode: 403 };
    }
    ulid = masUser;
  }
  try {
    const token = await getAdminToken();
    const url = `${config.mas.baseUrl}/api/admin/v1/users/${ulid}/set-password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        password: newPassword,
        skip_password_check: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { errors?: Array<{ title?: string }> };
    if (!res.ok) {
      const errTitle = data.errors?.[0]?.title || res.statusText;
      return {
        ok: false,
        error: errTitle,
        statusCode: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `MAS 设密失败: ${msg}` };
  }
}
