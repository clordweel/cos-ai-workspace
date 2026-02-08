/**
 * AI 工作台中间层 - Fastify
 * - SSE 流式代理（Dify Chat API → 前端）
 * - 编排：Dify 意图 → cos / ERPNext API，写入前确认与权限校验
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import gracefulShutdown from 'http-graceful-shutdown';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { materialRoutes } from './routes/material.js';
import { diagnosticsRoutes } from './routes/diagnostics.js';

const isDev = process.env.NODE_ENV === 'development';
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  },
});
await app.register(cors, { origin: true, credentials: true });
await app.register(cookie, { parseOptions: {} });

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(chatRoutes);
await app.register(materialRoutes);
await app.register(diagnosticsRoutes);

await app.listen({
  port: config.port,
  host: '0.0.0.0',
  reuseAddress: true, // 终端断联等场景下端口可被快速复用，避免 TIME_WAIT 导致启动失败
});
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
