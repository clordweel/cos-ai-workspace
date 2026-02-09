#!/usr/bin/env bash
# 首次部署 Matrix Synapse：生成 homeserver.yaml 并配置 PostgreSQL
# 在 deploy/matrix 目录下执行，且已创建 .env 并设置 SYNAPSE_SERVER_NAME、POSTGRES_PASSWORD

set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "请先复制 .env.example 为 .env 并填写 SYNAPSE_SERVER_NAME、POSTGRES_PASSWORD"
  exit 1
fi
# 加载 .env（不 export 避免覆盖已有环境变量时用 set -a）
set -a
source .env
set +a

for key in SYNAPSE_SERVER_NAME POSTGRES_PASSWORD; do
  if [ -z "${!key}" ]; then
    echo "请在 .env 中设置 $key"
    exit 1
  fi
done

POSTGRES_USER="${POSTGRES_USER:-synapse}"
POSTGRES_DB="${POSTGRES_DB:-synapse}"
DATA_DIR="$(pwd)/data"
export DATA_DIR POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
mkdir -p "$DATA_DIR"

if [ -f "$DATA_DIR/homeserver.yaml" ]; then
  echo "已存在 $DATA_DIR/homeserver.yaml，跳过生成。若需重新生成请先备份并删除该文件。"
  exit 0
fi

echo "正在生成 Synapse 配置（server_name=$SYNAPSE_SERVER_NAME）..."
docker run --rm \
  -v "$DATA_DIR:/data" \
  -e SYNAPSE_SERVER_NAME="$SYNAPSE_SERVER_NAME" \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

echo "正在将数据库配置改为 PostgreSQL..."
# 用 Python 正则替换 database 块，不依赖 PyYAML
python3 << PY
import os
import re

path = os.environ.get("DATA_DIR", "data") + "/homeserver.yaml"
with open(path, "r") as f:
    content = f.read()

user = os.environ.get("POSTGRES_USER", "synapse")
password = os.environ.get("POSTGRES_PASSWORD", "")
dbname = os.environ.get("POSTGRES_DB", "synapse")

new_block = '''database:
  name: psycopg2
  allow_unsafe_locale: true
  args:
    user: %s
    password: %s
    dbname: %s
    host: postgres
    port: 5432
    cp_min: 5
    cp_max: 10
''' % (user, password, dbname)

# 替换从 "database:" 到下一行首非空格的键（或文件末尾）的整块
content = re.sub(
    r"^database:.*?(?=\n[A-Za-z_][A-Za-z0-9_]*:|\n\Z)",
    new_block.rstrip() + "\n",
    content,
    flags=re.MULTILINE | re.DOTALL,
)
with open(path, "w") as f:
    f.write(content)
PY

if [ ! -f "$DATA_DIR/homeserver.yaml" ]; then
  echo "生成或修改配置失败"
  exit 1
fi

echo "配置已就绪。启动服务：docker compose up -d"
docker compose up -d

echo "等待 Synapse 就绪..."
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:${SYNAPSE_HTTP_PORT:-8008}/health || true
echo ""
echo "部署完成。Client-Server API: http://<本机IP>:${SYNAPSE_HTTP_PORT:-8008}"
