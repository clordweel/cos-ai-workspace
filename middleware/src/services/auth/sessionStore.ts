/**
 * 会话存储：内存 Map、Cookie 名与 TTL、会话 CRUD 与 Frappe 鉴权头
 */
const COOKIE_NAME = 'auth_session';
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

/** 用户资料（Logto 等返回 name/email/avatar），供 /api/auth/me 返回给前端 */
export interface UserProfile {
  name: string;
  email?: string;
  avatar?: string;
}

export interface Session {
  sessionId: string;
  type: 'frappe' | 'token' | 'logto';
  user: string;
  userProfile?: UserProfile;
  frappeSid?: string;
  frappeToken?: string;
  logtoSub?: string;
  expiresAt: number;
}

type SessionStore = Map<string, Omit<Session, 'sessionId'>>;
const sessions: SessionStore = new Map();

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

/** 写入新会话并返回完整 Session（供 login 方法调用） */
export function saveSession(data: Omit<Session, 'sessionId'>): Session {
  const sessionId = generateSessionId();
  sessions.set(sessionId, data);
  return { sessionId, ...data };
}

/** 供会话等需要「按用户隔离」的逻辑使用 */
export function getStableUserId(session: Session | null | undefined): string {
  if (!session) return 'default';
  return session.logtoSub ?? session.user;
}

/** 从 cookie 中取 sessionId，返回会话信息（并做过期清理） */
export function getSessionFromCookie(cookieHeader: string | undefined): Session | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const sessionId = match?.[1]?.trim();
  if (!sessionId) return null;
  const data = sessions.get(sessionId);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { sessionId, ...data };
}

export function logoutSession(sessionId: string): void {
  if (sessionId) sessions.delete(sessionId);
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

/** 供 cosClient 等使用：根据会话获取请求 Frappe 时的 Authorization 或 Cookie */
export function getFrappeAuthForSession(session: Session | null | undefined): Record<string, string> {
  if (!session) return {};
  if (session.frappeSid) return { Cookie: `sid=${session.frappeSid}` };
  if (session.frappeToken) {
    const token = session.frappeToken;
    const prefix = token.includes(':') ? 'token ' : 'Bearer ';
    return { Authorization: prefix + token };
  }
  return {};
}

// 定时清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (s.expiresAt < now) sessions.delete(id);
  }
}, 60 * 60 * 1000);

export { SESSION_TTL_MS };
