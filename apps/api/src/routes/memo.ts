/**
 * Memo（备忘录）路由：对接 Frappe/ERPNext ToDo 或 Memo DocType
 * 需登录；凭证优先使用 config.cos.apiKey（单 Key 试跑），否则按用户从 ConnectorCredentialsStore 取 erpnext。
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getSessionFromCookie, getStableUserId } from '../services/sessionStore.js';
import { getConnectorCredentialsStore } from '../services/connectorCredentialsStore.js';
import {
  isErpConfigured,
  listMemos,
  getMemo,
  createMemo,
  updateMemo,
  deleteMemo,
} from '../services/frappeClient.js';

/** 当前请求的 ERP Token：先 config，再按用户连接器 */
async function getErpTokenForSession(session: { logtoSub?: string }): Promise<string | undefined> {
  if (config.cos.apiKey) return config.cos.apiKey;
  if (session.logtoSub) {
    const cred = await getConnectorCredentialsStore().get(session.logtoSub, 'erpnext');
    return cred?.apiKey;
  }
  return undefined;
}

/** 统一将 Frappe 异常转为 HTTP 响应，避免泄露内部信息 */
function handleFrappeError(err: unknown, log: FastifyInstance['log'], logtoSub?: string): { statusCode: number; body: { error: string } } {
  const msg = err instanceof Error ? err.message : String(err);
  const exc = err && typeof err === 'object' && 'exc' in err ? String((err as { exc?: string }).exc) : '';
  if (logtoSub) log.info({ err: msg, exc, logtoSub }, 'Frappe 请求失败');
  else log.warn({ err: msg, exc }, 'Frappe 请求失败');
  if (msg.includes('403') || (exc && /forbidden|permission/i.test(exc)))
    return { statusCode: 403, body: { error: '无权限访问该资源' } };
  if (msg.includes('404') || (exc && /not found|does not exist/i.test(exc)))
    return { statusCode: 404, body: { error: '未找到该记录' } };
  if (msg.includes('401') || (exc && /unauthorized|invalid.*token|auth/i.test(exc)))
    return { statusCode: 401, body: { error: 'ERP 认证失败，请检查连接或 API Key' } };
  return { statusCode: 502, body: { error: '上游服务暂时不可用' } };
}

export async function memoRoutes(app: FastifyInstance): Promise<void> {
  if (!isErpConfigured()) {
    app.log.info('Memo 路由已注册但 ERP 未配置（COS_ERP_BASE/COS_ERP_API_KEY），相关请求将返回 503');
  }

  app.get('/api/memos', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    if (!isErpConfigured()) return reply.code(503).send({ error: 'ERP 未配置' });
    const token = await getErpTokenForSession(session);
    if (!token) return reply.code(503).send({ error: 'ERP 未配置或请先在授权管理中连接 ERPNext' });
    const logtoSub = session.logtoSub ?? getStableUserId(session);
    try {
      const list = await listMemos(config.cos.baseUrl, token);
      return reply.send({ memos: list });
    } catch (err) {
      const { statusCode, body } = handleFrappeError(err, req.log, logtoSub);
      return reply.code(statusCode).send(body);
    }
  });

  app.get('/api/memos/:id', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    if (!isErpConfigured()) return reply.code(503).send({ error: 'ERP 未配置' });
    const token = await getErpTokenForSession(session);
    if (!token) return reply.code(503).send({ error: 'ERP 未配置或请先在授权管理中连接 ERPNext' });
    const id = (req.params as { id: string }).id;
    if (!id) return reply.code(400).send({ error: '缺少 id' });
    const logtoSub = session.logtoSub ?? getStableUserId(session);
    try {
      const doc = await getMemo(config.cos.baseUrl, id, token);
      if (!doc) return reply.code(404).send({ error: '未找到该记录' });
      return reply.send(doc);
    } catch (err) {
      const { statusCode, body } = handleFrappeError(err, req.log, logtoSub);
      return reply.code(statusCode).send(body);
    }
  });

  app.post('/api/memos', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    if (!isErpConfigured()) return reply.code(503).send({ error: 'ERP 未配置' });
    const token = await getErpTokenForSession(session);
    if (!token) return reply.code(503).send({ error: 'ERP 未配置或请先在授权管理中连接 ERPNext' });
    const body = (req.body as Record<string, unknown>) || {};
    const logtoSub = session.logtoSub ?? getStableUserId(session);
    try {
      const doc = await createMemo(config.cos.baseUrl, {
        description: typeof body.description === 'string' ? body.description : '',
        status: typeof body.status === 'string' ? body.status : 'Open',
        priority: typeof body.priority === 'string' ? body.priority : undefined,
        assigned_to: typeof body.assigned_to === 'string' ? body.assigned_to : undefined,
      }, token);
      return reply.code(201).send(doc);
    } catch (err) {
      const { statusCode, body: errBody } = handleFrappeError(err, req.log, logtoSub);
      return reply.code(statusCode).send(errBody);
    }
  });

  app.patch('/api/memos/:id', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    if (!isErpConfigured()) return reply.code(503).send({ error: 'ERP 未配置' });
    const token = await getErpTokenForSession(session);
    if (!token) return reply.code(503).send({ error: 'ERP 未配置或请先在授权管理中连接 ERPNext' });
    const id = (req.params as { id: string }).id;
    if (!id) return reply.code(400).send({ error: '缺少 id' });
    const body = (req.body as Record<string, unknown>) || {};
    const logtoSub = session.logtoSub ?? getStableUserId(session);
    const value: Record<string, unknown> = {};
    if (body.description !== undefined) value.description = body.description;
    if (body.status !== undefined) value.status = body.status;
    if (body.priority !== undefined) value.priority = body.priority;
    if (body.assigned_to !== undefined) value.assigned_to = body.assigned_to;
    if (Object.keys(value).length === 0) return reply.code(400).send({ error: '请提供要更新的字段' });
    try {
      const doc = await updateMemo(config.cos.baseUrl, id, value, token);
      return reply.send(doc);
    } catch (err) {
      const { statusCode, body: errBody } = handleFrappeError(err, req.log, logtoSub);
      return reply.code(statusCode).send(errBody);
    }
  });

  app.delete('/api/memos/:id', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    if (!isErpConfigured()) return reply.code(503).send({ error: 'ERP 未配置' });
    const token = await getErpTokenForSession(session);
    if (!token) return reply.code(503).send({ error: 'ERP 未配置或请先在授权管理中连接 ERPNext' });
    const id = (req.params as { id: string }).id;
    if (!id) return reply.code(400).send({ error: '缺少 id' });
    const logtoSub = session.logtoSub ?? getStableUserId(session);
    try {
      await deleteMemo(config.cos.baseUrl, id, token);
      return reply.code(204).send();
    } catch (err) {
      const { statusCode, body } = handleFrappeError(err, req.log, logtoSub);
      return reply.code(statusCode).send(body);
    }
  });
}
