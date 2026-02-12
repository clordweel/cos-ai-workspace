/**
 * Matrix 密码缓存：按 logtoSub 存储用户已设置的 Matrix 密码
 * 用于 ensureMatrixTokenForSession 时优先用已存密码登录，避免覆盖用户通过「设置 Matrix 密码」设置的密码
 * 存储层：内存/Redis（快速）+ 可选 Logto customData（持久化，需 MATRIX_PASSWORD_ENCRYPTION_KEY + M2M）
 */
import { config } from '../config.js';
import { Redis } from 'ioredis';
import {
  isLogtoMatrixPasswordEnabled,
  getMatrixPasswordFromLogto,
  setMatrixPasswordToLogto,
  deleteMatrixPasswordFromLogto,
} from './matrixPasswordLogtoStore.js';

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
  const key = logtoSub.trim();
  let pwd = await store.get(key);
  if (!pwd && isLogtoMatrixPasswordEnabled()) {
    pwd = await getMatrixPasswordFromLogto(key);
    if (pwd) await store.set(key, pwd);
  }
  return pwd;
}

export async function setStoredMatrixPassword(logtoSub: string, password: string): Promise<void> {
  if (!logtoSub?.trim() || !password) return;
  const key = logtoSub.trim();
  await store.set(key, password);
  if (isLogtoMatrixPasswordEnabled()) {
    await setMatrixPasswordToLogto(key, password).catch((e) => {
      console.warn('[matrixPasswordStore] Logto 持久化失败:', e instanceof Error ? e.message : e);
    });
  }
}

export async function deleteStoredMatrixPassword(logtoSub: string): Promise<void> {
  if (!logtoSub?.trim()) return;
  const key = logtoSub.trim();
  await store.delete(key);
  if (isLogtoMatrixPasswordEnabled()) {
    await deleteMatrixPasswordFromLogto(key).catch((e) => {
      console.warn('[matrixPasswordStore] Logto 删除密码失败:', e instanceof Error ? e.message : e);
    });
  }
}
