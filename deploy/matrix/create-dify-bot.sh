#!/usr/bin/env bash
# 在 Matrix 部署服务器上创建 Dify 所需的 AI 助手 bot 账号（普通用户，非 admin）
# 用法：在 deploy/matrix 目录执行 ./create-dify-bot.sh
# 建议：以 root 通过 SSH 登录部署机后，进入本目录执行（如 cd /root/matrix && ./create-dify-bot.sh）

set -e
cd "$(dirname "$0")"

BOT_USER="ai-assistant"
CONFIG_FILE="${CONFIG_FILE:-./data/homeserver.yaml}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "错误: 未找到 $CONFIG_FILE，请先在当前目录执行 ./bootstrap.sh"
  exit 1
fi

source .env 2>/dev/null || true
SERVER_NAME="${SYNAPSE_SERVER_NAME:?请设置 .env 中的 SYNAPSE_SERVER_NAME}"
BOT_MXID="@${BOT_USER}:${SERVER_NAME}"

# 选择 compose 命令（支持仅 Synapse 或 Synapse+MAS）
COMPOSE_FILES="-f docker-compose.yml"
if [ -f docker-compose.mas.yml ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.mas.yml"
fi
COMPOSE_CMD="docker compose $COMPOSE_FILES"

echo "将在 Synapse 上创建 bot 用户: $BOT_MXID"
echo ""

# 1. 生成临时共享密钥与 bot 密码
SHARED_SECRET=$(openssl rand -base64 32)
BOT_PASS=$(openssl rand -base64 16)

# 2. 临时启用 registration_shared_secret
if grep -q "registration_shared_secret" "$CONFIG_FILE"; then
  echo "错误: $CONFIG_FILE 中已存在 registration_shared_secret，请手动移除后再运行"
  exit 1
fi
# 在 server_name 行后插入（保持 YAML 可读）
sed -i "/^server_name:/a registration_shared_secret: \"$SHARED_SECRET\"" "$CONFIG_FILE"
echo "已临时添加 registration_shared_secret，正在重启 Synapse ..."
$COMPOSE_CMD restart synapse
echo "等待 Synapse 就绪 ..."
sleep 15

# 3. 创建普通用户（不加 -a，非管理员）
echo "正在创建用户 $BOT_USER ..."
$COMPOSE_CMD exec -T synapse \
  register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008 \
  -u "$BOT_USER" -p "$BOT_PASS" || true
# 若用户已存在会失败，继续移除 secret

# 4. 移除共享密钥并重启
sed -i "/registration_shared_secret/d" "$CONFIG_FILE"
$COMPOSE_CMD restart synapse
echo "已移除 registration_shared_secret，等待 Synapse 就绪 ..."
sleep 15

# 5. 通过 Synapse 原生登录获取 access token（直连 localhost:8008，不经过 MAS）
BASE="http://localhost:8008"
echo "正在获取 $BOT_MXID 的 access token ..."
RES=$(
  curl -sS -X POST "$BASE/_matrix/client/v3/login" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"m.login.password\",\"identifier\":{\"type\":\"m.id.user\",\"user\":\"$BOT_MXID\"},\"password\":\"$BOT_PASS\"}" || true
)
TOKEN=$(echo "$RES" | grep -oE '"access_token"\s*:\s*"[^"]+"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo ""
  echo "警告: 未能通过登录获取 token。若已启用 MAS，登录请求可能被转发到 MAS，而新用户仅存在于 Synapse。"
  echo "可选方案："
  echo "  1) 临时禁用 MAS 后重试本脚本（见 deploy/matrix/README 方案 A）"
  echo "  2) 使用 Synapse Admin API 为该用户签发 token（需现有 admin token）"
  echo "  3) 将下方 bot 密码配置到中间层后，由中间层用密码登录获取 token（若支持）"
  echo ""
  echo "========== Bot 账号信息（请妥善保存）=========="
  echo "MATRIX_BOT_USER_ID=$BOT_MXID"
  echo "Bot 密码（仅本次显示）: $BOT_PASS"
  echo "==============================================="
  exit 0
fi

echo ""
echo "========== 请将以下内容写入工作区 .env（中间层）=========="
echo "MATRIX_BOT_USER_ID=$BOT_MXID"
echo "MATRIX_BOT_ACCESS_TOKEN=$TOKEN"
echo ""
echo "# Bot 密码（可选保存，用于 Element 等客户端登录或重新签发 token）: $BOT_PASS"
echo "============================================================"
echo ""
echo "说明: 配置 MATRIX_BOT_USER_ID 与 MATRIX_BOT_ACCESS_TOKEN 后，"
echo "      助手回复将以该 bot 身份写入 Matrix 房间；未配置则仅经 SSE 推前端。"
