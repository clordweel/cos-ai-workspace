/**
 * Logto 用户同步到 Matrix：Logto 认证成功后，在 Synapse 中创建/更新对应用户
 * 使用 Synapse Admin API PUT /_synapse/admin/v2/users/{user_id}
 * 新建用户会设置随机初始密码（不存储），用户可通过 Synapse 管理端重置或配置 OIDC 后用 Logto 登录 Matrix。
 */
import { config } from '../config.js';
import { getMatrixAccessToken } from '../adapters/matrixClient.js';
import {
  activateMasUser,
  createMasUser,
  deactivateMasUser,
  getMasUserByUsername,
  setMasUserPassword,
} from './masAdminApi.js';
import { toMsisdnLocal } from '../utils/phoneFormat.js';
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

/**
 * 获取用于会话/API 的 Matrix user_id。
 * 有 username 时优先使用 username 作为 localpart（@username:server），不采用 logtoSub 衍生的 MXID；
 * 缓存的 session.matrixUserId 仅在其 localpart 与 username 一致时采纳，否则视为过期并废弃。
 */
export function getMatrixUserIdForSession(
  logtoSub: string | undefined,
  username: string | undefined,
  sessionMatrixUserId?: string
): string {
  const computed = getMatrixUserId(logtoSub || '', username);
  if (!sessionMatrixUserId) return computed;
  if (!logtoSub) return computed;
  // 有 username 时，仅当缓存的 localpart 与 username 一致才采纳，否则废弃旧映射
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

/** Matrix 是否已配置（baseUrl、serverName、Admin 认证），供 Logto 回调等判断是否同步用户 */
export function isMatrixConfigured(): boolean {
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
 * 若 409 "External id is already in use"（历史用户用 logtoSub 创建，现改用 username 导致 MXID 变化），
 * 改为更新已有用户（logtoSub 为 localpart）并返回其 MXID，调用方应存入 session.matrixUserId。
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
  // Matrix msisdn：使用国内号码（去除国家码），规范要求 address 不含前导 +
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

  const doPut = async (
    userId: string,
    isNew: boolean,
    isReactivating = false
  ) => {
    const u = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(userId)}`;
    const body = buildBody(userId.split(':')[0]?.slice(1) || userId, true);
    if (isNew) (body as Record<string, unknown>).password = generateInitialPassword();
    if (isReactivating) {
      (body as Record<string, unknown>).deactivated = false;
      // MAS 启用时 Synapse 禁止 Admin API 设密，仅通过 MAS set-password；此处不传 password 避免 403
      if (!config.mas?.clientId) {
        (body as Record<string, unknown>).password = generateInitialPassword();
      }
    }
    return fetch(u, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const url = `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(matrixUserId)}`;
  let getRes = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  let isNewUser = getRes.status === 404;
  const getData = isNewUser
    ? null
    : (await getRes.json().catch(() => ({}))) as { deactivated?: boolean | number } | null;
  const synapseDeactivated = Boolean(getData?.deactivated);
  const isMasConfigured = Boolean(config.mas?.clientId && config.mas?.clientSecret);
  const masUser = isMasConfigured ? await getMasUserByUsername(localpart) : null;
  let masHasUser = masUser !== null && typeof masUser === 'string';
  let isReactivating = false;

  // Logto 重新授权后激活已停用的 Matrix 账号（MAS reactivate + 设密 + Synapse deactivated: false），仅 MAS 启用时
  if (isMasConfigured && masUser && typeof masUser === 'object' && masUser.deactivated && masUser.ulid) {
    const actResult = await activateMasUser(masUser.ulid);
    if (!actResult.ok) {
      console.warn(
        `[matrixUserSync] MAS 激活失败 (localpart=${localpart}): ${actResult.error}`
      );
      return {
        ok: false,
        error: `激活失败: ${actResult.error}`,
        statusCode: actResult.statusCode,
      };
    }
    const newPass = generateInitialPassword();
    const pwdResult = await setMasUserPassword(localpart, newPass, masUser.ulid);
    if (!pwdResult.ok) {
      console.warn(
        `[matrixUserSync] 激活后设密失败 (localpart=${localpart}): ${pwdResult.error}`
      );
      // 已激活，继续执行；用户可能需在 Synapse Admin 手动设密
    }
    masHasUser = true;
    isReactivating = true;
    console.info(`[matrixUserSync] 已停用用户已激活 (localpart=${localpart}, Logto 重新授权)`);
  }
  if (synapseDeactivated && !isReactivating) {
    isReactivating = true;
    console.info(`[matrixUserSync] Synapse 用户已停用，将恢复 (localpart=${localpart})`);
    // 仅 Synapse 停用时，需通过 MAS 设密（Synapse 已抹掉密码；MAS 启用时 Admin API 禁止设密）
    if (config.mas?.clientId && masUser && typeof masUser === 'string') {
      const newPass = generateInitialPassword();
      const pwdResult = await setMasUserPassword(localpart, newPass, masUser);
      if (!pwdResult.ok) {
        console.warn(`[matrixUserSync] 恢复前 MAS 设密失败 (localpart=${localpart}): ${pwdResult.error}`);
      }
    }
  }

  if (isNewUser) {
    if (isMasConfigured && !masHasUser) {
      console.info(`[matrixUserSync] 新建用户 localpart=${localpart}，通过 MAS 创建`);
      const created = await createMasUser(localpart);
      if (created) {
        isNewUser = false;
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 300 * (i + 1)));
          getRes = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
          if (getRes.status === 200) {
            console.info(`[matrixUserSync] MAS provision 完成 (localpart=${localpart}, 重试${i + 1}次)`);
            break;
          }
        }
      } else {
        console.warn(`[matrixUserSync] createMasUser 未返回 ULID (localpart=${localpart})，回退 Synapse PUT`);
      }
    } else {
      isNewUser = false;
    }
  } else if (isMasConfigured && !masHasUser) {
    console.info(`[matrixUserSync] Synapse 已有用户但 MAS 无 (localpart=${localpart})，补建 MAS 用户`);
    const created = await createMasUser(localpart);
    if (created) {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        const recheck = await getMasUserByUsername(localpart);
        if (recheck && typeof recheck === 'string') break;
      }
    }
  }
  const res = await doPut(matrixUserId, isNewUser, isReactivating);
  const data = (await res.json().catch(() => ({}))) as { error?: string; errcode?: string };

  if (res.ok) {
    return { ok: true, matrixUserId, created: res.status === 201 };
  }

  // 409: external_id 已被另一用户占用（历史用户、或在 Synapse Admin 中删除/停用后残留）
  // 需找到占用者、解除绑定，再创建 @username。Synapse 停用用户不清理 external_ids，故可能残留
  if (res.status === 409 && /external\s*id\s*is\s*already\s*in\s*use/i.test(data.error || '')) {
    const tryUnlinkAndCreate = async (holderUserId: string): Promise<boolean> => {
      const holderLocalpart = holderUserId.includes(':') ? holderUserId.slice(1).split(':')[0] : holderUserId;
      const unlinkBody = {
        displayname: displayName ?? holderLocalpart,
        external_ids: [] as Array<{ auth_provider: string; external_id: string }>,
        ...(threepids.length ? { threepids } : {}),
      };
      const unlinkRes = await fetch(
        `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(holderUserId)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(unlinkBody),
        }
      );
      if (!unlinkRes.ok) return false;
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
        console.warn(
          `[matrixUserSync] ensureMatrixUser 409 迁移: ${holderUserId} -> ${matrixUserId}（external_id 已迁移）`
        );
        return true;
      }
      return false;
    };

    const oldLocalpart = toMatrixLocalpart(logtoSub);
    const oldUserId = `@${oldLocalpart}:${config.matrix.serverName}`;
    if (oldUserId !== matrixUserId) {
      const oldGet = await fetch(
        `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(oldUserId)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
      );
      if (oldGet.ok && (await tryUnlinkAndCreate(oldUserId))) {
        return { ok: true, matrixUserId, created: true };
      }
      if (oldGet.ok) {
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
          console.warn(
            `[matrixUserSync] ensureMatrixUser 409 回退: ${matrixUserId} -> ${oldUserId}（迁移失败）`
          );
          return { ok: true, matrixUserId: oldUserId, created: false };
        }
      }
    }

    // 旧用户已被删除（404）时，遍历用户列表查找占用 external_id 的账号
    const listUrl = `${config.matrix.baseUrl}${ADMIN_PATH}?from=0&limit=100&deactivated=true`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    const listData = (await listRes.json().catch(() => ({}))) as {
      users?: Array<{ name?: string }>;
      next_token?: string;
    };
    const userIds = listData.users?.map((u) => u.name).filter(Boolean) as string[] || [];
    for (const uid of userIds) {
      if (uid === matrixUserId) continue;
      const uRes = await fetch(
        `${config.matrix.baseUrl}${ADMIN_PATH}/${encodeURIComponent(uid)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
      );
      const uData = (await uRes.json().catch(() => ({}))) as {
        external_ids?: Array<{ auth_provider?: string; external_id?: string }>;
      };
      const hasOurs = uData.external_ids?.some(
        (e) => e.auth_provider === 'oidc-logto' && e.external_id === logtoSub
      );
      if (hasOurs && (await tryUnlinkAndCreate(uid))) {
        return { ok: true, matrixUserId, created: true };
      }
    }
  }

  const errMsg = data.error || res.statusText || 'Synapse Admin API 请求失败';
  const hint =
    res.status === 403 || data.errcode === 'M_FORBIDDEN'
      ? '（若已启用 MAS，admin 密码登录的 token 可能缺 Synapse admin 权限，请配置 MATRIX_ACCESS_TOKEN）'
      : '';
  console.warn(
    `[matrixUserSync] ensureMatrixUser 失败: ${matrixUserId} status=${res.status} err=${errMsg}${hint}`
  );
  return { ok: false, error: errMsg + hint, statusCode: res.status };
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
    const errMsg = data.error || res.statusText || '设置密码失败';
    // MAS 启用时 Synapse Admin API 会返回 "Password change disabled"，回退到 MAS Admin API
    if (res.status === 403 && errMsg.toLowerCase().includes('password change disabled')) {
      const localpart = matrixUserId.includes(':')
        ? matrixUserId.slice(1).split(':')[0]
        : matrixUserId;
      const masResult = await setMasUserPassword(localpart, newPassword);
      if (masResult.ok) return { ok: true };
      return {
        ok: false,
        error: masResult.error,
        statusCode: masResult.statusCode,
      };
    }
    return {
      ok: false,
      error: errMsg,
      statusCode: res.status,
    };
  }
  return { ok: true };
}

