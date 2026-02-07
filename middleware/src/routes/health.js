/**
 * 健康检查
 */
export async function healthRoutes(app) {
  app.get('/health', async () => ({ status: 'ok' }));
}
