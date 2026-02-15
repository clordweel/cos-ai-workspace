/**
 * 重构版 API 入口（参考原 middleware）
 * 阶段 0：仅健康检查；鉴权与 /api/* 在阶段 1 起实现。
 */
import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 工作区根目录 .env（apps/api 上溯两级）
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: rootEnv });

const port = Number(process.env.API_PORT) || Number(process.env.PORT) || 3002;

const fastify = Fastify({ logger: true });

fastify.get('/health', async () => ({ ok: true, service: '@ai-workbench/api' }));

try {
  await fastify.listen({ port, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
