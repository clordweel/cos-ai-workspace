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

## MAS（Matrix Authentication Service）部署（可选）

MAS 将 Matrix 认证委托到独立服务，支持 OAuth2/OIDC、Personal Session 等，便于中间层无密码获取 token。详见 `docs/MAS_AND_AS_RESEARCH.md`。

### 前置条件

- 已完成 `./bootstrap.sh`，存在 `data/homeserver.yaml`
- `.env` 中已设置 `SYNAPSE_SERVER_NAME`、`POSTGRES_PASSWORD`

### 部署步骤

```bash
chmod +x bootstrap-mas.sh
./bootstrap-mas.sh
```

脚本会：

1. 生成 MAS 配置（`mas-config/config.yaml`、`override.yaml`）
2. 配置 passwords 支持 bcrypt（兼容 Synapse 迁移）
3. 停止 Synapse/MAS 后临时暴露数据库端口，执行 `syn2mas` 将现有用户迁移到 MAS
4. 写入 Synapse `matrix_authentication_service`，启动 nginx、Synapse、MAS

### 部署后

- Matrix 端口仍为 8008，经 nginx 转发：`/login`、`/logout`、`/refresh` 由 MAS 处理
- **Element 自动发现**：bootstrap 会生成 `well-known/matrix/client`，解决「Failed to get autodiscovery configuration」。存量部署可执行 `./generate-well-known.sh` 后 `docker compose ... restart nginx`
- 迁移后用户可用原 Synapse 密码登录
- 保存 `.env` 中的 `MAS_SECRET`，中间层接入 Personal Session 时需用
- **Admin API（如 set-password）**：bootstrap 已加入 `policy.data.admin_users: ["admin"]` 并设置 `can_request_admin`。若仍报 "You are not a server admin"，可在工作区 `.env` 配置 `MATRIX_ACCESS_TOKEN`。签发方式：在 Matrix 部署机执行 `./issue-admin-token.sh`，将输出的 token 写入 `.env`。详见 `docs/LOGTO_MATRIX_USERNAME_MAPPING.md`
- **密码修改功能**：bootstrap 已写入 `account.password_change_allowed: true`。若 Synapse 返回「Password change disabled」（MAS 下常见），中间层会自动回退到 MAS Admin API 设密，需配置 `MAS_ADMIN_CLIENT_ID`、`MAS_ADMIN_CLIENT_SECRET`。存量部署且仍失败时，在 `mas-config/override.yaml` 增加：
  ```yaml
  account:
    password_change_allowed: true
  ```
  然后执行 `docker compose -f docker-compose.yml -f docker-compose.mas.yml restart mas`

### 已知限制

- `syn2mas` 需 host 网络访问数据库，bootstrap 会临时暴露 postgres:5433、mas-postgres:5434，迁移后自动移除
- 若 Synapse 有 Logto 等 OIDC 用户，迁移时会加 `--ignore-missing-auth-providers`，需后续在 MAS 中配置对应 upstream

### 方案 A：禁用 MAS 回退纯 Synapse

若 MAS 存在实现问题，可回退到 Synapse 原生认证。详见 `docs/MAS_ALTERNATIVES_RESEARCH.md`。

**步骤**：
1. 在 deploy/matrix 目录执行：`chmod +x disable-mas.sh && ./disable-mas.sh`
2. 切换 compose：`docker compose -f docker-compose.yml -f docker-compose.no-mas.yml up -d`（替代 docker-compose.mas.yml）
3. 工作区 `.env`：不配置或注释 `MAS_ADMIN_CLIENT_ID`、`MAS_ADMIN_CLIENT_SECRET`

可选：配置 `MATRIX_PASSWORD_ENCRYPTION_KEY`（32+ 字符）与 `LOGTO_M2M_*`，将 Matrix 密码加密持久化到 Logto customData

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
  - **CDN 版**：打开 <https://admin.etke.cc>。MAS 下「凭证」可能不显示用户名/密码输入框，请用**「Access Token」**标签，在部署机执行 `./issue-admin-token.sh admin` 获取 token 后粘贴登录
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
