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

## 可选：MAS 扩展

若需 MAS（OAuth2/OIDC），执行 `./bootstrap-mas.sh` 并配合 `docker-compose.mas.yml`、`nginx-mas.conf`。主流程以 Synapse 单机为准；调研文档见 `docs/archive/mas/`。

## 配置说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `SYNAPSE_SERVER_NAME` | 是 | 服务器名，即 MXID 的域名部分（如 `@user:10.1.1.15`） |
| `POSTGRES_PASSWORD` | 是 | PostgreSQL 密码 |
| `POSTGRES_USER` | 否 | 默认 `synapse` |
| `POSTGRES_DB` | 否 | 默认 `synapse` |
| `SYNAPSE_HTTP_PORT` | 否 | 默认 `8008` |
| `LOGTO_ISSUER` / `LOGTO_APP_ID_MATRIX` / `LOGTO_APP_SECRET` | 否 | 三者都设置时，bootstrap 会注入 Logto OIDC 登录（见下方「Logto OIDC 登录」） |

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

## 创建 Dify AI 助手 Bot 账号（可选）

当需要将助手回复以 **bot 身份**写入 Matrix 房间时，需在 Synapse 上创建专用 bot 用户，并在中间层配置 `MATRIX_BOT_USER_ID` 与 `MATRIX_BOT_ACCESS_TOKEN`（见 `docs/MATRIX_INTEGRATION_STATUS.md`）。

**步骤**：以 root 用户 SSH 登录 Matrix 部署服务器，进入本目录（若部署在 `/root/matrix` 则 `cd /root/matrix`），执行：

```bash
chmod +x create-dify-bot.sh
./create-dify-bot.sh
```

脚本会创建用户 `ai-assistant`、输出 **MATRIX_BOT_USER_ID** 与 **MATRIX_BOT_ACCESS_TOKEN**，请写入工作区 `.env`。若脚本无法获取 token（如部署走 MAS 且登录被转发），按脚本内提示处理。

**注意**：若 bot 用户已存在，请先用 Synapse Admin API 重置该用户密码或删除用户后再运行脚本。

## Logto OIDC 登录（可选）

若希望用户通过 **Logto** 在 Matrix 客户端（如 Element）或 Synapse 登录页使用 SSO，可将 Logto 配置为 Synapse 的 OIDC Provider。与工作台共用同一 Logto 时，建议为 Synapse **单独建一个应用**，以便设置专属 Redirect URI。

### 方式一：bootstrap 自动注入（推荐）

1. 在 **Logto 控制台** 为 Synapse 创建应用，并配置 **Redirect URI**：
   - `https://<synapse-public-baseurl>/_synapse/client/oidc/callback`（生产建议 HTTPS）
   - 内网可为 `http://<IP 或主机>:8008/_synapse/client/oidc/callback`
2. 在 `deploy/matrix/.env` 中设置（与 `.env.example` 中注释对齐）：
   - `LOGTO_ISSUER`：Logto 的 OIDC Issuer 根地址，如 `https://your-logto.app`（不要末尾斜杠）
   - `LOGTO_APP_ID_MATRIX`：上述应用的 Client ID
   - `LOGTO_APP_SECRET`：上述应用的 Client Secret
3. **仅在首次生成配置前** 设置好上述三项，然后执行 `./bootstrap.sh`。bootstrap 会在生成的 `data/homeserver.yaml` 末尾注入 `oidc_providers`（Logto，`localpart` 使用 Logto 的 `sub`，便于与工作台 `logtoSub` 一致）。
4. 若 `data/homeserver.yaml` 已存在，bootstrap 不会覆盖也不会再次注入；需要 Logto 时请先备份并删除 `data/homeserver.yaml` 后重新执行 bootstrap，或采用下方方式二手动添加。

### 方式二：手动添加配置

在已生成的 `data/homeserver.yaml` 末尾追加以下块（替换为实际值），然后重启 Synapse：

```yaml
oidc_providers:
  - idp_id: logto
    idp_name: Logto
    discover: true
    issuer: "https://your-logto.app"
    client_id: "<Logto 应用 Client ID>"
    client_secret: "<Logto 应用 Client Secret>"
    scopes: ["openid", "profile"]
    user_mapping_provider:
      config:
        localpart_template: "{{ user.sub }}"
        display_name_template: "{{ user.name }}"
```

Logto 应用中的 Redirect URI 必须为：`[synapse public baseurl]/_synapse/client/oidc/callback`。

### 可选：Back-Channel Logout

若 Logto 支持 Back-Channel Logout，可在上述 provider 下增加 `backchannel_logout_enabled: true`，并在 Logto 中配置 Back-Channel Logout URL：`[synapse public baseurl]/_synapse/client/oidc/backchannel_logout`，使用户在 Logto 登出时 Synapse 同步结束会话。

## 管理台 GUI

Synapse 本身无官方 Web 管理界面，可使用第三方 **Synapse Admin** 做用户、房间、媒体等管理：

- **项目**：[etkecc/synapse-admin](https://github.com/etkecc/synapse-admin)（维护中的 Synapse 管理台）
- **使用方式**：
  - **CDN 版**：打开 <https://admin.etke.cc>。登录时用**「Access Token」**标签：在部署机执行 `./issue-admin-token-synapse.sh <admin密码>`，将输出 token 粘贴
  - **自建**：将 Synapse Admin 部署到自有域名（如 `https://matrix.你的域名/admin`），详见项目 README
- **功能**：用户列表与权限、房间查看/删除、媒体管理；部分版本支持服务器状态与定时任务

仅需 API 时可直接使用 [Synapse Admin API](https://matrix-org.github.io/synapse/latest/usage/administration/index.html)。

## 开发模式：放宽登录限流

当出现 `M_LIMIT_EXCEEDED`（Too Many Requests）时，通常是 Synapse 对登录请求做了限流。开发环境可放宽限制：

```bash
chmod +x relax-rate-limits.sh
./relax-rate-limits.sh
```

脚本会向 `data/homeserver.yaml` 追加 `rc_login` 配置（per_second/burst_count 设为 10000），并重启 Synapse。**生产环境请勿使用**，保持默认限流以抵御暴力破解。

## 与项目中间层整合

1. **在 Synapse 上创建用于中间层的 Matrix 用户**（见上方「创建管理员用户」），得到 MXID（如 `@workbench:10.1.1.15`）和密码；或通过 Client-Server API 登录一次取得 `access_token`。

2. **在中间层环境（工作区根或 middleware 目录）的 `.env` 中配置**：
   - `CHAT_PROVIDER=matrix`
   - `MATRIX_BASE_URL=http://10.1.1.15:8008`（或实际 Synapse 地址）
   - 二选一：`MATRIX_ACCESS_TOKEN=<token>`，或 `MATRIX_USER_ID=@workbench:10.1.1.15` + `MATRIX_PASSWORD=<密码>`

3. 重启中间层后，`GET /api/sessions`、`GET /api/sessions/:id/messages`、`POST /api/chat/stream` 将使用 Matrix 房间与消息；流式回复由 Dify 产生并写入同一房间（需配置 `DIFY_API_KEY`）。

## 数据与备份

- PostgreSQL 数据：Docker volume `postgres_data`
- Synapse 配置与媒体：`./data/`（含 signing key，请勿泄露）
