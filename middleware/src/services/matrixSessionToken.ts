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
import { getMasUserByUsername, createPersonalSession } from './masAdminApi.js';
import { loginAsUser } from '../adapters/matrixClient.js';
import { updateSession } from './auth/sessionStore.js';
import { config } from '../config.js';
import type { Session } from './auth/sessionStore.js';

const DEFAULT_EXPIRES_MS = 24 * 60 * 60 * 1000;
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
 * 若当前会话无 matrixAccessToken 但有 logtoSub，则获取 token 并写入 session
 * MAS 方案：通过 username 查 MAS 用户 ULID → 创建 Personal Session（已停用用户跳过）
 * 回退方案：缓存密码 → Admin 设密 + login（不存在则 ensureMatrixUser 创建）
 */
export async function ensureMatrixTokenForSession(
  session: Session
): Promise<{ access_token: string; expires_in_ms: number } | MatrixTokenError | null> {
  if (session.matrixAccessToken || !session.logtoSub) return null;

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
      await new Promise((r) => setTimeout(r, 500));
      masUser = await getMasUserByUsername(localpart);
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
        const expiresInMs = result.expires_in_ms ?? DEFAULT_EXPIRES_MS;
        await updateSession(session.sessionId, {
          matrixAccessToken: result.access_token,
          matrixTokenExpiresAt: Date.now() + expiresInMs,
        });
        return { access_token: result.access_token, expires_in_ms: expiresInMs };
      }
      console.warn(`${LOG_TAG} MAS createPersonalSession 失败 (localpart=${localpart})，回退到 Admin 设密`);
    }
  }

  // 2. 回退：缓存密码
  const storedPassword = await getStoredMatrixPassword(session.logtoSub);
  if (storedPassword) {
    try {
      const loginResult = await loginAsUser(matrixUserId, storedPassword);
      const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
      await updateSession(session.sessionId, {
        matrixAccessToken: loginResult.access_token,
        matrixTokenExpiresAt: Date.now() + expiresInMs,
      });
      return { access_token: loginResult.access_token, expires_in_ms: expiresInMs };
    } catch {
      console.warn(
        `${LOG_TAG} 缓存密码登录失败 (mxid=${matrixUserId})，清除缓存并回退到 Admin 设密`
      );
      await deleteStoredMatrixPassword(session.logtoSub);
    }
  }

  // 3. 回退：Admin 设随机密码 + login；用户不存在则 ensureMatrixUser 创建
  const displayNameVal = session.userProfile?.name ?? session.user;
  const email = session.userProfile?.email;
  const phone = session.userProfile?.phone;
  const username = session.userProfile?.username;

  let randomPassword = randomBytes(24).toString('base64');
  let setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);

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
    setResult = await setMatrixPasswordByAdmin(resolvedMatrixUserId, randomPassword);
  }

  if (!setResult.ok) {
    console.warn(
      `${LOG_TAG} setMatrixPasswordByAdmin 失败 (mxid=${resolvedMatrixUserId}): ${setResult.error}`
    );
    return { error: 'token_failed', message: setResult.error };
  }

  try {
    const loginResult = await loginAsUser(resolvedMatrixUserId, randomPassword);
    const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
    await updateSession(session.sessionId, {
      matrixAccessToken: loginResult.access_token,
      matrixTokenExpiresAt: Date.now() + expiresInMs,
    });
    await setStoredMatrixPassword(session.logtoSub, randomPassword);
    return { access_token: loginResult.access_token, expires_in_ms: expiresInMs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`${LOG_TAG} loginAsUser 失败 (mxid=${resolvedMatrixUserId}): ${msg}`);
    return { error: 'token_failed', message: msg };
  }
}
