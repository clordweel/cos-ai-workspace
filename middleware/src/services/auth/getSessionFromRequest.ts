/**
 * 从请求解析会话：优先 Authorization Bearer（Logto token 方案），否则 Cookie sessionId
 */
import { getSessionFromCookie } from './sessionStore.js';
import { getSessionFromBearerToken } from './logto.js';
import type { Session } from './sessionStore.js';

export interface RequestLike {
  headers: { cookie?: string; authorization?: string };
}

export async function getSessionFromRequest(req: RequestLike): Promise<Session | null> {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) {
      const session = await getSessionFromBearerToken(token);
      if (session) return session;
    }
  }
  return await getSessionFromCookie(req.headers.cookie);
}
