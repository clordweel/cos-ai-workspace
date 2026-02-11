#!/usr/bin/env bash
# MAS 部署：生成配置、迁移用户、整合 nginx、更新 Synapse
# 在 deploy/matrix 目录执行，需已存在 .env 与 data/homeserver.yaml

set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "请先创建 .env（可从 .env.example 复制）"
  exit 1
fi
set -a
source .env
set +a

for key in SYNAPSE_SERVER_NAME POSTGRES_PASSWORD; do
  if [ -z "${!key}" ]; then
    echo "请在 .env 中设置 $key"
    exit 1
  fi
done

# MAS 必填
MAS_POSTGRES_PASSWORD="${MAS_POSTGRES_PASSWORD:-$(openssl rand -base64 24)}"
MAS_SECRET="${MAS_SECRET:-$(openssl rand -hex 32)}"
# Admin API 客户端（中间层 Personal Session 用，client_id 需 ULID 格式）
MAS_ADMIN_CLIENT_ID="${MAS_ADMIN_CLIENT_ID:-$(python3 -c "import random; b32='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; print('01'+''.join(random.choices(b32,k=24)))")}"
MAS_ADMIN_CLIENT_SECRET="${MAS_ADMIN_CLIENT_SECRET:-$(openssl rand -base64 32)}"
echo "MAS_POSTGRES_PASSWORD=$MAS_POSTGRES_PASSWORD" >> .env
echo "MAS_SECRET=$MAS_SECRET" >> .env
grep -q "^MAS_ADMIN_CLIENT_ID=" .env 2>/dev/null || echo "MAS_ADMIN_CLIENT_ID=$MAS_ADMIN_CLIENT_ID" >> .env
grep -q "^MAS_ADMIN_CLIENT_SECRET=" .env 2>/dev/null || echo "MAS_ADMIN_CLIENT_SECRET=$MAS_ADMIN_CLIENT_SECRET" >> .env
# 重新加载
set -a
source .env
set +a

DATA_DIR="$(pwd)/data"
MAS_CONFIG_DIR="$(pwd)/mas-config"
export MAS_CONFIG_DIR
mkdir -p "$MAS_CONFIG_DIR"

if [ ! -f "$DATA_DIR/homeserver.yaml" ]; then
  echo "未找到 $DATA_DIR/homeserver.yaml，请先执行 ./bootstrap.sh"
  exit 1
fi

# 1. 生成 MAS 配置
echo "生成 MAS 配置..."
docker run --rm ghcr.io/element-hq/matrix-authentication-service:latest config generate > "$MAS_CONFIG_DIR/config.yaml"

# 2. 写入 MAS 覆盖配置（database、matrix、clients、policy、adminapi）
echo "写入 MAS 覆盖配置..."
cat > "$MAS_CONFIG_DIR/override.yaml" << YAML
database:
  uri: postgresql://${MAS_POSTGRES_USER:-mas}:${MAS_POSTGRES_PASSWORD}@mas-postgres:5432/${MAS_POSTGRES_DB:-mas}

matrix:
  kind: synapse
  homeserver: "${SYNAPSE_SERVER_NAME}"
  endpoint: "http://synapse:8008"
  secret: "${MAS_SECRET}"

clients:
  - client_id: "${MAS_ADMIN_CLIENT_ID}"
    client_auth_method: client_secret_basic
    client_secret: "${MAS_ADMIN_CLIENT_SECRET}"

policy:
  data:
    admin_clients:
      - "${MAS_ADMIN_CLIENT_ID}"
    # 使 admin 用户密码登录时获得 urn:synapse:admin:*，供 Synapse Admin API（如 set-password）使用
    admin_users:
      - admin
YAML

# 启用 adminapi 资源（在第一个 resources 块中追加，若不存在）
if ! grep -q "name: adminapi" "$MAS_CONFIG_DIR/config.yaml" 2>/dev/null; then
  python3 -c "
import re
p = \"$MAS_CONFIG_DIR/config.yaml\"
with open(p) as f: c = f.read()
if 'adminapi' not in c:
  # 在 - name: assets 前插入 adminapi
  c = re.sub(r'(- name: assets)', r'- name: adminapi\n    \1', c, count=1)
  with open(p, 'w') as f: f.write(c)
"
fi

# 直接修改 config.yaml 的 passwords.schemes（迁移需 bcrypt v1，覆盖默认 argon2id v1）
# 迁移需 bcrypt(1) + argon2id(2)
python3 << PYPW
import os, re
p = os.environ.get("MAS_CONFIG_DIR", "mas-config") + "/config.yaml"
with open(p) as f: c = f.read()
block = '''
passwords:
  enabled: true
  minimum_complexity: 3
  schemes:
    - version: 1
      algorithm: bcrypt
      unicode_normalization: true
    - version: 2
      algorithm: argon2id
'''
c = re.sub(r'^passwords:.*?(?=\n[a-zA-Z_][a-zA-Z0-9_]*:|\Z)', block.strip() + '\n', c, count=1, flags=re.MULTILINE | re.DOTALL)
with open(p, 'w') as f: f.write(c)
PYPW

