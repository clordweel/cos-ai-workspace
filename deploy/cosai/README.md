# CosAI Web + API Docker 测试部署

用于在 10.1.1.15 等服务器上做 web（@cosai/web）与 api（@cosai/api）的 Docker 测试部署与镜像打包。数据库、Redis 等公共依赖优先使用远端已有服务，通过环境变量引用。

## 前置

- 本机或 CI：Docker、Docker Compose V2
- 远端机：Docker、Docker Compose V2，可选已有 Redis/PostgreSQL 等

## 从仓库根目录构建并运行

```bash
# 构建镜像
docker compose -f deploy/cosai/docker-compose.yml --project-directory . build

# 启动（会读取 deploy/cosai/.env，可选）
docker compose -f deploy/cosai/docker-compose.yml --project-directory . up -d

# 查看状态
docker compose -f deploy/cosai/docker-compose.yml --project-directory . ps
```

## 环境变量

- 复制 `deploy/cosai/.env.example` 为 `deploy/cosai/.env`，按实际修改。
- **生产环境暂时使用 mock 演示数据**：`CHAT_PROVIDER=mock`（默认）；改为 `matrix` 可接入真实 Matrix 会话。若服务器 `.env` 中曾设 `CHAT_PROVIDER=matrix`，请改为 `mock` 或删除该行以使用默认。
- `API_PUBLIC_ORIGIN`、`FRONTEND_ORIGIN`、`APP_ORIGIN` 建议设为远端访问地址（如 `http://10.1.1.15:3000`）。
- 若使用宿主机或同机已有 Redis/DB，在 `.env` 中设置 `REDIS_URL`、`DATABASE_URL` 等，compose 会传入容器。

## 镜像与 Registry

- 构建后本地镜像：`cosai-web:latest`、`cosai-api:latest`。
- 推送至私有 Registry（见下节）后，网关或它机可通过 `docker pull <registry>:5000/cosai-web:latest` 拉取部署。

## 在 10.1.1.15 上已完成的测试部署

- **Web**：`cosai-web:latest`，映射宿主机 `WEB_PORT`（默认 3001）→ 容器 80。
- **API**：`cosai-api:latest`，映射 `API_PORT`（默认 3000）。
- **Docker Registry**：已在 10.1.1.15 上运行，端口 5000，数据卷 `/opt/registry/data`；宿主机已配置 `insecure-registries: ["10.1.1.15:5000"]`，镜像已推送。

## 在 10.1.1.15 上启动 Docker Registry

调试结束后在同一台机起一个 Docker Registry，供网关服务器拉取镜像：

```bash
# 创建数据目录并启动 Registry（端口 5000）
docker run -d -p 5000:5000 --restart=unless-stopped --name registry \
  -v /opt/registry/data:/var/lib/registry \
  registry:2
```

宿主机若需通过 HTTP 访问本机 Registry，在 `/etc/docker/daemon.json` 增加 `"insecure-registries": ["10.1.1.15:5000"]` 后 `systemctl restart docker`。

网关机拉取镜像前，同样在网关机配置上述 `insecure-registries` 后：

```bash
docker pull 10.1.1.15:5000/cosai-web:latest
docker pull 10.1.1.15:5000/cosai-api:latest
```

推送镜像到 Registry（在 10.1.1.15 构建机执行）：

```bash
docker tag cosai-web:latest 10.1.1.15:5000/cosai-web:latest
docker tag cosai-api:latest 10.1.1.15:5000/cosai-api:latest
docker push 10.1.1.15:5000/cosai-web:latest
docker push 10.1.1.15:5000/cosai-api:latest
```
