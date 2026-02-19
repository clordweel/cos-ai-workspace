/**
 * Logto 用户同步到 Matrix（在 api 内重新实现，不依赖 middleware）
 * 使用 Synapse Admin API PUT /_synapse/admin/v2/users/{user_id} 创建/更新用户
 */
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { getMatrixAccessToken } from '../adapters/matrixClient.js';
import { toMsisdnLocal } from '../utils/phoneFormat.js';

const ADMIN_PATH = '/_synapse/admin/v2/users';

function generateInitialPassword(): string {
  return randomBytes(24).toString('base64url');
}

/** Matrix localpart 允许的字符（简化：保留字母数字、点、下划线、减号），其余替换为下划线 */
export function toMatrixLocalpart(logtoSub: string): string {
  const sanitized = String(logtoSub)
    .replace(/[^a-zA-Z0-9._=-]/g, '_')
    .slice(0, 255);
  return sanitized || 'user';
}

/** 根据 Logto sub 或 username 得到 Matrix 完整 user_id（@localpart:serverName） */
export function getMatrixUserId(logtoSub: string, username?: string): string {
  const localpart = toMatrixLocalpart(username || logtoSub);
  return `@${localpart}:${config.matrix.serverName}`;
}

/**
 * 获取用于会话/API 的 Matrix user_id；有 username 时优先使用 username 作为 localpart
 */
export function getMatrixUserIdForSession(
  logtoSub: string | undefined,
  username: string | undefined,
  sessionMatrixUserId?: string
): string {
  const computed = getMatrixUserId(logtoSub || '', username);
  if (!sessionMatrixUserId) return computed;
  if (!logtoSub) return computed;
  if (username) {
    const cachedLocalpart = sessionMatrixUserId.includes(':')
      ? sessionMatrixUserId.slice(1).split(':')[0]
      : sessionMatrixUserId;
    if (cachedLocalpart !== toMatrixLocalpart(username)) {
      return computed;
    }
  }
  return sessionMatrixUserId;
}

export function isMatrixConfigured(): boolean {
  const { matrix } = config;
  return Boolean(
    matrix.baseUrl &&
    matrix.serverName &&
    (matrix.accessToken || (matrix.userId && matrix.password))
  );
}

/** 联系人项，与 middleware 及前端 Contact 一致 */
export interface SynapseContact {
  id: string;
  name: string;
  avatar?: string;
}

/**
 * 列出 Synapse 中未停用的用户，供 GET /api/contacts 使用。
 * Admin API GET /_synapse/admin/v2/users，排除 deactivated，分页至多 500 条。
 */
export async function listSynapseUsers(): Promise<
  { ok: true; contacts: SynapseContact[] } | { ok: false; error: string; statusCode?: number }
