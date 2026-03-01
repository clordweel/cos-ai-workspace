/**
 * 重构版 API 入口（参考原 middleware）
 * 阶段 1：健康检查、Logto 回调、GET /api/auth/me。
 */
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { chatRoutes } from './routes/chat.js';
import { memoRoutes } from './routes/memo.js';
import { connectedServicesRoutes } from './routes/connectedServices.js';
import { ensureMatrixBot } from './services/matrixBotInit.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true, credentials: true });
await fastify.register(cookie);

fastify.get('/health', async () => ({ ok: true, service: '@cosai/api' }));
await fastify.register(authRoutes, { prefix: '/' });
await fastify.register(adminRoutes, { prefix: '/' });
await fastify.register(chatRoutes, { prefix: '/' });
await fastify.register(memoRoutes, { prefix: '/' });
await fastify.register(connectedServicesRoutes, { prefix: '/' });

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info({ port: config.port }, 'API listening');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

ensureMatrixBot().catch((err) => {
  fastify.log.warn({ err }, 'Matrix bot 自动初始化未完成（可忽略；若需 @ AI 助手 请配置 MATRIX_BOT_* 或见 docs/MATRIX_BOT_ACCOUNT.md）');
});
