# 在 10.1.1.15 上通过 SSH 配置 Synapse（反向代理 cosix.junhai.work）

当使用 **cosix.junhai.work → 10.1.1.15:8008** 反向代理时，需在 Synapse 的 `homeserver.yaml` 中为 8008 端口的 listener 开启 `x_forwarded: true`，以便正确记录客户端 IP 和生成 URL。以下为 root 用户 SSH 到 10.1.1.15 后的操作步骤。

## 1. SSH 登录

```bash
ssh root@10.1.1.15
```

## 2. 进入 Matrix 部署目录

若按本仓库 `deploy/matrix` 部署，目录通常为 `/root/matrix`（或你克隆/复制后的路径）：

```bash
cd /root/matrix
# 若目录不同，改为实际路径，例如：cd /opt/matrix
```

## 3. 确认配置文件存在

```bash
ls -la data/homeserver.yaml
```

## 4. 开启 x_forwarded（二选一）

### 方式 A：用 sed 修改（推荐）

将 `listeners` 下端口 8008 对应的 `x_forwarded: false` 改为 `true`（若没有该键则无效果，需用方式 B 手动加）：

```bash
sed -i '/port: 8008/,/resources:/{s/x_forwarded: false/x_forwarded: true/}' data/homeserver.yaml
grep -A 5 'port: 8008' data/homeserver.yaml
# 确认该段内出现 x_forwarded: true；若无，用方式 B 编辑
```

### 方式 B：手动编辑

```bash
nano data/homeserver.yaml
# 或：vi data/homeserver.yaml
```

找到 `listeners:` 中 `port: 8008` 的那一段，在 `type: http` 附近增加或修改为：

```yaml
listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true   # 反向代理时必须为 true
    bind_addresses: ['::']
    resources:
      - names: [client, federation]
        compress: false
```

保存退出。

## 5. 重启 Synapse

```bash
docker compose restart synapse
```

若使用其他 compose 文件名或项目名，例如：

```bash
docker compose -f docker-compose.yml restart synapse
```

## 6. 验证

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8008/health
# 应返回 200

curl -s http://127.0.0.1:8008/_matrix/client/versions
# 应返回 JSON
```

通过代理验证（在本机或能解析 cosix.junhai.work 的机器上）：

```bash
curl -s -o /dev/null -w "%{http_code}" https://cosix.junhai.work/_matrix/client/versions
# 应返回 200（若已配置 HTTPS）
```

## 参考

- 反向代理 Nginx 配置：`docs/nginx-cosix-matrix-reverse-proxy.conf`
- Synapse 官方说明：[Configuring a Reverse Proxy](https://matrix-org.github.io/synapse/latest/reverse_proxy.html)
- 本仓库 Matrix 部署：`deploy/matrix/README.md`
