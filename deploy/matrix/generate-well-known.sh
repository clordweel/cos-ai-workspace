#!/usr/bin/env bash
# 生成 .well-known/matrix/client 供 Element 自动发现
# 在 deploy/matrix 目录执行，或确保已 source .env

set -e
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

mkdir -p well-known/matrix
BASE_URL="http://${SYNAPSE_SERVER_NAME:-10.1.1.15}:${SYNAPSE_HTTP_PORT:-8008}"
echo "{\"m.homeserver\":{\"base_url\":\"${BASE_URL}\"}}" > well-known/matrix/client
echo "已生成 well-known/matrix/client，base_url=$BASE_URL"
echo "若需重启 nginx 以生效：docker compose -f docker-compose.yml -f docker-compose.mas.yml restart nginx"
