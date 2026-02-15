/**
 * 内存会话存储（阶段 1 最小集，与现 middleware Session 结构可对照）
 */
export const COOKIE_NAME = 'auth_session';
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

export interface UserProfile {
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface SessionData {
  type: 'logto';
  user: string;
  userProfile?: UserProfile;
  logtoSub?: string;
  logtoAccessToken?: string;
  logtoRefreshToken?: string;
  logtoTokenExpiresAt?: number;
  expiresAt: number;
}

export interface Session extends SessionData {
  sessionId: string;
}

const store = new Map<string, SessionData>();

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

export async function saveSession(data: SessionData): Promise<Session> {
  const sessionId = generateId();
  const withExpiry = { ...data, expiresAt: data.expiresAt || Date.now() + SESSION_TTL_MS };
  store.set(sessionId, withExpiry);
  return { sessionId, ...withExpiry };
}

export function getStableUserId(session: Session | null | undefined): string {
  if (!session) return '';
  return session.userProfile?.username ?? session.logtoSub ?? session.user ?? '';
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

const cookieNameEscaped = COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getSessionFromCookie(cookieHeader: string | undefined): Promise<Session | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(cookieNameEscaped + '=([^;]+)'));
  const sessionId = match?.[1]?.trim();
  if (!sessionId) return null;
  const data = store.get(sessionId);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    store.delete(sessionId);
    return null;
  }
  return { sessionId, ...data };
}
