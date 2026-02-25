/**
 * 认证授权管理：已连接服务列表、连接、断开
 * GET /api/connected-services、POST /api/connected-services/:provider/connect、DELETE /api/connected-services/:provider
 */
import type { FastifyInstance } from 'fastify';
import { getSessionFromCookie } from '../services/sessionStore.js';
import { getConnectorCredentialsStore, type ConnectorProvider } from '../services/connectorCredentialsStore.js';

const SUPPORTED_PROVIDERS: { id: ConnectorProvider; name: string }[] = [
  { id: 'erpnext', name: 'ERPNext' },
  { id: 'outline', name: 'Outline' },
];

function isSupportedProvider(id: string): id is ConnectorProvider {
  return SUPPORTED_PROVIDERS.some((p) => p.id === id);
}

export async function connectedServicesRoutes(app: FastifyInstance): Promise<void> {
  const store = getConnectorCredentialsStore();

  /** 列表：当前用户各服务的连接状态 */
  app.get('/api/connected-services', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    const logtoSub = session.logtoSub;
    if (!logtoSub) return reply.code(401).send({ error: '无 Logto 身份' });

    const providers = await Promise.all(
      SUPPORTED_PROVIDERS.map(async (p) => {
        const cred = await store.get(logtoSub, p.id);
        return { id: p.id, name: p.name, connected: Boolean(cred?.apiKey || cred?.apiSecret) };
      })
    );
    return reply.send({ providers });
  });

  /** 连接：写入该 provider 的凭证 */
  app.post('/api/connected-services/:provider/connect', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    const logtoSub = session.logtoSub;
    if (!logtoSub) return reply.code(401).send({ error: '无 Logto 身份' });

    const provider = (req.params as { provider: string }).provider;
    if (!isSupportedProvider(provider)) {
      return reply.code(400).send({ error: '不支持的服务' });
    }

    const body = (req.body as Record<string, unknown>) || {};
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const apiSecret = typeof body.apiSecret === 'string' ? body.apiSecret.trim() : '';
    if (!apiKey && !apiSecret) {
      return reply.code(400).send({ error: '请提供 apiKey 或 apiSecret' });
    }

    try {
      await store.set(logtoSub, provider, { apiKey: apiKey || undefined, apiSecret: apiSecret || undefined });
      return reply.send({ ok: true, provider, connected: true });
    } catch (e) {
      req.log.warn({ err: e, logtoSub, provider }, '连接服务失败');
      return reply.code(502).send({ error: '保存凭证失败，请稍后重试' });
    }
  });

  /** 断开：删除该 provider 的凭证 */
  app.delete('/api/connected-services/:provider', async (req, reply) => {
    const session = await getSessionFromCookie(req.headers.cookie);
    if (!session) return reply.code(401).send({ error: '未登录' });
    const logtoSub = session.logtoSub;
    if (!logtoSub) return reply.code(401).send({ error: '无 Logto 身份' });

    const provider = (req.params as { provider: string }).provider;
    if (!isSupportedProvider(provider)) {
      return reply.code(400).send({ error: '不支持的服务' });
    }

    try {
      await store.delete(logtoSub, provider);
      return reply.send({ ok: true, provider, connected: false });
    } catch (e) {
      req.log.warn({ err: e, logtoSub, provider }, '断开服务失败');
      return reply.code(502).send({ error: '操作失败，请稍后重试' });
    }
  });
}
