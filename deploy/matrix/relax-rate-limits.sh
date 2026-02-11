#!/usr/bin/env bash
# 开发模式：放宽 Synapse 登录限流，避免 M_LIMIT_EXCEEDED (Too Many Requests)
# 在 deploy/matrix 目录执行；会向 data/homeserver.yaml 追加 rc_login 配置并重启 Synapse
set -e
cd "$(dirname "$0")"

DATA_DIR="$(pwd)/data"
CONFIG="$DATA_DIR/homeserver.yaml"

if [ ! -f "$CONFIG" ]; then
  echo "未找到 $CONFIG，请先执行 ./bootstrap.sh 生成配置"
  exit 1
fi

if grep -q "^rc_login:" "$CONFIG" 2>/dev/null; then
  echo "rc_login 已存在，跳过。如需修改请手动编辑 $CONFIG"
  exit 0
fi

echo "正在追加 rc_login（放宽登录限流）到 $CONFIG ..."
cat >> "$CONFIG" << 'YAML'

# 开发模式：放宽登录限流（避免 M_LIMIT_EXCEEDED）
rc_login:
  address:
    per_second: 10000
    burst_count: 10000
  account:
    per_second: 10000
    burst_count: 10000
  failed_attempts:
    per_second: 10000
    burst_count: 10000
YAML

echo "已追加。正在重启 Synapse 使配置生效..."
docker compose restart synapse
echo "完成。登录限流已放宽。"
