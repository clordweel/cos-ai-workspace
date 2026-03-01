/**
 * 管理端路由：代理 Logto Management API（用户列表、角色列表、分配角色）。
 * 仅 isSystemAdmin 可访问（由 SYSTEM_ADMIN_EMAIL 与当前用户 email 比较）。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { getSessionFromCookie } from '../services/sessionStore.js';
import {
  isManagementApiConfigured,
  listUsers,
  listRoles,
  assignRoleToUsers,
  removeRoleFromUser,
} from '../services/logtoManagementApi.js';

function isSystemAdmin(session: { userProfile?: { email?: string }; user?: string } | null): boolean {
  if (!session) return false;
  const user = session.userProfile ?? { name: session.user };
  const userEmail = (user as { email?: string }).email;
  const adminEmail = config.systemAdminEmail;
  return Boolean(adminEmail && userEmail && userEmail.trim().toLowerCase() === adminEmail);
}

async function requireSystemAdmin(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const session = await getSessionFromCookie(req.headers.cookie);
  if (!session) {
    await reply.code(401).send({ ok: false, error: '未登录' });
    return false;
  }
  if (!isSystemAdmin(session)) {
    await reply.code(403).send({ ok: false, error: '仅系统管理员可访问' });
    return false;
  }
  return true;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/users', async (req, reply) => {
    if (!(await requireSystemAdmin(req, reply))) return;
    if (!isManagementApiConfigured()) {
      return reply.code(503).send({ ok: false, error: '未配置 Logto M2M（LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET）' });
    }
    const query = req.query as { page?: string; page_size?: string; search?: string };
    const page = query.page != null ? Number(query.page) : undefined;
    const page_size = query.page_size != null ? Number(query.page_size) : undefined;
    const result = await listUsers({
      page: Number.isFinite(page) ? page : undefined,
      page_size: Number.isFinite(page_size) ? page_size : undefined,
      search: typeof query.search === 'string' ? query.search : undefined,
    });
    if (!result.ok) {
      return reply.code(result.statusCode ?? 502).send({ ok: false, error: result.error });
    }
    return reply.send({ ok: true, data: result.data, totalCount: result.totalCount });
  });

  app.get('/api/admin/roles', async (req, reply) => {
    if (!(await requireSystemAdmin(req, reply))) return;
    if (!isManagementApiConfigured()) {
      return reply.code(503).send({ ok: false, error: '未配置 Logto M2M（LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET）' });
    }
    const result = await listRoles();
    if (!result.ok) {
      return reply.code(result.statusCode ?? 502).send({ ok: false, error: result.error });
    }
    return reply.send({ ok: true, data: result.data });
  });

  app.post<{ Params: { id: string }; Body: { userIds?: string[] } }>(
    '/api/admin/roles/:id/users',
    async (req, reply) => {
      if (!(await requireSystemAdmin(req, reply))) return;
      if (!isManagementApiConfigured()) {
        return reply.code(503).send({ ok: false, error: '未配置 Logto M2M' });
      }
      const roleId = req.params.id;
      const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
      const result = await assignRoleToUsers(roleId, userIds);
      if (!result.ok) {
        return reply.code(result.statusCode ?? 502).send({ ok: false, error: result.error });
      }
      return reply.code(201).send({ ok: true });
    }
  );

  app.delete<{ Params: { id: string; userId: string } }>(
    '/api/admin/roles/:id/users/:userId',
    async (req, reply) => {
      if (!(await requireSystemAdmin(req, reply))) return;
      if (!isManagementApiConfigured()) {
        return reply.code(503).send({ ok: false, error: '未配置 Logto M2M' });
      }
      const result = await removeRoleFromUser(req.params.id, req.params.userId);
      if (!result.ok) {
        return reply.code(result.statusCode ?? 502).send({ ok: false, error: result.error });
      }
      return reply.send({ ok: true });
    }
  );
}