const DEACTIVATE_PATH = '/_synapse/admin/v1/deactivate';

/**
 * 彻底删除（注销）Matrix 账号：MAS deactivate + Synapse deactivate(erase)
 * 启用 MAS 时，必须通过 MAS Admin API 停用，MAS 会通知 Synapse 执行 deactivate 与 GDPR erase；
 * 否则 Synapse 仅会禁用，用户仍可在 MAS 侧存在。
 * @param matrixUserId 完整 MXID，如 @user:server
 */
export async function deactivateMatrixUser(
  matrixUserId: string
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  if (!isMatrixConfigured()) {
    return { ok: false, error: 'Matrix 未配置' };
  }
  const localpart =
    matrixUserId.includes(':') ? matrixUserId.slice(1).split(':')[0] : matrixUserId;

  // 1. 若已配置 MAS，优先通过 MAS 停用（MAS 会通知 Synapse 执行 deactivate + erase）
  const masUser = await getMasUserByUsername(localpart);
  if (masUser && typeof masUser === 'string') {
    const masResult = await deactivateMasUser(masUser);
    if (!masResult.ok) {
      console.warn(
        `[matrixUserSync] MAS 停用失败 (localpart=${localpart}): ${masResult.error}`
      );
      return masResult;
    }
    console.info(`[matrixUserSync] MAS 用户已停用 (localpart=${localpart})，继续 Synapse deactivate`);
  }
  // 若 MAS 无此用户或已停用，仍执行 Synapse deactivate（兼容非 MAS 用户或兜底）

  // 2. Synapse deactivate + erase（MAS 停用后 Synapse 通常已处理，此处兜底确保彻底）
  let token: string;
  try {
    token = await getMatrixAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Matrix 认证失败: ${msg}` };
  }
  const url = `${config.matrix.baseUrl}${DEACTIVATE_PATH}/${encodeURIComponent(matrixUserId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ erase: true }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const errMsg = data.error || res.statusText || '注销失败';
    return { ok: false, error: errMsg, statusCode: res.status };
  }
  return { ok: true };
}
