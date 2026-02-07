/**
 * 系统诊断：供设置页调用，返回通过 Frappe SDK 获取的只读诊断数据
 */
import { runDiagnostics } from '../services/diagnostics.js';

export async function diagnosticsRoutes(app) {
  app.get('/api/diagnostics', async (req, reply) => {
    try {
      const result = await runDiagnostics();
      return reply.send(result);
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({
        ok: false,
        checks: [],
        error: e?.message || String(e),
      });
    }
  });
}
