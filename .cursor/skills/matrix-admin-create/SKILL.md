---
name: matrix-admin-create
description: 在已部署的 Synapse 上创建管理员用户并输出账号与密码。当用户要求创建 Matrix 管理员、新建 Synapse 管理员账号、或需要管理员 MXID 与密码时使用。
---

# 创建 Matrix Synapse 管理员

在目标 Synapse 服务器上临时启用 `registration_shared_secret`，用 `register_new_matrix_user` 创建管理员用户，再移除 secret 并重启，保证安全。

## 前置条件

- Synapse 已部署且可访问（如 `http://<host>:8008`）
- 有 SSH 登录目标机权限，且 Synapse 以 Docker 运行（如 `matrix-synapse-1` 或 `synapse` 容器名）
- 配置目录可写（如目标机 `/root/matrix/data/homeserver.yaml`）

## 步骤（在目标机上或通过 SSH 执行）

1. **生成共享密钥与管理员密码**（仅用于本次注册）：
   ```bash
   SHARED_SECRET=$(openssl rand -base64 32)
   ADMIN_PASS=$(openssl rand -base64 16)
   ```

2. **在 homeserver.yaml 首行后插入** `registration_shared_secret: "<SHARED_SECRET>"`（YAML 顶层，与 `server_name` 同级），保存后重启 Synapse：
   ```bash
   docker compose -f /root/matrix/docker-compose.yml restart synapse
   ```
   等待约 15 秒使服务就绪。

3. **创建管理员用户**（用户名如 `admin`，MXID 为 `@admin:<server_name>`）：
   ```bash
   docker compose -f /root/matrix/docker-compose.yml exec -T synapse \
     register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008 \
     -u admin -p "$ADMIN_PASS" -a
   ```
   看到 `Success!` 即创建成功。

4. **移除共享密钥并重启**：
   ```bash
   sed -i "/registration_shared_secret/d" /root/matrix/data/homeserver.yaml
   docker compose -f /root/matrix/docker-compose.yml restart synapse
   ```

5. **输出给用户**：
   - **MXID**：`@admin:<SYNAPSE_SERVER_NAME>`（如 `@admin:10.1.1.15`）
   - **密码**：上一步使用的 `$ADMIN_PASS`
   - **Homeserver URL**：`http://<host>:8008`

## 说明

- 若 compose 或数据目录路径不同，将 `/root/matrix` 与容器名替换为实际路径。
- 创建后可将 MXID 与密码写入项目 `.env`（如 `MATRIX_USER_ID`、`MATRIX_PASSWORD`）供中间层使用。
