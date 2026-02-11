# Matrix/Synapse 服务诊断说明

## `/_matrix` 返回 M_UNRECOGNIZED 的说明

访问 `http://10.1.1.15:8008/_matrix` 会返回：

```json
{"errcode":"M_UNRECOGNIZED", "error": "Unrecognized request"}
```

**这是预期行为，不是服务故障。** Matrix 规范中 `/_matrix` 单独路径不是有效 API，Synapse 会返回 404/M_UNRECOGNIZED。

正确接口示例：
- `/_matrix/client/versions` — 返回 200
- `/_matrix/client/v3/login` — 登录
- `/health` — 健康检查

## 快速自检命令

```bash
# 在部署机执行
curl -s http://localhost:8008/_matrix/client/versions   # 应返回 JSON
curl -s http://localhost:8008/health                   # 应返回 OK
```

## 登录 Synapse Admin

MAS 部署下，admin.etke.cc 会检测到 `delegated_oidc_compatibility` 而**不显示用户名/密码输入框**。请用 **Access Token** 登录：

1. 打开 https://admin.etke.cc/
2. 选择 **「Access Token」** 标签（MAS 下「凭证」可能无用户名密码输入框）
3. 服务器 URL：`http://10.1.1.15:8008`
4. 在部署机执行签发 token：
   ```bash
   cd /root/matrix && ./issue-admin-token.sh admin
   ```
5. 复制输出的 token，粘贴到 Access Token 输入框，点击登录

若使用自托管 synapse-admin 且支持凭证登录，可用：用户名 `admin`、密码（如 `RecoverAdmin123!`）。

## 若 nginx/MAS 显示 unhealthy

容器可能仍正常响应。若需修复健康检查，已将 nginx healthcheck 从 `localhost` 改为 `127.0.0.1`，执行：

```bash
cd /root/matrix
docker compose -f docker-compose.yml -f docker-compose.mas.yml up -d
```
