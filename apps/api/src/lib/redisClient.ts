/**
 * Redis 客户端（与 middleware 一致）：会话持久化用，Redis 不可用时 sessionStore 自动降级为内存
 */
import { Redis } from 'ioredis';

const CONNECT_TIMEOUT_MS = 10_000;
const MAX_RETRIES_PER_REQUEST = 5;

export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: MAX_RETRIES_PER_REQUEST,
    connectTimeout: CONNECT_TIMEOUT_MS,
    retryStrategy(times) {
      const delay = Math.min(times * 150, 1500);
      return delay;
    },
  });
}
