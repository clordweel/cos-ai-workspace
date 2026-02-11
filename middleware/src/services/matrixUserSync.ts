/**
 * Logto 用户同步到 Matrix：Logto 认证成功后，在 Synapse 中创建/更新对应用户
 * 使用 Synapse Admin API PUT /_synapse/admin/v2/users/{user_id}
 * 新建用户会设置随机初始密码（不存储），用户可通过 Synapse 管理端重置或配置 OIDC 后用 Logto 登录 Matrix。
 */
import { config } from '../config.js';
import { getMatrixAccessToken } from '../adapters/matrixClient.js';
import { toE164 } from '../utils/phoneFormat.js';
import { randomBytes } from 'crypto';

const ADMIN_PATH = '/_synapse/admin/v2/users';

/** 生成随机初始密码（仅用于新建 Matrix 账号，不存储；建议用户后续在 Synapse/Element 重置或使用 OIDC） */
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

/** @deprecated 使用 getMatrixUserId(logtoSub, username) */
export function getMatrixUserIdForLogtoSub(logtoSub: string): string {
  return getMatrixUserId(logtoSub);
}

function isMatrixConfigured(): boolean {
  const { matrix } = config;
  return Boolean(
    matrix.baseUrl &&
    matrix.serverName &&
    (matrix.accessToken || (matrix.userId && matrix.password))
  );
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
 * 不阻塞调用方，失败时返回错误（由调用方决定是否忽略）
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
  const url = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(matrixUserId)}`;
  let token: string;
  try {
    token = await getMatrixAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Matrix 认证失败: ${msg}` };
  }
  const body: Record<string, unknown> = {
    displayname: displayName ?? localpart,
    external_ids: [{ auth_provider: 'oidc-logto', external_id: logtoSub }],
  };
  const threepids: Array<{ medium: string; address: string }> = [];
  if (email?.trim()) threepids.push({ medium: 'email', address: email.trim() });
  if (phone?.trim()) threepids.push({ medium: 'msisdn', address: toE164(phone) });
  if (threepids.length) body.threepids = threepids;
  // 先查询是否已存在，仅新建时设置随机密码（不存储）；更新时不再改密码
  const getRes = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const isNewUser = getRes.status === 404;
  if (isNewUser) {
    body.password = generateInitialPassword();
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; errcode?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || res.statusText || 'Synapse Admin API 请求失败',
      statusCode: res.status,
    };
  }
  return {
    ok: true,
    matrixUserId,
    created: res.status === 201,
  };
}

/**
 * 使用 Admin API 直接设置 Matrix 用户密码（无需当前密码）
 * 用于 Logto 用户「设置 Matrix 密码」：创建时随机密码用户不知晓，通过此接口设置后用户即知
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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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
