/**
 * 本地验证：GET /api/auth/me（需登录态 Cookie）
 *
 * 认证需求提示：
 * - 方式一：浏览器登录后，在 DevTools -> Application -> Cookies 中复制 auth_session 的值，
 *   执行：AUTH_SESSION_COOKIE="auth_session=复制的值" npx tsx scripts/local-auth-me.ts
 * - 方式二：设置完整 Cookie 字符串到环境变量 AUTH_SESSION_COOKIE，再运行本脚本。
 *
 * 使用：cd apps/api && npx tsx scripts/local-auth-me.ts
 * 环境变量：API_BASE_URL（默认 http://localhost:3000）、AUTH_SESSION_COOKIE（可选，见上）
 */
const BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const COOKIE = process.env.AUTH_SESSION_COOKIE?.trim();

async function main() {
  if (!COOKIE) {
    console.log('未设置 AUTH_SESSION_COOKIE，跳过请求，仅做需求提示：');
    console.log('  需登录后从浏览器复制 Cookie，或设置 AUTH_SESSION_COOKIE="auth_session=xxx"');
    process.exit(0);
    return;
  }

  const res = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: COOKIE },
  });
  const data = await res.json().catch(() => ({}));
  console.log('GET /api/auth/me', res.status, data);
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
