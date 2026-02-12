#!/usr/bin/env bash
# 在不知道当前 admin 密码时，通过数据库直接更新密码哈希
# 用法：在 10.1.1.15 的 /root/matrix 执行，或通过 SSH：
#   ssh root@10.1.1.15 "cd /root/matrix && ./reset-admin-password.sh"
# 输出新密码，请写入 .env 的 MATRIX_PASSWORD

set -e
cd "$(dirname "$0")"

ADMIN_USER="${1:-admin}"
SERVER_NAME="${SYNAPSE_SERVER_NAME:-10.1.1.15}"
MXID="@${ADMIN_USER}:${SERVER_NAME}"

# 加载 .env
[ -f .env ] && set -a && source .env && set +a

NEW_PASS="${2:-$(openssl rand -base64 16)}"

# 选择 compose 文件（no-mas 或默认）
COMPOSE_FILES="-f docker-compose.yml"
[ -f docker-compose.no-mas.yml ] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.no-mas.yml"

echo "=== 重置 $MXID 密码（通过数据库） ==="

# 1. 用 Synapse hash_password 生成 bcrypt 哈希（非交互：传入两次相同密码）
HASH=$(printf '%s\n%s\n' "$NEW_PASS" "$NEW_PASS" | docker compose $COMPOSE_FILES exec -T synapse hash_password -c /data/homeserver.yaml 2>/dev/null || true)

if [ -z "$HASH" ] || [[ ! "$HASH" =~ ^\$2[aby]\$ ]]; then
  echo "hash_password 失败，尝试 Python bcrypt..."
  HASH=$(docker compose $COMPOSE_FILES exec -T synapse python3 -c "
import bcrypt
p = '''$NEW_PASS'''.encode()
h = bcrypt.hashpw(p, bcrypt.gensalt(rounds=12))
print(h.decode())
" 2>/dev/null)
fi

if [ -z "$HASH" ] || [[ ! "$HASH" =~ ^\$2[aby]\$ ]]; then
  echo "无法生成密码哈希，请检查 Synapse 容器与依赖"
  exit 1
fi

# 2. 更新数据库（RETURNING 检查是否命中）
export PGPASSWORD="${POSTGRES_PASSWORD:?请设置 POSTGRES_PASSWORD}"
PG_USER="${POSTGRES_USER:-synapse}"
PG_DB="${POSTGRES_DB:-synapse}"

# 转义单引号：hash 中的 ' 需改为 ''
HASH_ESC="${HASH//\'/\'\'}"

AFFECTED=$(docker compose $COMPOSE_FILES exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tAc \
  "WITH upd AS (UPDATE users SET password_hash = '$HASH_ESC' WHERE name = '$MXID' RETURNING 1) SELECT COUNT(*) FROM upd;")

if [ "${AFFECTED:-0}" -eq 0 ]; then
  echo "用户 $MXID 不存在，请先创建（如 matrix-admin-create）"
  exit 1
fi

echo ""
echo "========== 密码已重置 =========="
echo "MXID: $MXID"
echo "新密码: $NEW_PASS"
echo ""
echo "请写入工作区 .env："
echo "  MATRIX_PASSWORD=$NEW_PASS"
echo "然后重启中间层"
echo "================================"
