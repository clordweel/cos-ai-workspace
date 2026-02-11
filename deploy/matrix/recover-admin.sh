#!/usr/bin/env bash
# 恢复被停用的 admin 用户（彻底注销误操作后）
# 在部署机 /root/matrix 执行；或通过 SSH：ssh root@10.1.1.15 "cd /root/matrix && ./recover-admin.sh"
#
# 用法：./recover-admin.sh [admin用户名] [新密码]
#  默认：admin 用户，密码随机生成并输出

set -e
cd "$(dirname "$0")"

USERNAME="${1:-admin}"
NEW_PASS="${2:-$(openssl rand -base64 16)}"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

MAS_URL="${MAS_BASE_URL:-http://localhost:8008}"
MAS_URL="${MAS_URL%/}"

if [ -z "$MAS_ADMIN_CLIENT_ID" ] || [ -z "$MAS_ADMIN_CLIENT_SECRET" ]; then
  echo "错误：请在 deploy/matrix/.env 中设置 MAS_ADMIN_CLIENT_ID 与 MAS_ADMIN_CLIENT_SECRET"
  echo "（bootstrap-mas.sh 会生成，见 .env 末尾）"
  exit 1
fi

echo "=== 恢复 admin 用户 (username=$USERNAME) ==="
echo ""

# 1. 获取 MAS admin token
echo "[1/4] 获取 MAS admin token..."
AUTH=$(echo -n "$MAS_ADMIN_CLIENT_ID:$MAS_ADMIN_CLIENT_SECRET" | base64 -w 0 2>/dev/null || base64)
TOKEN_RESP=$(curl -sS -X POST "$MAS_URL/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=urn:mas:admin" \
  -u "$MAS_ADMIN_CLIENT_ID:$MAS_ADMIN_CLIENT_SECRET")
ACCESS_TOKEN=$(echo "$TOKEN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "获取 token 失败: $TOKEN_RESP"
  exit 1
fi

# 2. 查找 admin 用户 ULID（含已停用）
echo "[2/4] 查找用户 $USERNAME ..."
USERS_RESP=$(curl -sS -g -H "Authorization: Bearer $ACCESS_TOKEN" \
  "${MAS_URL}/api/admin/v1/users?filter[username]=${USERNAME}&page[first]=10")
ULID=$(echo "$USERS_RESP" | python3 -c "
import sys, json
uname = sys.argv[1] if len(sys.argv) > 1 else ''
d = json.load(sys.stdin)
for u in d.get('data', []):
    if u.get('attributes', {}).get('username') == uname:
        print(u.get('id', ''))
        break
" "$USERNAME" 2>/dev/null)

if [ -z "$ULID" ]; then
  echo "未找到用户 $USERNAME。若需新建管理员，请使用 matrix-admin-create skill。"
  exit 1
fi

# 3. 重新激活
echo "[3/4] 重新激活用户..."
REACT_RES=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "$MAS_URL/api/admin/v1/users/$ULID/reactivate" -d '{}')
REACT_CODE=$(echo "$REACT_RES" | tail -1)
if [ "$REACT_CODE" != "200" ]; then
  echo "reactivate 失败 (HTTP $REACT_CODE): $(echo "$REACT_RES" | head -n -1)"
  exit 1
fi

# 4. 设置新密码（优先 mas-cli，失败时尝试 API）
echo "[4/4] 设置新密码..."
if docker compose -f docker-compose.yml -f docker-compose.mas.yml exec -T mas \
  mas-cli manage set-password "$USERNAME" "$NEW_PASS" 2>/dev/null; then
  :
elif curl -sS -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/vnd.api+json" \
  "$MAS_URL/api/admin/v1/users/$ULID/set-password" \
  -d "{\"password\":\"$NEW_PASS\",\"skip_password_check\":true}" | grep -qE '^(200|204)$'; then
  :
else
  echo "设置密码失败。用户已重新激活，请手动执行："
  echo "  docker compose -f docker-compose.yml -f docker-compose.mas.yml exec mas mas-cli manage set-password $USERNAME <新密码>"
  exit 1
fi

echo ""
echo "========== 恢复成功 =========="
echo "MXID: @${USERNAME}:${SYNAPSE_SERVER_NAME:-10.1.1.15}"
echo "新密码: $NEW_PASS"
echo ""
echo "登录 Synapse Admin (admin.etke.cc)："
echo "  - MAS 下「凭证」可能无用户名密码框，请用「Access Token」标签，执行 ./issue-admin-token.sh admin 获取 token 后粘贴登录"
echo "  - 或使用自托管 synapse-admin：用户名 $USERNAME，密码见上"
echo "若需写入工作区 .env："
echo "  MATRIX_USER_ID=@${USERNAME}:${SYNAPSE_SERVER_NAME:-10.1.1.15}"
echo "  MATRIX_PASSWORD=$NEW_PASS"
echo "=============================="
