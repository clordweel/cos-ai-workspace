#!/bin/bash
# 检查 Synapse admin 用户状态，用于「彻底注销」后排查无法登录 admin.etke.cc 的问题
# 用法：在项目根目录执行，会读取 .env 中的 MATRIX_BASE_URL、MATRIX_ACCESS_TOKEN 或 MATRIX_USER_ID+MATRIX_PASSWORD
#
# 若需指定变量可覆盖：
#   MATRIX_BASE_URL=https://matrix.etke.cc  MATRIX_ACCESS_TOKEN=xxx ./deploy/matrix/check-admin-user.sh

set -e
cd "$(dirname "$0")/../.."
# 加载 .env（若存在）
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

BASE="${MATRIX_BASE_URL:-http://10.1.1.15:8008}"
BASE="${BASE%/}"
SERVER_NAME="${MATRIX_SERVER_NAME:-$(echo "$BASE" | sed -E 's#^https?://([^:/]+).*#\1#')}"

# 获取 Admin API token
TOKEN=""
if [ -n "$MATRIX_ACCESS_TOKEN" ]; then
  TOKEN="$MATRIX_ACCESS_TOKEN"
elif [ -n "$MATRIX_USER_ID" ] && [ -n "$MATRIX_PASSWORD" ]; then
  echo "通过 login 获取 token..."
  LOGIN=$(curl -sS -X POST "$BASE/_matrix/client/r0/login" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"m.login.password\",\"user\":\"$MATRIX_USER_ID\",\"password\":\"$MATRIX_PASSWORD\"}")
  TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)
  if [ -z "$TOKEN" ]; then
    echo "登录失败，请检查 MATRIX_USER_ID 与 MATRIX_PASSWORD"
    echo "$LOGIN" | head -5
    exit 1
  fi
else
  echo "请在 .env 中配置 MATRIX_ACCESS_TOKEN 或 MATRIX_USER_ID+MATRIX_PASSWORD"
  exit 1
fi

echo "=== Synapse Base: $BASE | Server: $SERVER_NAME ==="
echo ""

# 1. 列出所有用户（含已停用）
echo "--- 本地用户列表（含已停用）---"
USERS=$(curl -sS -H "Authorization: Bearer $TOKEN" \
  "$BASE/_synapse/admin/v2/users?from=0&limit=50&deactivated=true")
echo "$USERS" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  users = d.get('users', [])
  for u in users:
    name = u.get('name', '')
    deact = u.get('deactivated', 0)
    erased = u.get('erased', False)
    admin = u.get('admin', 0)
    status = '停用' if deact else '活跃'
    adm = ' [admin]' if admin else ''
    print(f\"  {name}  {status}  erased={erased}{adm}\")
  if not users:
    print('  (无用户或 API 无权限)')
    err = d.get('errcode') or d.get('error')
    if err:
      print(f'  错误: {err}')
except Exception as e:
  print(f'  解析失败: {e}')
  print(sys.stdin.read()[:500])
"
echo ""

# 2. 检查常见 admin 用户名
for local in admin workbench synapse-admin; do
  UID="@${local}:${SERVER_NAME}"
  echo "--- 查询 $UID ---"
  ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$UID', safe=''))")
  INFO=$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
    "$BASE/_synapse/admin/v2/users/$ENCODED")
  BODY=$(echo "$INFO" | head -n -1)
  CODE=$(echo "$INFO" | tail -1)
  if [ "$CODE" = "200" ]; then
    echo "$BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  存在 | deactivated={d.get('deactivated')} | admin={d.get('admin')} | erased={d.get('erased')}\")
"
  elif [ "$CODE" = "404" ]; then
    echo "  不存在 (404)"
  else
    echo "  HTTP $CODE"
  fi
  echo ""
done

echo "=== admin.etke.cc 登录说明 ==="
echo "1. 打开 https://admin.etke.cc/"
echo "2. 选择「Access Token」标签（MAS 下「凭证」可能无用户名密码框）"
echo "3. Homeserver URL 填: $BASE"
echo "4. 执行 ./issue-admin-token.sh <admin_localpart> 获取 token 后粘贴登录"
echo ""
echo "若 admin 用户已停用："
echo "  - 需通过 Synapse Admin API 或 MAS Admin API 重新激活并设密"
echo "  - 或使用 matrix-admin-create 创建新管理员"
echo "  - 见 .cursor/skills/matrix-admin-create/SKILL.md"
