# Matrix Synapse 部署（内网单实例）

与 [SESSION_ADAPTER_MATRIX.md](../docs/SESSION_ADAPTER_MATRIX.md) 对应，为会话适配器提供 Matrix 后端。采用 **Synapse + PostgreSQL**，适合内网先行、后续再考虑联邦或桥接。

## 前置要求

- Docker 与 Docker Compose（Compose V2：`docker compose`）
- 本目录可写（用于生成 `data/` 与配置）

## 快速部署

1. **复制环境并填写必填项**

   ```bash
   cp .env.example .env
   # 编辑 .env：SYNAPSE_SERVER_NAME（如 10.1.1.15 或 matrix.internal）、POSTGRES_PASSWORD
   ```

2. **首次生成配置并启动**

   ```bash
   chmod +x bootstrap.sh
   ./bootstrap.sh
   ```

3. **仅启动（配置已存在时）**

   ```bash
   docker compose up -d
   ```

## 配置说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `SYNAPSE_SERVER_NAME` | 是 | 服务器名，即 MXID 的域名部分（如 `@user:10.1.1.15`） |
| `POSTGRES_PASSWORD` | 是 | PostgreSQL 密码 |
| `POSTGRES_USER` | 否 | 默认 `synapse` |
| `POSTGRES_DB` | 否 | 默认 `synapse` |
| `SYNAPSE_HTTP_PORT` | 否 | 默认 `8008` |

**注意**：`SYNAPSE_SERVER_NAME` 一旦确定不可更改，否则需重建数据。

Synapse 要求 PostgreSQL 使用 `C` locale；若使用默认 locale（如 `en_US.utf8`），配置中会启用 `allow_unsafe_locale: true`（内网单实例可接受）。新部署时 docker-compose 已设置 `POSTGRES_INITDB_ARGS: "--locale=C"` 以符合要求。

## 验证

- 健康检查：`curl http://localhost:8008/health`（或你设置的端口）
- Client-Server API 根：`http://<主机>:8008/_matrix/client/versions`

## 创建管理员用户（可选）

在 `homeserver.yaml` 中临时添加并重启 Synapse：

```yaml
registration_shared_secret: "<随机长字符串>"
```

然后：

```bash
docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
# 按提示创建用户，之后可删除 registration_shared_secret 并重启
```

## 中间层对接

中间层 Matrix 适配器需配置：

- **Homeserver URL**：`http://10.1.1.15:8008`（或实际主机与端口）
- **用户/Token**：由认证适配器与 MXID 映射提供，见 SESSION_ADAPTER_MATRIX.md 第三节「身份与认证」。

## 数据与备份

- PostgreSQL 数据：Docker volume `postgres_data`
- Synapse 配置与媒体：`./data/`（含 signing key，请勿泄露）
