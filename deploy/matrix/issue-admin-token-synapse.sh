#!/usr/bin/env bash
# 方案 A：通过 Synapse 原生登录签发 admin token（MAS 禁用时使用）
# 用法：./issue-admin-token-synapse.sh [admin_password]
# 或在 deploy/matrix 目录执行，从 .env 读取 MATRIX_ADMIN_PASSWORD（若设置）

set -e
cd "$(dirname "$0")"

USER="${1:-admin}"
PASSWORD="${1:-${MATRIX_ADMIN_PASSWORD}}"
if [ -z "$PASSWORD" ]; then
  echo "用法: $0 <admin_password>"
  echo "或设置环境变量 MATRIX_ADMIN_PASSWORD"
  echo ""
  echo "若忘记 admin 密码，可在 10.1.1.15 上执行："
  echo "  docker compose -f docker-compose.yml -f docker-compose.no-mas.yml exec synapse hash_password"
  echo "  然后通过 Synapse Admin API 重置（需有合法 admin token 或 registration_shared_secret）"
  exit 1
fi

source .env 2>/dev/null || true
BASE="${MATRIX_BASE_URL:-http://localhost:8008}"
BASE="${BASE%/}"
MXID="@${USER}:${SYNAPSE_SERVER_NAME:-10.1.1.15}"

echo "正在向 Synapse 登录 ($BASE) ..."
RES=$(curl -sS -X POST "$BASE/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"m.login.password\",\"identifier\":{\"type\":\"m.id.user\",\"user\":\"$MXID\"},\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$RES" | grep -oE '"access_token"\s*:\s*"[^"]+"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "登录失败. 响应: $RES"
  exit 1
fi

echo ""
echo "========== 请将下面 token 写入工作区 .env =========="
echo "MATRIX_ACCESS_TOKEN=$TOKEN"
echo "# 并注释 MATRIX_USER_ID、MATRIX_PASSWORD"
echo "===================================================="
