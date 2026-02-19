/**
 * 会话存储：内存 Map 或 Redis，与 middleware 对齐；重启后认证持久化需 SESSION_STORE=redis + REDIS_URL
 * 见 docs/SESSION_PERSISTENCE.md
 */
import { config } from '../config.js';
import type { Redis } from 'ioredis';
import { createRedisClient } from '../lib/redisClient.js';

export const COOKIE_NAME = 'auth_session';
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 天
const REDIS_KEY_PREFIX = 'sess:';

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
  matrixUserId?: string;
  matrixAccessToken?: string;
  matrixDeviceId?: string;
  matrixTokenExpiresAt?: number;
}

export interface Session extends SessionData {
  sessionId: string;
}

interface ISessionStore {
  get(id: string): Promise<SessionData | null>;
  set(id: string, data: SessionData, ttlMs: number): Promise<void>;
  delete(id: string): Promise<void>;
}

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

function isRedisUnavailable(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.message?.includes('max retries')) return true;
    const code = (err as NodeJS.ErrnoException).code;
    return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
  }
  return false;
}

class RedisStore implements ISessionStore {
  private redis: Redis;
  private fallback: MemoryStore | null = null;
  private fallbackLogged = false;

  constructor(url: string) {
    this.redis = createRedisClient(url);
  }

  private useFallback(reason: string): MemoryStore {
    if (!this.fallback) this.fallback = new MemoryStore();
    if (!this.fallbackLogged) {
      this.fallbackLogged = true;
      console.warn('[sessionStore] Redis 不可用，已降级为内存存储:', reason);
    }
    return this.fallback;
  }

  async get(id: string): Promise<SessionData | null> {
    if (this.fallback) return this.fallback.get(id);
    try {
      const raw = await this.redis.get(REDIS_KEY_PREFIX + id);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SessionData;
      } catch {
        return null;
      }
    } catch (err) {
      if (isRedisUnavailable(err)) {
        return this.useFallback(err instanceof Error ? err.message : String(err)).get(id);
      }
      throw err;
    }
  }

  async set(id: string, data: SessionData, ttlMs: number): Promise<void> {
    if (this.fallback) return this.fallback.set(id, data, ttlMs);
    try {
      const key = REDIS_KEY_PREFIX + id;
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await this.redis.setex(key, ttlSec, JSON.stringify(data));
    } catch (err) {
      if (isRedisUnavailable(err)) {
        return this.useFallback(err instanceof Error ? err.message : String(err)).set(id, data, ttlMs);
      }
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    if (this.fallback) return this.fallback.delete(id);
    try {
      await this.redis.del(REDIS_KEY_PREFIX + id);
    } catch (err) {
      if (isRedisUnavailable(err)) {
        return this.useFallback(err instanceof Error ? err.message : String(err)).delete(id);
      }
      throw err;
    }
  }
}

function createStore(): ISessionStore {
  if (config.sessionStore === 'redis' && config.redisUrl) {
    return new RedisStore(config.redisUrl);
  }
  return new MemoryStore();
}

const store: ISessionStore = createStore();

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

export async function saveSession(data: SessionData): Promise<Session> {
  const sessionId = generateId();
  const withExpiry = { ...data, expiresAt: data.expiresAt || Date.now() + SESSION_TTL_MS };
  await store.set(sessionId, withExpiry, SESSION_TTL_MS);
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
  const data = await store.get(sessionId);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    await store.delete(sessionId);
    return null;
  }
  return { sessionId, ...data };
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<SessionData, 'matrixUserId' | 'matrixAccessToken' | 'matrixDeviceId' | 'matrixTokenExpiresAt'>>
): Promise<void> {
  const data = await store.get(sessionId);
  if (!data) return;
  const merged = { ...data, ...patch };
  const ttlMs = Math.max(1000, merged.expiresAt - Date.now());
  await store.set(sessionId, merged, ttlMs);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await store.delete(sessionId);
}
