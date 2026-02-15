/**
 * 共享 Redis 客户端配置：重试次数、超时与重试间隔，避免连接不稳时过快触发 maxRetriesPerRequest
 */
import { Redis } from 'ioredis';

const CONNECT_TIMEOUT_MS = 10_000;
const MAX_RETRIES_PER_REQUEST = 5;

/**
 * 使用统一选项创建 Redis 客户端。会话/密码存储层在 Redis 不可用时会自动降级为内存存储，
 * 故此处采用较少重试次数以便尽快触发降级，避免长时间挂起或 500。
 */
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
