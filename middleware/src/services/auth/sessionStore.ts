/**
 * 会话存储：内存 Map 或 Redis，Cookie 名与 TTL、会话 CRUD 与 Frappe 鉴权头
 * SESSION_STORE=redis 且 REDIS_URL 配置时使用 Redis，否则内存。见 docs/SESSION_PERSISTENCE.md
 */
import { config } from '../../config.js';
import { Redis } from 'ioredis';

const COOKIE_NAME = 'auth_session';
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 天
const REDIS_KEY_PREFIX = 'sess:';

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
  logtoAccessToken?: string;
  logtoRefreshToken?: string;
  logtoTokenExpiresAt?: number;
  expiresAt: number;
}

type SessionData = Omit<Session, 'sessionId'>;

interface ISessionStore {
  get(id: string): Promise<SessionData | null>;
  set(id: string, data: SessionData, ttlMs: number): Promise<void>;
  delete(id: string): Promise<void>;
}

/** 内存存储 */
class MemoryStore implements ISessionStore {
  private map = new Map<string, SessionData>();

  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, s] of this.map.entries()) {
        if (s.expiresAt < now) this.map.delete(id);
      }
    }, 60 * 60 * 1000);
  }

  async get(id: string): Promise<SessionData | null> {
    return this.map.get(id) ?? null;
  }

  async set(id: string, data: SessionData, _ttlMs: number): Promise<void> {
    this.map.set(id, data);
  }

  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

/** Redis 存储 */
class RedisStore implements ISessionStore {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }

  async get(id: string): Promise<SessionData | null> {
    const raw = await this.redis.get(REDIS_KEY_PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  async set(id: string, data: SessionData, ttlMs: number): Promise<void> {
    const key = REDIS_KEY_PREFIX + id;
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.redis.setex(key, ttlSec, JSON.stringify(data));
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(REDIS_KEY_PREFIX + id);
  }
}

function createStore(): ISessionStore {
  if (config.sessionStore === 'redis' && config.redisUrl) {
    return new RedisStore(config.redisUrl);
  }
  return new MemoryStore();
}

const store: ISessionStore = createStore();

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

/** 写入新会话并返回完整 Session */
export async function saveSession(data: SessionData): Promise<Session> {
  const sessionId = generateSessionId();
  await store.set(sessionId, data, SESSION_TTL_MS);
  return { sessionId, ...data };
}

export function getStableUserId(session: Session | null | undefined): string {
  if (!session) return 'default';
  return session.logtoSub ?? session.user;
}

/** 更新已有会话的部分字段 */
export async function updateSession(
  sessionId: string,
  updates: Partial<SessionData>,
): Promise<void> {
  const data = await store.get(sessionId);
  if (!data) return;
  const merged = { ...data, ...updates };
  const ttlMs = Math.max(1000, merged.expiresAt - Date.now());
  await store.set(sessionId, merged, ttlMs);
}

/** 从 cookie 中取 sessionId，返回会话信息（并做过期清理） */
export async function getSessionFromCookie(
  cookieHeader: string | undefined,
): Promise<Session | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const sessionId = match?.[1]?.trim();
  if (!sessionId) return null;
  const data = await store.get(sessionId);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    await store.delete(sessionId);
    return null;
  }
  return { sessionId, ...data };
}

export async function logoutSession(sessionId: string): Promise<void> {
  if (sessionId) await store.delete(sessionId);
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getFrappeAuthForSession(
  session: Session | null | undefined,
): Record<string, string> {
  if (!session) return {};
  if (session.frappeSid) return { Cookie: `sid=${session.frappeSid}` };
  if (session.frappeToken) {
    const token = session.frappeToken;
    const prefix = token.includes(':') ? 'token ' : 'Bearer ';
    return { Authorization: prefix + token };
  }
  return {};
}

export { SESSION_TTL_MS };
