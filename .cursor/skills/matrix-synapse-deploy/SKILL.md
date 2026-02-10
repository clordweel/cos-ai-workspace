---
name: matrix-synapse-deploy
description: 在目标服务器上部署 Matrix Synapse（Synapse + PostgreSQL）内网单实例。当用户要求部署 Matrix、在某某 IP 上部署 Synapse、或按 SESSION_ADAPTER_MATRIX 部署会话后端时使用。
---

# 部署 Matrix Synapse

在已配置 SSH 公钥的服务器上部署 Matrix Synapse + PostgreSQL，使用项目内 `deploy/matrix/` 的 docker-compose 与 bootstrap 脚本。

## 前置条件

- 目标机已安装 Docker 与 Docker Compose（V2：`docker compose`）
- 当前环境可 SSH 免密登录目标机（如 `ssh root@<IP>`）
- 项目内存在 `deploy/matrix/`（docker-compose.yml、bootstrap.sh、.env.example）

## 部署步骤

1. **上传部署目录**（排除 .env 和 data）：
   ```bash
   rsync -az --exclude='.env' --exclude='data' deploy/matrix/ root@<目标IP>:/root/matrix/
   ```

2. **在目标机创建 .env**（替换 `<目标IP>` 与随机密码）：
   ```bash
   ssh root@<目标IP> "cd /root/matrix && printf 'SYNAPSE_SERVER_NAME=<目标IP或域名>\nPOSTGRES_PASSWORD=%s\n' \"\$(openssl rand -base64 24)\" > .env"
   ```

3. **执行首次引导**：
   ```bash
   ssh root@<目标IP> "cd /root/matrix && chmod +x bootstrap.sh && ./bootstrap.sh"
   ```
   若拉取镜像较慢可能超时，可仅执行上述命令不设短超时，或分步：先 SSH 登录再在目标机执行 `./bootstrap.sh`。

4. **处理 PostgreSQL locale 错误**（若 Synapse 启动报错 `Database has incorrect collation`）：
   在目标机 `data/homeserver.yaml` 的 `database` 段中，在 `name: psycopg2` 下一行添加：
   ```yaml
   allow_unsafe_locale: true
   ```
   然后重启：`docker compose restart synapse`。

5. **验证**：
   ```bash
   ssh root@<目标IP> "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8008/health"
   ```
   返回 `200` 即正常；Client-Server API：`http://<目标IP>:8008/_matrix/client/versions`。

## 参考

- 部署说明与配置项：`deploy/matrix/README.md`
- 会话适配器选型：`docs/SESSION_ADAPTER_MATRIX.md`
