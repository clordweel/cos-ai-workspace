# Redis 部署（中间层会话持久化）

为中间层提供 Redis 作为会话存储后端，实现重启后保持登录、多实例共享会话。见 `docs/SESSION_PERSISTENCE.md`。

## 前置

- Docker 与 Docker Compose（V2）

## 快速部署

```bash
cd deploy/redis
cp .env.example .env   # 可选：设置 REDIS_PASSWORD、REDIS_PORT
docker compose up -d
```

## 中间层配置

在 `.env` 中：

- `SESSION_STORE=redis`
- `REDIS_URL=redis://<host>:6379`（无密码）或 `redis://:password@host:6379`（有密码）

示例（同机）：`REDIS_URL=redis://localhost:6379`  
示例（远端）：`REDIS_URL=redis://10.1.1.15:6379`

## 管理

- 状态：`docker compose ps`
- 日志：`docker compose logs -f redis`
- 重启：`docker compose restart redis`
