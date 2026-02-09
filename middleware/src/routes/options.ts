/**
 * 可选列表：账套、Dify 应用，供前端选择器使用
 */
import type { FastifyInstance } from 'fastify';
import { config, getCosConfig } from '../config.js';

export async function optionsRoutes(app: FastifyInstance): Promise<void> {
  /** 可选账套列表：默认 + cosTenants，返回 id 与可选 name（当前用 id 作为 name） */
  app.get('/api/tenants', async (_req, reply) => {
    const list: Array<{ id: string; name: string }> = [];
    const defaultCos = getCosConfig(undefined);
    if (defaultCos) {
      list.push({ id: 'default', name: '默认账套' });
    }
    for (const [id] of config.cosTenants) {
      list.push({ id, name: id });
    }
    return reply.send({ tenants: list });
  });

  /** 可选 Dify 应用列表：默认 + difyApps，返回 id 与 name */
  app.get('/api/dify-apps', async (_req, reply) => {
    const list: Array<{ id: string; name: string }> = [];
    if (config.dify.apiBase && config.dify.apiKey) {
      list.push({ id: 'default', name: '默认应用' });
    }
    for (const [id] of config.difyApps) {
      list.push({ id, name: id });
    }
    return reply.send({ apps: list });
  });
}
