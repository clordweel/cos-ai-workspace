/**
 * Logto 登录后自动为会话获取 Matrix token
 * 优先使用 MAS Personal Session（配置 MAS_ADMIN_CLIENT_ID/SECRET 时），无密码、无需 Admin 设密
 * 否则回退到原方案：缓存密码 → Admin 设随机密码 + login
 */
import { randomBytes } from 'node:crypto';
import {
  getMatrixUserId,
  getMatrixUserIdForSession,
  ensureMatrixUser,
  setMatrixPasswordByAdmin,
} from './matrixUserSync.js';
import {
  getStoredMatrixPassword,
  setStoredMatrixPassword,
  deleteStoredMatrixPassword,
} from './matrixPasswordStore.js';
import {
  getMasUserByUsername,
  createPersonalSession,
  createMasUser,
  setMasUserPassword,
} from './masAdminApi.js';
import {
  loginAsUser,
  getMatrixUserIdFromToken,
  getMatrixAdminUserId,
  getMatrixWhoami,
} from '../adapters/matrixClient.js';
import { updateSession } from './auth/sessionStore.js';
import { config } from '../config.js';
import type { Session } from './auth/sessionStore.js';

const DEFAULT_EXPIRES_MS = 24 * 60 * 60 * 1000;
/** Token 过期前多少毫秒即视为即将过期并主动刷新，避免 401 */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 分钟
const LOG_TAG = '[matrixSessionToken]';

function isMasPreferred(): boolean {
  return Boolean(
    config.mas.clientId &&
      config.mas.clientSecret &&
      config.chat.provider === 'matrix'
  );
}

/** 获取 token 失败时的错误原因 */
export type MatrixTokenErrorReason =
  | 'user_not_synced'   // 用户未同步到 Matrix，ensureMatrixUser 失败
  | 'user_deactivated'  // 用户在 Matrix 已停用
  | 'token_failed';     // 其他（登录失败、MAS 不可用等）

export interface MatrixTokenError {
  error: MatrixTokenErrorReason;
  message?: string;
}

/**
 * 若当前会话无 matrixAccessToken 或有 token 但已/即将过期，则获取 token 并写入 session
 * 即将过期：matrixTokenExpiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS 时清空并重新获取，避免 401
 * MAS 方案：通过 username 查 MAS 用户 ULID → 创建 Personal Session（已停用用户跳过）
 * 回退方案：缓存密码 → Admin 设密 + login（不存在则 ensureMatrixUser 创建）
 */
export type MatrixTokenResult =
  | { access_token: string; expires_in_ms: number; device_id?: string }
  | MatrixTokenError
  | null;

