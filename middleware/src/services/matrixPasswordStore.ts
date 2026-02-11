/**
 * Matrix 密码缓存：按 logtoSub 存储用户已设置的 Matrix 密码
 * 用于 ensureMatrixTokenForSession 时优先用已存密码登录，避免覆盖用户通过「设置 Matrix 密码」设置的密码
 * 当 SESSION_STORE=redis 时使用 Redis，否则内存 Map（服务重启后丢失）
 */
import { config } from '../config.js';
import { Redis } from 'ioredis';

const REDIS_KEY_PREFIX = 'matrix_pwd:';
const TTL_SEC = 90 * 24 * 60 * 60; // 90 天

interface IMatrixPasswordStore {
  get(logtoSub: string): Promise<string | null>;
  set(logtoSub: string, password: string): Promise<void>;
  delete(logtoSub: string): Promise<void>;
}

class MemoryMatrixPasswordStore implements IMatrixPasswordStore {
  private map = new Map<string, { password: string; expiresAt: number }>();

  async get(logtoSub: string): Promise<string | null> {
    const entry = this.map.get(logtoSub);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(logtoSub);
      return null;
    }
    return entry.password;
  }

  async set(logtoSub: string, password: string): Promise<void> {
    this.map.set(logtoSub, {
      password,
      expiresAt: Date.now() + TTL_SEC * 1000,
    });
  }

  async delete(logtoSub: string): Promise<void> {
    this.map.delete(logtoSub);
  }
}

class RedisMatrixPasswordStore implements IMatrixPasswordStore {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }

  async get(logtoSub: string): Promise<string | null> {
    return this.redis.get(REDIS_KEY_PREFIX + logtoSub);
  }

  async set(logtoSub: string, password: string): Promise<void> {
    await this.redis.setex(REDIS_KEY_PREFIX + logtoSub, TTL_SEC, password);
  }

  async delete(logtoSub: string): Promise<void> {
    await this.redis.del(REDIS_KEY_PREFIX + logtoSub);
  }
}

function createStore(): IMatrixPasswordStore {
  if (config.sessionStore === 'redis' && config.redisUrl) {
    return new RedisMatrixPasswordStore(config.redisUrl);
  }
  return new MemoryMatrixPasswordStore();
}

const store = createStore();

export async function getStoredMatrixPassword(logtoSub: string): Promise<string | null> {
  if (!logtoSub?.trim()) return null;
  return store.get(logtoSub.trim());
}

export async function setStoredMatrixPassword(logtoSub: string, password: string): Promise<void> {
  if (!logtoSub?.trim() || !password) return;
  await store.set(logtoSub.trim(), password);
}

export async function deleteStoredMatrixPassword(logtoSub: string): Promise<void> {
  if (!logtoSub?.trim()) return;
  await store.delete(logtoSub.trim());
}
