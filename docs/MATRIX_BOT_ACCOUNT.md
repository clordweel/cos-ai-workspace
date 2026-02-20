# 如何创建 Matrix Bot 账号

> 用于「助手回复以 bot 身份写入 Matrix 房间」：API 层调 Dify 后，用 bot 账号在房间内发一条 `m.room.message`。  
> 配置项：`apps/api/.env` 中的 `MATRIX_BOT_USER_ID`、`MATRIX_BOT_ACCESS_TOKEN`。  
> **可选**：部署时由 API 根据 Dify + Matrix 配置**自动创建** bot，见下文「自动初始化」。

与创建普通 Matrix 用户（如 `workbench`）步骤相同，只是再创建一个**专用 bot 用户**（如 `ai-assistant`），并拿到其 **access_token** 填到 API 的 `.env`。若使用自动初始化，可跳过下方手动步骤。

---

## 单 bot 全用户共用：会有性能问题吗？

**结论：一般不会。**

- **Bot 不做 Sync**：当前实现里，bot 账号只被 API 用来**发消息**（邀请入房、join、发一条 `m.room.message`），没有以 bot 身份跑长连接 /sync，因此不存在「一个 bot 同步大量房间」带来的连接与内存压力。
- **数据在房间与 Dify**：会话内容在 Matrix 的**房间事件**和 Dify 的会话里，bot 只是**发送者身份**，不承担存储；房间数量多时，压力主要在 Synapse 的存储与**人类用户**的 sync，不在单个 bot。
- **扩展**：若未来单 Synapse 上房间数极大，可再考虑多 bot 分片（不同房间用不同 bot），当前阶段单 bot 即可。

---

## 前置条件

- Synapse 已部署且可访问（如 `http://<host>:8008`）
- 有权限编辑 `homeserver.yaml` 并重启 Synapse（若用 Docker：`docker compose exec` 或挂载目录可写）

---

## 步骤

### 1. 临时开启注册密钥

在 Synapse 的 **homeserver.yaml** 顶层增加（若已有 `registration_shared_secret` 可跳过，用现有值即可）：

```yaml
registration_shared_secret: "随机长字符串"
```

生成随机串示例：

```bash
openssl rand -base64 32
```

保存后重启 Synapse，例如：

```bash
# 若在 deploy/matrix 目录
docker compose restart synapse

# 或按你实际路径
docker compose -f /path/to/docker-compose.yml restart synapse
```

等待十数秒使服务就绪。

---

### 2. 注册 Bot 用户

在 Synapse 所在机器执行（路径与 compose 文件名按实际修改）：

```bash
docker compose exec -T synapse \
  register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008 \
  -u ai-assistant -p "你的Bot密码" 
```

- **-u**：本地用户名（localpart），MXID 为 `@ai-assistant:<server_name>`
- **-p**：密码，后面登录拿 token 要用，请牢记
- **不要加 -a**：bot 不需要管理员权限

看到 `Success!` 即创建成功。记下 **MXID**（如 `@ai-assistant:10.1.1.15`）和**密码**。

---

### 3. 移除注册密钥并重启（安全）

从 `homeserver.yaml` 中删除或注释掉 `registration_shared_secret` 整行，保存后再次重启 Synapse：

```bash
docker compose restart synapse
```

---

### 4. 获取 Bot 的 access_token

用刚才的账号密码调 Synapse 登录接口（`<HOMESERVER>` 换成实际地址，如 `http://10.1.1.15:8008`）：

```bash
curl -s -X POST "<HOMESERVER>/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "identifier": { "type": "m.id.user", "user": "ai-assistant" },
    "password": "你的Bot密码"
  }'
```

若 `user` 用完整 MXID，例如：

```json
"identifier": { "type": "m.id.user", "user": "@ai-assistant:10.1.1.15" }
```

在返回的 JSON 里找到 **`access_token`**，复制备用。

---

### 5. 配置 apps/api

在 **apps/api/.env** 中增加（或修改）：

```env
MATRIX_BOT_USER_ID=@ai-assistant:10.1.1.15
MATRIX_BOT_ACCESS_TOKEN=上一步拿到的 access_token
```

- `MATRIX_BOT_USER_ID`：必须与 Synapse 的 `server_name` 一致（如 `10.1.1.15` 或你的域名）。
- 保存后重启 API 服务，@ AI 助手 且 Dify 配置正确时，助手回复会以该 bot 身份写入当前 Matrix 房间。

---

## 说明

- **Bot 入房**：当前实现会在需要发助手消息时先邀请 bot 进房再 `join`，若已在房会忽略错误，无需事先手动拉 bot。
- **与管理员账号区分**：管理员账号（如 `@admin:...`）用于 Synapse Admin API（创建/更新用户等）；Bot 账号仅用于在房间内发助手消息，不要用管理员账号做 bot。
- 更多 Matrix 配置见 `docs/MATRIX_INTEGRATION_GUIDE.md`、`docs/MATRIX_INTEGRATION_STATUS.md`。

---

## 自动初始化（部署时创建 Bot）

若希望**不手动创建** bot，可在部署时由 API 根据环境变量**自动创建**一个 AI 助手 bot 并写入 token，满足「系统部署时初始化一个 AI 助手」的需求。

### 条件

- `CHAT_PROVIDER=matrix`
- `DIFY_API_KEY` 已配置（表示要启用 @ AI 助手）
- **未**设置 `MATRIX_BOT_USER_ID` / `MATRIX_BOT_ACCESS_TOKEN`（或希望由 API 创建）
- Matrix **管理员**已配置：`MATRIX_USER_ID` + `MATRIX_ACCESS_TOKEN` 或 `MATRIX_PASSWORD`（用于调 Synapse Admin API 创建用户）

### 可选环境变量

| 变量 | 说明 |
|------|------|
| `MATRIX_BOT_LOCALPART` | Bot 本地用户名，默认 `ai-assistant`，MXID 为 `@<localpart>:<MATRIX_SERVER_NAME>` |
| `MATRIX_BOT_PASSWORD` | 若 bot 已存在且你已知密码，可填此项；API 会登录拿到 token 并写入本地文件，下次启动直接用文件中的 token |

### 行为

1. **首次启动**：API 发现未配置 bot 且满足上述条件时，用 Admin API 在 Synapse 上创建用户 `@<MATRIX_BOT_LOCALPART>:<server_name>`，设随机密码并登录拿到 `access_token`，将 token 写入 **apps/api/data/.matrix-bot-token**（该文件应加入 .gitignore），并写入内存供本次运行使用。
2. **后续启动**：若仍未设置 `MATRIX_BOT_ACCESS_TOKEN`，API 会先读 **data/.matrix-bot-token**；若存在则直接使用，无需再创建或登录。
3. **Bot 已存在**：若 Synapse 上该 bot 用户已存在（例如曾手动创建），自动创建会跳过并打日志，此时需手动配置 `MATRIX_BOT_ACCESS_TOKEN` 或设置 `MATRIX_BOT_PASSWORD` 让 API 登录一次并写入 token 文件。

### 示例（仅需 Matrix + Dify，不填 Bot）

```env
CHAT_PROVIDER=matrix
MATRIX_BASE_URL=http://10.1.1.15:8008
MATRIX_SERVER_NAME=10.1.1.15
MATRIX_USER_ID=@admin:10.1.1.15
MATRIX_ACCESS_TOKEN=...   # 或 MATRIX_PASSWORD
DIFY_API_KEY=app-xxx
# 不填 MATRIX_BOT_*，首次启动后会自动创建 @ai-assistant:10.1.1.15 并写入 data/.matrix-bot-token
```
