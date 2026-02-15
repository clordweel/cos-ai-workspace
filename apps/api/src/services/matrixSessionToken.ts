/**
 * Logto 登录后为会话获取 Matrix token（在 api 内重新实现，不依赖 middleware；无 MAS，仅 Admin 设密 + 密码缓存）
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
  loginAsUser,
  getMatrixUserIdFromToken,
  getMatrixAdminUserId,
  getMatrixWhoami,
} from '../adapters/matrixClient.js';
import { updateSession } from './sessionStore.js';
import { config } from '../config.js';
import type { Session } from './sessionStore.js';

const DEFAULT_EXPIRES_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export type MatrixTokenErrorReason =
  | 'user_not_synced'
  | 'user_deactivated'
  | 'token_failed';

export interface MatrixTokenError {
  error: MatrixTokenErrorReason;
  message?: string;
}

export type MatrixTokenResult =
  | { access_token: string; expires_in_ms: number; device_id?: string; matrix_user_id?: string }
  | MatrixTokenError
  | null;

/**
 * 若当前会话无 matrixAccessToken 或已/即将过期，则获取 token 并写入 session
 * 流程：1) 缓存密码登录 2) 否则 Admin 设随机密码 + login + 写回缓存
 */
export async function ensureMatrixTokenForSession(session: Session): Promise<MatrixTokenResult> {
  if (config.chat.provider !== 'matrix' || !config.matrix.baseUrl) return null;
  if (!session.logtoSub) return null;

  if (session.matrixAccessToken) {
    const expiresAt = session.matrixTokenExpiresAt;
    if (expiresAt != null && expiresAt >= Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
      return null;
    }
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

  const storedPassword = await getStoredMatrixPassword(session.logtoSub);
  if (storedPassword) {
    try {
      const loginResult = await loginAsUser(matrixUserId, storedPassword);
      const uid = await getMatrixUserIdFromToken(loginResult.access_token);
      const adminId = await getMatrixAdminUserId();
      if (uid && adminId && uid === adminId && matrixUserId !== adminId) {
        // skip: 缓存密码登录返回了 admin token
      } else {
        const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
        const whoami = await getMatrixWhoami(loginResult.access_token);
        await updateSession(session.sessionId, {
          matrixAccessToken: loginResult.access_token,
          matrixTokenExpiresAt: Date.now() + expiresInMs,
          matrixUserId: matrixUserId,
          ...(whoami.device_id ? { matrixDeviceId: whoami.device_id } : {}),
        });
        return {
          access_token: loginResult.access_token,
          expires_in_ms: expiresInMs,
          device_id: whoami.device_id ?? undefined,
          matrix_user_id: matrixUserId,
        };
      }
    } catch {
      await deleteStoredMatrixPassword(session.logtoSub);
    }
  }

  const displayNameVal = session.userProfile?.name ?? session.user;
  let randomPassword = randomBytes(24).toString('base64');
  let setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);
  let resolvedMatrixUserId = matrixUserId;

  if (!setResult.ok && (setResult.statusCode === 404 || setResult.error?.includes('Not Found'))) {
    const ensureOut = await ensureMatrixUser(
      session.logtoSub,
      displayNameVal,
      session.userProfile?.email,
      session.userProfile?.phone,
      session.userProfile?.username
    );
    if (!ensureOut.ok) {
      return { error: 'user_not_synced', message: ensureOut.error };
    }
    if (ensureOut.matrixUserId) {
      resolvedMatrixUserId = ensureOut.matrixUserId;
      await updateSession(session.sessionId, { matrixUserId: resolvedMatrixUserId });
    }
    randomPassword = randomBytes(24).toString('base64');
    setResult = await setMatrixPasswordByAdmin(resolvedMatrixUserId, randomPassword);
  }

  if (!setResult.ok) {
    return { error: 'token_failed', message: setResult.error };
  }

  const loginLocalpart =
    resolvedMatrixUserId.includes(':') ? resolvedMatrixUserId.slice(1).split(':')[0] : resolvedMatrixUserId;
  const identifiersToTry = resolvedMatrixUserId.includes(':')
    ? [resolvedMatrixUserId, loginLocalpart]
    : [resolvedMatrixUserId];

  let loginResult: { access_token: string; expires_in_ms?: number } | null = null;
  for (const id of identifiersToTry) {
    try {
      loginResult = await loginAsUser(id, randomPassword);
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (identifiersToTry.indexOf(id) < identifiersToTry.length - 1) continue;
      return { error: 'token_failed', message: msg };
    }
  }

  if (!loginResult) return { error: 'token_failed', message: 'login 失败' };

  const uid = await getMatrixUserIdFromToken(loginResult.access_token);
  const adminId = await getMatrixAdminUserId();
  if (uid && adminId && uid === adminId && resolvedMatrixUserId !== adminId) {
    return { error: 'token_failed', message: '获取的 token 为 admin，请检查 Matrix 配置' };
  }

  const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
  const whoami = await getMatrixWhoami(loginResult.access_token);
  await updateSession(session.sessionId, {
    matrixAccessToken: loginResult.access_token,
    matrixTokenExpiresAt: Date.now() + expiresInMs,
    matrixUserId: resolvedMatrixUserId,
    ...(whoami.device_id ? { matrixDeviceId: whoami.device_id } : {}),
  });
  await setStoredMatrixPassword(session.logtoSub, randomPassword);
  return {
    access_token: loginResult.access_token,
    expires_in_ms: expiresInMs,
    device_id: whoami.device_id ?? undefined,
    matrix_user_id: resolvedMatrixUserId,
  };
}
