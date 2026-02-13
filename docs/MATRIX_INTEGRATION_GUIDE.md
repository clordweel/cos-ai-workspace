# Matrix 整合实施与验证指南

> 部署步骤以 `deploy/matrix/README.md` 为准；本文为补充与验证顺序。

按顺序完成以下步骤，实现并验证工作台与 Matrix（Synapse）的整合。

---

## 第一步：部署 Synapse（deploy/matrix）

### 1.1 进入目录并准备环境

```bash
cd /home/frappe/workspace/deploy/matrix
cp .env.example .env
```

### 1.2 编辑 `deploy/matrix/.env`

必填两项（其余可先默认）：

| 变量 | 示例 | 说明 |
|------|------|------|
| `SYNAPSE_SERVER_NAME` | `10.1.1.15` 或 `matrix.junhai.work` | MXID 的域名部分，如 `@user:10.1.1.15`；**一旦确定不可改** |
| `POSTGRES_PASSWORD` | 强密码 | PostgreSQL 密码 |

可选：若需 Synapse 支持 Logto 登录，在同一 `.env` 中增加（三者都填时 bootstrap 会注入 OIDC）：

- `LOGTO_ISSUER=https://auth.junhai.work/oidc`
- `LOGTO_APP_ID_MATRIX=<为 Synapse 单独建的应用 ID>`
- `LOGTO_APP_SECRET=<该应用密钥>`

并在 Logto 中为该应用配置 Redirect URI：`http://<Synapse 地址>:8008/_synapse/client/oidc/callback`。

### 1.3 首次生成配置并启动

```bash
chmod +x bootstrap.sh
./bootstrap.sh
```

脚本会：生成 `data/homeserver.yaml`、改为 PostgreSQL、可选注入 Logto OIDC、启动容器。若已存在 `data/homeserver.yaml`，会跳过生成。

### 1.4 验证 Synapse

```bash
# 健康检查（返回 200）
curl -s -o /dev/null -w "%{http_code}" http://localhost:8008/health

# Client-Server API 版本（应返回 JSON）
curl -s http://localhost:8008/_matrix/client/versions
```

预期：健康检查为 `200`，versions 返回包含 `versions` 的 JSON。

---

## 第二步：创建 Matrix 服务账号（供中间层使用）

中间层需要用一个固定 Matrix 用户（服务账号）调用 Synapse，需先创建该用户并拿到 **access_token** 或 **密码**。

### 2.1 临时开启注册密钥

编辑 `deploy/matrix/data/homeserver.yaml`，在顶层增加（随机长字符串）：

```yaml
registration_shared_secret: "请替换为随机长字符串"
```

保存后重启 Synapse：

```bash
cd /home/frappe/workspace/deploy/matrix
docker compose restart synapse
```

### 2.2 注册用户

```bash
cd /home/frappe/workspace/deploy/matrix
docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
```

按提示输入：

- **用户名**：建议 `workbench`（对应 MXID `@workbench:<SYNAPSE_SERVER_NAME>`）
- **密码**：自设并牢记，后面填到中间层 `MATRIX_PASSWORD`
- **是否管理员**：可选 `no`

记下 **MXID**（如 `@workbench:10.1.1.15`）和**密码**。

### 2.3 删除注册密钥并重启（安全）

编辑 `data/homeserver.yaml`，删除或注释掉 `registration_shared_secret` 整行，保存后：

```bash
docker compose restart synapse
```

### 2.4（可选）直接拿到 access_token

若希望用 `MATRIX_ACCESS_TOKEN` 而不是密码，可调登录接口拿到 token：

```bash
curl -s -X POST http://localhost:8008/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "identifier": { "type": "m.id.user", "user": "workbench" },
    "password": "你设置的密码"
  }'
```

在返回的 JSON 里取 `access_token`，填到根目录 `.env` 的 `MATRIX_ACCESS_TOKEN`（见第三步）。

---

## 第三步：配置工作区使用 Matrix

### 3.1 编辑工作区根目录 `.env`

在项目根目录（`/home/frappe/workspace`）的 `.env` 中设置或确认：

