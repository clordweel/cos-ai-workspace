/**
 * AI 工作台中间层 - Fastify
 * - SSE 流式代理（Dify Chat API → 前端）
 * - 编排：Dify 意图 → cos / ERPNext API，写入前确认与权限校验
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import gracefulShutdown from 'http-graceful-shutdown';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { chatRoutes } from './routes/chat.js';
import { materialRoutes } from './routes/material.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

await app.register(healthRoutes);
await app.register(chatRoutes);
await app.register(materialRoutes);

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Middleware listening on http://0.0.0.0:${config.port}`);

gracefulShutdown(app.server, {
  signals: 'SIGINT SIGTERM SIGHUP',
  timeout: config.shutdownTimeoutMs,
  development: process.env.NODE_ENV === 'development',
  forceExit: true,
  onShutdown: async () => {
    await app.close();
  },
  finally: () => {
    app.log.info('Middleware shut down gracefully.');
  },
});
