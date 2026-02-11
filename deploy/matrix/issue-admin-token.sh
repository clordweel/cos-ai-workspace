#!/usr/bin/env bash
# 签发具 Synapse admin 权限的 compatibility token，供中间层 MATRIX_ACCESS_TOKEN 使用
# 在 deploy/matrix 目录执行，或确保当前目录有 docker-compose.mas.yml

set -e
cd "$(dirname "$0")"

if [ ! -f docker-compose.mas.yml ]; then
  echo "请在 deploy/matrix 目录执行，或确保 docker-compose.mas.yml 存在"
  exit 1
fi

USERNAME="${1:-admin}"
echo "签发 admin token（用户名: $USERNAME）..."
RAW=$(docker compose -f docker-compose.yml -f docker-compose.mas.yml exec -T mas \
  mas-cli manage issue-compatibility-token "$USERNAME" --yes-i-want-to-grant-synapse-admin-privileges 2>&1)
# token 通常为长字符串，取最长的疑似 token 行
TOKEN=$(echo "$RAW" | grep -oE '[A-Za-z0-9_-]{80,}' | head -1)

if [ -z "$TOKEN" ]; then
  echo "失败：未获取到 token，请检查 MAS 容器是否运行"
  exit 1
fi

echo ""
echo "========== 请将下面 token 写入工作区 .env 的 MATRIX_ACCESS_TOKEN =========="
echo "$TOKEN"
echo "=========================================================================="
echo ""
echo "步骤："
echo "  1. 复制上方 token"
echo "  2. 在项目根目录 .env 中注释 MATRIX_USER_ID、MATRIX_PASSWORD"
echo "  3. 添加或修改：MATRIX_ACCESS_TOKEN=<粘贴的 token>"
echo "  4. 重启中间层"
