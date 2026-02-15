/**
 * 物料相关：确认创建（调用 cos create_from_draft）；需认证
 */
import type { FastifyInstance } from 'fastify';
import { getSessionFromCookie } from '../services/auth.js';
import { createFromDraft } from '../services/cosClient.js';

export async function materialRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/material/confirm', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) {
      return reply.code(401).send({ error: '需要登录' });
    }
    const body = (req.body as { draft_id?: string; confirmed_by?: string }) || {};
    const { draft_id, confirmed_by } = body;
    if (!draft_id || !confirmed_by) {
      return reply.code(400).send({ error: 'draft_id and confirmed_by required' });
    }

    const result = await createFromDraft({ draft_id, confirmed_by }, session);

    if ('error' in result) {
      const status =
        result.statusCode ||
        (result.message && result.message.includes('未配置') ? 503 : 502);
      return reply.code(status).send({
        error: result.error,
        ...(result.message && { message: result.message }),
      });
    }

    return reply.send({
      item_code: result.item_code ?? null,
      item_name: result.item_name ?? null,
      name: result.name ?? null,
    });
  });
}