> {
  if (!isMatrixConfigured()) {
    return { ok: true, contacts: [] };
  }
  let token: string;
  try {
    token = await getMatrixAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Matrix 认证失败: ${msg}` };
  }
  const contacts: SynapseContact[] = [];
  const limit = 100;
  const maxTotal = 500;
  let from: string | number = 0;
  const baseUrl = config.matrix.baseUrl.replace(/\/$/, '');
  for (;;) {
    const url = `${baseUrl}${ADMIN_PATH}?from=${from}&limit=${limit}&deactivated=false`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json().catch(() => ({}))) as {
      users?: Array<{
        name?: string;
        displayname?: string | null;
        avatar_url?: string | null;
        deactivated?: number;
      }>;
      next_token?: string;
    };
    if (!res.ok) {
      const errMsg = (data as { error?: string }).error || res.statusText || 'Synapse 用户列表请求失败';
      return { ok: false, error: errMsg, statusCode: res.status };
    }
    const users = data.users ?? [];
    for (const u of users) {
      if (u.deactivated) continue;
      const mxid = u.name?.trim();
      if (!mxid) continue;
      const localpart = mxid.includes(':') ? mxid.slice(1).split(':')[0] : mxid;
      const displayName = u.displayname?.trim() || localpart;
      contacts.push({
        id: mxid,
        name: displayName,
        avatar: u.avatar_url ?? undefined,
      });
    }
    if (contacts.length >= maxTotal) break;
    const next = data.next_token;
    if (next === undefined || next === null || next === '') break;
    from = next;
  }
  return { ok: true, contacts };
}

export interface SyncMatrixUserResult {
  ok: true;
  matrixUserId: string;
  created: boolean;
}

export interface SyncMatrixUserError {
  ok: false;
  error: string;
  statusCode?: number;
}

export type SyncMatrixUserOutcome = SyncMatrixUserResult | SyncMatrixUserError;

/**
 * 确保 Logto 用户在 Matrix 中存在：不存在则创建，存在则更新 displayname/external_ids/threepids
 * 409 "External id is already in use" 时尝试解除占用者绑定再创建（简化版，无 MAS）
 */
export async function ensureMatrixUser(
  logtoSub: string,
  displayName?: string,
  email?: string,
  phone?: string,
  username?: string
): Promise<SyncMatrixUserOutcome> {
  if (!isMatrixConfigured()) {
    return { ok: false, error: 'Matrix 未配置' };
  }
  const localpart = toMatrixLocalpart(username || logtoSub);
  const matrixUserId = `@${localpart}:${config.matrix.serverName}`;
  let token: string;
  try {
    token = await getMatrixAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Matrix 认证失败: ${msg}` };
  }
  const threepids: Array<{ medium: string; address: string }> = [];
  if (email?.trim()) threepids.push({ medium: 'email', address: email.trim() });
  if (phone?.trim()) {
    const msisdn = toMsisdnLocal(phone);
    if (msisdn) threepids.push({ medium: 'msisdn', address: msisdn });
  }

  const buildBody = (targetLocalpart: string, includeExternalIds: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      displayname: displayName ?? targetLocalpart,
      ...(includeExternalIds && { external_ids: [{ auth_provider: 'oidc-logto', external_id: logtoSub }] }),
    };
    if (threepids.length) body.threepids = threepids;
    return body;
  };

  const url = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(matrixUserId)}`;
  let getRes = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  let isNewUser = getRes.status === 404;
  const getData = isNewUser
    ? null
    : (await getRes.json().catch(() => ({}))) as { deactivated?: boolean | number } | null;
  const synapseDeactivated = Boolean(getData?.deactivated);
  let isReactivating = synapseDeactivated;

  const doPut = async (userId: string, isNew: boolean, isReactivatingUser = false) => {
    const u = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(userId)}`;
    const body = buildBody(userId.split(':')[0]?.slice(1) || userId, true);
    if (isNew) (body as Record<string, unknown>).password = generateInitialPassword();
    if (isReactivatingUser) {
      (body as Record<string, unknown>).deactivated = false;
      (body as Record<string, unknown>).password = generateInitialPassword();
    }
    return fetch(u, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const res = await doPut(matrixUserId, isNewUser, isReactivating);
  const data = (await res.json().catch(() => ({}))) as { error?: string; errcode?: string };

  if (res.ok) {
    return { ok: true, matrixUserId, created: res.status === 201 };
  }

  if (res.status === 409 && /external\s*id\s*is\s*already\s*in\s*use/i.test(data.error || '')) {
    const oldLocalpart = toMatrixLocalpart(logtoSub);
    const oldUserId = `@${oldLocalpart}:${config.matrix.serverName}`;
    if (oldUserId !== matrixUserId) {
      const oldGet = await fetch(
        `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(oldUserId)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
      );
      if (oldGet.ok) {
        const unlinkBody = {
          displayname: displayName ?? oldLocalpart,
          external_ids: [] as Array<{ auth_provider: string; external_id: string }>,
          ...(threepids.length ? { threepids } : {}),
        };
        const unlinkRes = await fetch(
          `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(oldUserId)}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(unlinkBody),
          }
        );
        if (unlinkRes.ok) {
          const createBody = buildBody(localpart, true);
          (createBody as Record<string, unknown>).password = generateInitialPassword();
          const createRes = await fetch(
            `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(matrixUserId)}`,
            {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(createBody),
            }
          );
          if (createRes.ok) {
            return { ok: true, matrixUserId, created: true };
          }
        }
        const fallbackBody = buildBody(oldLocalpart, false);
        const fallbackRes = await fetch(
          `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(oldUserId)}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackBody),
          }
        );
        if (fallbackRes.ok) {
          return { ok: true, matrixUserId: oldUserId, created: false };
        }
      }
    }
  }

  const errMsg = data.error || res.statusText || 'Synapse Admin API 请求失败';
  return { ok: false, error: errMsg, statusCode: res.status };
}

/**
 * 使用 Admin API 直接设置 Matrix 用户密码
 */
export async function setMatrixPasswordByAdmin(
  matrixUserId: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!isMatrixConfigured()) {
    return { ok: false, error: 'Matrix 未配置' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: '密码至少 8 位', statusCode: 400 };
  }
  let token: string;
  try {
    token = await getMatrixAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Matrix 认证失败: ${msg}` };
  }
  const url = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(matrixUserId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword, logout_devices: false }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || res.statusText || '设置密码失败',
      statusCode: res.status,
    };
  }
  return { ok: true };
}
