/**
 * 本地验证：GET /health（无需认证）
 * 使用：cd apps/api && npx tsx scripts/local-health.ts
 * 环境变量：API_BASE_URL（默认 http://localhost:3000）
 */
const BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function main() {
  const res = await fetch(`${BASE}/health`);
  const data = await res.json().catch(() => ({}));
  console.log('GET /health', res.status, data);
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
