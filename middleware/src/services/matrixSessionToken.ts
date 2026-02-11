/**
 * Logto 登录后自动为会话获取 Matrix token（无需用户再输入 Matrix 密码）
 * 优先使用已缓存的 Matrix 密码（用户通过「设置 Matrix 密码」设置），若无则通过 Admin API 设随机密码并登录
 */
import { randomBytes } from 'node:crypto';
import { getMatrixUserId, setMatrixPasswordByAdmin, ensureMatrixUser } from './matrixUserSync.js';
import { getStoredMatrixPassword, setStoredMatrixPassword, deleteStoredMatrixPassword } from './matrixPasswordStore.js';
import { loginAsUser } from '../adapters/matrixClient.js';
import { updateSession } from './auth/sessionStore.js';
import type { Session } from './auth/sessionStore.js';

const DEFAULT_EXPIRES_MS = 24 * 60 * 60 * 1000;
const LOG_TAG = '[matrixSessionToken]';

/**
 * 若当前会话无 matrixAccessToken 但有 logtoSub，则用 Admin 设随机密码并登录，将 token 写入 session
 * 若 Matrix 用户不存在（如同步未完成），会先 ensureMatrixUser 再重试
 * @returns 成功时返回 token 信息供 /me 填充 matrixSyncToken；已有 token 或失败时返回 null
 */
export async function ensureMatrixTokenForSession(
  session: Session
): Promise<{ access_token: string; expires_in_ms: number } | null> {
  if (session.matrixAccessToken || !session.logtoSub) return null;

  const matrixUserId = getMatrixUserId(session.logtoSub, session.userProfile?.username);
  const displayName = session.userProfile?.name ?? session.user;
  const email = session.userProfile?.email;
  const phone = session.userProfile?.phone;

  // 优先使用已缓存的密码（用户通过「设置 Matrix 密码」设置的），避免覆盖
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
      // 缓存密码无效（如 MXID 从 logtoSub 改为 username 后密码错配、或用户在 Element 修改过），清除并回退到 Admin 设随机密码
      console.warn(`${LOG_TAG} 缓存密码登录失败 (mxid=${matrixUserId})，清除缓存并回退到自动设密`);
      await deleteStoredMatrixPassword(session.logtoSub);
    }
  }

  // 无缓存：新建或首次获取 token，设随机密码
  let randomPassword = randomBytes(24).toString('base64');
  let setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);

  if (!setResult.ok && (setResult.statusCode === 404 || setResult.error?.includes('Not Found'))) {
    const ensureOut = await ensureMatrixUser(session.logtoSub, displayName, email, phone, session.userProfile?.username);
    if (!ensureOut.ok) {
      console.warn(`${LOG_TAG} ensureMatrixUser 失败 (logtoSub=${session.logtoSub}): ${ensureOut.error}`);
      return null;
    }
    randomPassword = randomBytes(24).toString('base64');
    setResult = await setMatrixPasswordByAdmin(matrixUserId, randomPassword);
  }

  if (!setResult.ok) {
    console.warn(`${LOG_TAG} setMatrixPasswordByAdmin 失败 (mxid=${matrixUserId}): ${setResult.error} status=${setResult.statusCode ?? ''}`);
    return null;
  }

  try {
    const loginResult = await loginAsUser(matrixUserId, randomPassword);
    const expiresInMs = loginResult.expires_in_ms ?? DEFAULT_EXPIRES_MS;
    await updateSession(session.sessionId, {
      matrixAccessToken: loginResult.access_token,
      matrixTokenExpiresAt: Date.now() + expiresInMs,
    });
    await setStoredMatrixPassword(session.logtoSub, randomPassword);
    return { access_token: loginResult.access_token, expires_in_ms: expiresInMs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`${LOG_TAG} loginAsUser 失败 (mxid=${matrixUserId}): ${msg}`);
    return null;
  }
}
