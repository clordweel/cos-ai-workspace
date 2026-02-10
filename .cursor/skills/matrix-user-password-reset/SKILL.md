---
name: matrix-user-password-reset
description: 使用 Synapse 管理员账号通过 Admin API 重置指定 Matrix 用户的密码。当用户要求重置某 MXID 的密码、或提供管理员凭证并指定要重置的用户时使用。
---

# 重置 Matrix 用户密码

使用管理员账号登录获取 `access_token`，再调用 Synapse Admin API 的 `PUT /_synapse/admin/v2/users/<user_id>` 更新该用户密码。密码不可被「查询」，只能被「重置」。

## 前置条件

- Synapse 可访问（如 `http://<host>:8008`）
- 拥有管理员 MXID 与密码（如项目 `.env` 中的 `MATRIX_USER_ID`、`MATRIX_PASSWORD`）
- 目标用户的完整 MXID（如 `@bm3bzjhdyhon:10.1.1.15`）

## 步骤

1. **管理员登录获取 access_token**：
   ```bash
   curl -s -X POST 'http://<host>:8008/_matrix/client/v3/login' \
     -H 'Content-Type: application/json' \
     -d '{"type":"m.login.password","identifier":{"type":"m.id.user","user":"<admin_localpart>"},"password":"<admin_password>"}'
   ```
   从返回 JSON 中取出 `access_token`。`admin_localpart` 为 MXID 的本地部分（如 `admin`），不要带 `@` 和域名。

2. **生成新密码并调用 Admin API**：
   ```bash
   NEW_PASS=$(openssl rand -base64 16)
   curl -s -X PUT "http://<host>:8008/_synapse/admin/v2/users/<目标用户完整MXID>" \
     -H "Authorization: Bearer <access_token>" \
     -H "Content-Type: application/json" \
     -d "{\"password\":\"$NEW_PASS\"}"
   ```
   返回 HTTP 200 且 body 为对应用户信息即成功。

3. **将新密码交给用户**：输出 `NEW_PASS`，并提醒用户登录后可在客户端内自行修改密码。

## 在部署机上通过 SSH 一键执行示例

若管理员为 `@admin:10.1.1.15`、密码在 `.env`，目标用户为 `@bm3bzjhdyhon:10.1.1.15`，可在**部署机**上执行（host 用 `127.0.0.1`）：

```bash
NEW_PASS=$(openssl rand -base64 16)
TOKEN=$(curl -s -X POST 'http://127.0.0.1:8008/_matrix/client/v3/login' \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","identifier":{"type":"m.id.user","user":"admin"},"password":"<MATRIX_PASSWORD>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
curl -s -X PUT 'http://127.0.0.1:8008/_synapse/admin/v2/users/@bm3bzjhdyhon:10.1.1.15' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$NEW_PASS\"}"
echo "NEW_PASSWORD=$NEW_PASS"
```

将 `<MATRIX_PASSWORD>` 替换为实际管理员密码；若通过 SSH 执行，在单引号内传入密码避免 shell 转义问题。

## 说明

- 重置后该用户所有设备会下线（Synapse 默认 `logout_devices: true`）；可选在 body 中加 `"logout_devices": false` 保持部分会话。
- 管理员必须已在 Synapse 中具有 admin 权限（如通过 `register_new_matrix_user -a` 创建）。