# 3. 校验 MAS 配置
echo "校验 MAS 配置..."
docker run --rm -v "$(pwd)/mas-config:/cfg:ro" \
  -e MAS_CONFIG=/cfg/config.yaml:/cfg/override.yaml \
  ghcr.io/element-hq/matrix-authentication-service:latest config check || true

# 4. 停止 Synapse 与 MAS（迁移期间）
echo "停止 Synapse 与 MAS..."
docker compose -f docker-compose.yml -f docker-compose.mas.yml stop synapse mas 2>/dev/null || true

# 5. 启动数据库并临时暴露端口（syn2mas 需 host 网络访问）
echo "启动数据库并临时暴露端口..."
cat > docker-compose.migration.yml << 'MIGYAML'
services:
  postgres:
    ports: ["127.0.0.1:5433:5432"]
  mas-postgres:
    ports: ["127.0.0.1:5434:5432"]
MIGYAML
docker compose -f docker-compose.yml -f docker-compose.mas.yml -f docker-compose.migration.yml up -d postgres mas-postgres 2>/dev/null || true
echo "等待数据库就绪..."
sleep 5

# 6. 迁移 Synapse 用户到 MAS（host 网络 + 临时 override）
echo "迁移用户到 MAS（syn2mas）..."
export POSTGRES_PASSWORD MAS_POSTGRES_PASSWORD
ENC_PG="$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ.get('POSTGRES_PASSWORD',''), safe=''))")"
ENC_MAS="$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ.get('MAS_POSTGRES_PASSWORD',''), safe=''))")"
SYNAPSE_URI="postgresql://${POSTGRES_USER:-synapse}:${ENC_PG}@127.0.0.1:5433/${POSTGRES_DB:-synapse}"
MAS_URI="postgresql://${MAS_POSTGRES_USER:-mas}:${ENC_MAS}@127.0.0.1:5434/${MAS_POSTGRES_DB:-mas}"
cat > mas-config/override-migration.yaml << EOFOUT
database:
  uri: "${MAS_URI}"
matrix:
  kind: synapse
  homeserver: "${SYNAPSE_SERVER_NAME}"
  endpoint: "http://127.0.0.1:${SYNAPSE_HTTP_PORT:-8008}"
  secret: "${MAS_SECRET}"
EOFOUT
docker run --rm --network host \
  -v "$(pwd)/data:/synapse-data:ro" \
  -v "$(pwd)/mas-config:/app/config:ro" \
  -e MAS_CONFIG=/app/config/config.yaml:/app/config/override-migration.yaml \
  ghcr.io/element-hq/matrix-authentication-service:latest \
  syn2mas migrate --ignore-missing-auth-providers \
  --synapse-config /synapse-data/homeserver.yaml \
  --synapse-database-uri "$SYNAPSE_URI" 2>/dev/null || {
  echo "syn2mas 迁移跳过或失败（可能无用户）；继续部署"
}
rm -f mas-config/override-migration.yaml docker-compose.migration.yml

# 7. 写入 Synapse matrix_authentication_service
echo "更新 Synapse 配置..."
python3 << PYSYNAPSE
import os

path = os.environ.get("DATA_DIR", "data") + "/homeserver.yaml"
secret = os.environ.get("MAS_SECRET", "")
# 内网：MAS 容器名
endpoint = "http://mas:8080/"

with open(path, "r") as f:
    content = f.read()

block = f"""
# MAS 委托认证（由 bootstrap-mas 注入）
matrix_authentication_service:
  enabled: true
  endpoint: "{endpoint}"
  secret: "{secret}"
"""
if "matrix_authentication_service:" in content:
    print("matrix_authentication_service 已存在，跳过")
else:
    with open(path, "a") as f:
        f.write(block)
    print("已添加 matrix_authentication_service")
PYSYNAPSE

# 8. 启动全部服务（含 nginx、synapse）
echo "启动全部服务..."
docker compose -f docker-compose.yml -f docker-compose.mas.yml up -d

echo "等待服务就绪..."
sleep 8
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:${SYNAPSE_HTTP_PORT:-8008}/health" || true

# 9. 设置 admin 用户 can_request_admin，使密码登录获得的 token 含 Synapse admin scope（供 set-password 等 Admin API）
echo "设置 MAS admin 用户 can_request_admin..."
docker compose -f docker-compose.yml -f docker-compose.mas.yml exec -T mas-postgres \
  psql -U "${MAS_POSTGRES_USER:-mas}" -d "${MAS_POSTGRES_DB:-mas}" -c \
  "UPDATE users SET can_request_admin = true WHERE username = 'admin';" 2>/dev/null || true

echo "MAS 部署完成。Matrix 端口: ${SYNAPSE_HTTP_PORT:-8008}（经 nginx 转发）"
echo "请将 MAS_SECRET 保存，中间层接入 MAS Personal Session 时需要"
echo "若 set-password 仍报 You are not a server admin，可配置 MATRIX_ACCESS_TOKEN 使用 mas-cli 或 Synapse Admin 签发的 admin token"
