/**
 * 重构版 API 入口（参考原 middleware）
 * 阶段 1：健康检查、Logto 回调、GET /api/auth/me。
 */
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true, credentials: true });
await fastify.register(cookie);

fastify.get('/health', async () => ({ ok: true, service: '@cosai/api' }));
await fastify.register(authRoutes, { prefix: '/' });

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info({ port: config.port }, 'API listening');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