```env
# 使用 Matrix 作为聊天后端
CHAT_PROVIDER=matrix

# Synapse 地址（与 deploy/matrix 一致；若中间层与 Synapse 同机可用 localhost）
MATRIX_BASE_URL=http://10.1.1.15:8008

# 二选一：要么填 access_token，要么填 userId + password
MATRIX_USER_ID=@workbench:10.1.1.15
MATRIX_PASSWORD=你为 workbench 设置的密码

# 若使用 MATRIX_ACCESS_TOKEN，可注释掉上面两行
# MATRIX_ACCESS_TOKEN=eyJ...
```

- `MATRIX_BASE_URL`：若中间层和 Synapse 不在同一台机，改为实际 Synapse 的地址（如 `http://10.1.1.15:8008`）。
- `MATRIX_USER_ID`：必须与第二步创建的 MXID 完全一致（含 `@` 和 server_name）。

### 3.2 重启中间层

```bash
cd /home/frappe/workspace
pnpm run dev
# 或仅启动 middleware：cd middleware && pnpm run dev
```

确保中间层进程读取到新的 `.env`。

---

## 第四步：验证中间层与 Matrix 的整合

以下请求均针对**中间层**（默认 `http://localhost:3000`），无需带 Cookie。

### 4.1 会话列表（Matrix 房间列表）

```bash
curl -s "http://localhost:3000/api/sessions?user_id=test" | jq .
```

预期：返回 `{ "sessions": [ ... ] }`，可能为空数组；若之前已有房间会列出。若返回 501「当前后端不支持会话列表」或 502，检查 `CHAT_PROVIDER=matrix` 与 Matrix 三项配置是否正确、中间层是否重启。

### 4.2 发一条消息并产生新会话（走 Matrix + Dify 流式）

需已配置 `DIFY_API_KEY`（根目录 `.env`）。若未配置 Dify，可跳过本步或仅验证 4.1/4.3。

```bash
curl -s -N -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","user_id":"test"}'
```

预期：SSE 流式输出（`event: message`、`event: message_end` 等）。若返回 502「聊天后端未配置」，检查 `CHAT_PROVIDER` 与 Matrix 配置；若 Dify 报错，检查 `DIFY_API_KEY`。

发完后，再调一次 4.1，应能看到一个新会话（新房间）。

### 4.3 拉取某个会话的历史消息

先用 4.1 拿到一个 `id`（即 `room_id`），再请求（把 `SESSION_ID` 换成实际 id）：

```bash
SESSION_ID="替换为 listSessions 返回的某个 id"
curl -s "http://localhost:3000/api/sessions/${SESSION_ID}/messages?user_id=test&limit=10" | jq .
```

预期：返回 `{ "messages": [ ... ] }`，包含刚发的消息等。

---

## 第五步：前端验证（可选）

1. 启动前端：在项目根 `pnpm run dev`（或单独起 frontend），打开 `http://localhost:3001`（或你配置的 `FRONTEND_ORIGIN`）。
2. 若需登录：用工作台现有登录方式（Logto/密码/Token）登录。
3. 进入会话/空间页：应能看到会话列表（来自 Matrix 房间）；进入某会话可发消息，流式回复由 Dify 产生并写入 Matrix 房间。

前端不直连 Matrix，只通过中间层；只要第四步的 curl 正常，前端即会使用同一套 Matrix 整合。

---

## 故障排查简表

| 现象 | 可能原因 |
|------|----------|
| Synapse `curl health` 非 200 | 容器未就绪或端口不对；`docker compose ps`、`docker compose logs synapse` |
| 501 当前后端不支持会话列表 | `CHAT_PROVIDER` 未设为 `matrix`，或 Matrix 未配置完整，或中间层未重启 |
| 502 拉取会话列表失败 / Matrix 未配置 | `MATRIX_BASE_URL`、`MATRIX_USER_ID` + `MATRIX_PASSWORD`（或 `MATRIX_ACCESS_TOKEN`）错误；Synapse 未启动或网络不通 |
| 401 / 登录失败 | `MATRIX_USER_ID` 或密码错误；MXID 格式必须为 `@localpart:server_name` |
| 流式 502 / Dify 报错 | 检查 `DIFY_API_KEY`、`DIFY_API_BASE`；Matrix 整合本身可先通过 4.1、4.3 验证 |

---

## 相关文档

- 会话适配器与 Matrix 选型：[SESSION_ADAPTER_MATRIX.md](SESSION_ADAPTER_MATRIX.md)
- Synapse 部署说明：[deploy/matrix/README.md](../deploy/matrix/README.md)（含 Logto OIDC 可选配置）