export async function ensureMatrixTokenForSession(
  session: Session
): Promise<MatrixTokenResult> {
  if (!session.logtoSub) return null;

  if (session.matrixAccessToken) {
    const expiresAt = session.matrixTokenExpiresAt;
    if (expiresAt != null && expiresAt >= Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
      return null; // 未过期且有余量，无需刷新
    }
    // 已过期或即将过期：清空并重新获取
    await updateSession(session.sessionId, {
      matrixAccessToken: undefined,
      matrixTokenExpiresAt: undefined,
    });
    session.matrixAccessToken = undefined;
    session.matrixTokenExpiresAt = undefined;
  }

  const matrixUserId = getMatrixUserIdForSession(
    session.logtoSub,
    session.userProfile?.username,
    session.matrixUserId
  );
  const localpart = matrixUserId.includes(':') ? matrixUserId.slice(1).split(':')[0] : matrixUserId;
  const displayName = session.userProfile?.name ?? session.user;

  // 1. 优先：MAS Personal Session（无密码）；MAS 中不存在则先 ensureMatrixUser 再重试
  if (isMasPreferred()) {
    let masUser = await getMasUserByUsername(localpart);
    if (masUser === null) {
      const ensureOut = await ensureMatrixUser(
        session.logtoSub,
        session.userProfile?.name ?? session.user,
        session.userProfile?.email,
        session.userProfile?.phone,
        session.userProfile?.username
      );
      if (!ensureOut.ok) {
        console.warn(`${LOG_TAG} ensureMatrixUser 失败 (localpart=${localpart}): ${ensureOut.error}`);
        return { error: 'user_not_synced', message: ensureOut.error };
      }
      if (ensureOut.matrixUserId) {
        const computed = getMatrixUserId(session.logtoSub, session.userProfile?.username);
        if (ensureOut.matrixUserId !== computed) {
          await updateSession(session.sessionId, { matrixUserId: ensureOut.matrixUserId });
        }
      }
      await new Promise((r) => setTimeout(r, 800));
      masUser = await getMasUserByUsername(localpart);
      if (masUser === null) {
        const created = await createMasUser(localpart);
        if (created) {
          console.info(`${LOG_TAG} MAS 补建用户 (localpart=${localpart})`);
          await new Promise((r) => setTimeout(r, 600));
          masUser = await getMasUserByUsername(localpart);
        }
      }
    }
    if (masUser === null) {
      console.warn(`${LOG_TAG} MAS 用户仍不存在 (localpart=${localpart})，回退到 Admin 设密`);
    } else if (typeof masUser === 'object' && masUser.deactivated) {
      return { error: 'user_deactivated' };
    } else if (typeof masUser === 'string') {
      const result = await createPersonalSession(
        masUser,
        `workspace-${displayName || localpart}`
      );
      if (result) {
        const uid = await getMatrixUserIdFromToken(result.access_token);
        const adminId = await getMatrixAdminUserId();
        if (uid && adminId && uid === adminId && matrixUserId !== adminId) {
          console.warn(
            `${LOG_TAG} MAS createPersonalSession 返回 admin token 但当前用户非 admin，跳过 (localpart=${localpart})`
          );
        } else {
          const expiresInMs = result.expires_in_ms ?? DEFAULT_EXPIRES_MS;
          const whoami = await getMatrixWhoami(result.access_token);
          await updateSession(session.sessionId, {
            matrixAccessToken: result.access_token,
            matrixTokenExpiresAt: Date.now() + expiresInMs,
            ...(whoami.device_id ? { matrixDeviceId: whoami.device_id } : {}),
          });
          return {
            access_token: result.access_token,
            expires_in_ms: expiresInMs,
            device_id: whoami.device_id ?? undefined,
          };
        }
      }
      console.warn(`${LOG_TAG} MAS createPersonalSession 失败 (localpart=${localpart})，回退到 Admin 设密`);
    }
  }

  // 2. 回退：缓存密码
  const storedPassword = await getStoredMatrixPassword(session.logtoSub);
  if (storedPassword) {
    try {
      const loginResult = await loginAsUser(matrixUserId, storedPassword);
      const uid = await getMatrixUserIdFromToken(loginResult.access_token);
      const adminId = await getMatrixAdminUserId();
      if (uid && adminId && uid === adminId && matrixUserId !== adminId) {
        console.warn(`${LOG_TAG} 缓存密码登录返回 admin token 但当前用户非 admin，跳过`);
      } else {
        const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
        const whoami = await getMatrixWhoami(loginResult.access_token);
        await updateSession(session.sessionId, {
          matrixAccessToken: loginResult.access_token,
          matrixTokenExpiresAt: Date.now() + expiresInMs,
          ...(whoami.device_id ? { matrixDeviceId: whoami.device_id } : {}),
        });
        return {
          access_token: loginResult.access_token,
          expires_in_ms: expiresInMs,
          device_id: whoami.device_id ?? undefined,
        };
      }
    } catch {
      console.warn(
        `${LOG_TAG} 缓存密码登录失败 (mxid=${matrixUserId})，清除缓存并回退到 Admin 设密`
      );
      await deleteStoredMatrixPassword(session.logtoSub);
    }
  }

  // 3. 回退：Admin 设随机密码 + login；用户不存在则 ensureMatrixUser 创建
  // 可选 MAS：login 被转发到 MAS 时需确保用户已存在于 MAS
  if (isMasPreferred()) {
    const masCheck = await getMasUserByUsername(localpart);
    if (masCheck === null) {
      const created = await createMasUser(localpart);
      if (created) {
        console.info(`${LOG_TAG} Admin 设密前 MAS 补建用户 (localpart=${localpart})`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  const displayNameVal = session.userProfile?.name ?? session.user;
  const email = session.userProfile?.email;
  const phone = session.userProfile?.phone;
  const username = session.userProfile?.username;

  let randomPassword = randomBytes(24).toString('base64');
  let setResult: { ok: boolean; error?: string; statusCode?: number };

  if (isMasPreferred()) {
    const masUserForPwd = await getMasUserByUsername(localpart);
    if (masUserForPwd && typeof masUserForPwd === 'string') {
      setResult = await setMasUserPassword(localpart, randomPassword, masUserForPwd);
      if (!setResult.ok) {
        console.warn(`${LOG_TAG} MAS 设密失败，回退 Synapse Admin: ${setResult.error}`);
        setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);
      } else {
        console.info(`${LOG_TAG} MAS 设密成功 (localpart=${localpart})`);
        // MAS 设密后可能有短暂传播延迟（参考 Element/Cinny），等待后再 login
        await new Promise((r) => setTimeout(r, 600));
      }
    } else {
      console.warn(
        `${LOG_TAG} MAS 无用户 (localpart=${localpart})，使用 Synapse Admin 设密（login 若被代理到 MAS 可能失败）`
      );
      setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);
    }
  } else {
    setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);
  }

  let resolvedMatrixUserId = matrixUserId;
  if (!setResult.ok && (setResult.statusCode === 404 || setResult.error?.includes('Not Found'))) {
    const ensureOut = await ensureMatrixUser(
      session.logtoSub,
      displayNameVal,
      email,
      phone,
      username
    );
    if (!ensureOut.ok) {
      console.warn(`${LOG_TAG} ensureMatrixUser 失败 (logtoSub=${session.logtoSub}): ${ensureOut.error}`);
      return { error: 'user_not_synced', message: ensureOut.error };
    }
    if (ensureOut.matrixUserId) {
      resolvedMatrixUserId = ensureOut.matrixUserId;
      const computed = getMatrixUserId(session.logtoSub, username);
      if (resolvedMatrixUserId !== computed) {
        await updateSession(session.sessionId, { matrixUserId: resolvedMatrixUserId });
      }
    }
    randomPassword = randomBytes(24).toString('base64');
    const retryLocalpart = resolvedMatrixUserId.includes(':')
      ? resolvedMatrixUserId.slice(1).split(':')[0]
      : resolvedMatrixUserId;
    if (isMasPreferred()) {
      let masRetry = await getMasUserByUsername(retryLocalpart);
      if (masRetry === null) {
        const created = await createMasUser(retryLocalpart);
        if (created) {
          console.info(`${LOG_TAG} 404 重试路径 MAS 补建用户 (localpart=${retryLocalpart})`);
          await new Promise((r) => setTimeout(r, 500));
          masRetry = await getMasUserByUsername(retryLocalpart);
        }
      }
      if (masRetry && typeof masRetry === 'string') {
        setResult = await setMasUserPassword(retryLocalpart, randomPassword, masRetry);
      } else {
        setResult = await setMatrixPasswordByAdmin(resolvedMatrixUserId, randomPassword);
      }
    } else {
      setResult = await setMatrixPasswordByAdmin(resolvedMatrixUserId, randomPassword);
    }
  }

  if (!setResult.ok) {
    console.warn(
      `${LOG_TAG} setMatrixPasswordByAdmin 失败 (mxid=${resolvedMatrixUserId}): ${setResult.error}`
    );
    return { error: 'token_failed', message: setResult.error };
  }

  const loginLocalpart =
    resolvedMatrixUserId.includes(':') ? resolvedMatrixUserId.slice(1).split(':')[0] : resolvedMatrixUserId;

  const tryLogin = async (identifier: string): Promise<ReturnType<typeof loginAsUser>> => {
    return loginAsUser(identifier, randomPassword);
  };

  let loginResult: { access_token: string; expires_in_ms?: number } | null = null;
  const identifiersToTry =
    resolvedMatrixUserId.includes(':')
      ? [resolvedMatrixUserId, loginLocalpart]
      : [resolvedMatrixUserId];

  for (const id of identifiersToTry) {
    try {
      loginResult = await tryLogin(id);
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isInvalidCreds =
        /invalid|username|password|unauthorized/i.test(msg) || msg.includes('401');
      if (isInvalidCreds && identifiersToTry.indexOf(id) < identifiersToTry.length - 1) {
        console.info(`${LOG_TAG} login 失败 (identifier=${id})，尝试 localpart (${loginLocalpart})`);
      } else {
        console.warn(`${LOG_TAG} loginAsUser 失败 (identifier=${id}): ${msg}`);
        return { error: 'token_failed', message: msg };
      }
    }
  }

  if (loginResult) {
    const uid = await getMatrixUserIdFromToken(loginResult.access_token);
    const adminId = await getMatrixAdminUserId();
    if (uid && adminId && uid === adminId && resolvedMatrixUserId !== adminId) {
      console.warn(
        `${LOG_TAG} Admin 设密后 loginAsUser 返回 admin token 但当前用户非 admin，跳过 (mxid=${resolvedMatrixUserId})`
      );
      return { error: 'token_failed', message: '获取的 token 为 admin，请检查 Matrix 配置' };
    }
    const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
    const whoami = await getMatrixWhoami(loginResult.access_token);
    await updateSession(session.sessionId, {
      matrixAccessToken: loginResult.access_token,
      matrixTokenExpiresAt: Date.now() + expiresInMs,
      ...(whoami.device_id ? { matrixDeviceId: whoami.device_id } : {}),
    });
    await setStoredMatrixPassword(session.logtoSub, randomPassword);
    return {
      access_token: loginResult.access_token,
      expires_in_ms: expiresInMs,
      device_id: whoami.device_id ?? undefined,
    };
  }

  return { error: 'token_failed', message: 'loginAsUser 未返回结果' };
}
