# 反向代理同域部署：中间层对用户不可见

通过反向代理把**前端**和**中间层**都挂在**同一主域名**下，用户始终只看到前端地址；Logto 回调地址也使用该主域名下的 `/api/auth/logto/callback`，无需暴露中间层域名或端口。

---

## 1. 架构示意

```
用户浏览器
    ↓ 始终访问 https://your-app.com
反向代理（Nginx / Caddy / 等）
    ├── /          → 前端（Nuxt，如 3001）
    └── /api       → 中间层（Fastify，如 3000）

Logto 回调：https://your-app.com/api/auth/logto/callback  → 代理到中间层
```

- 用户打开 `https://your-app.com` → 前端。
- 点击「登录」→ 跳转 `https://your-app.com/api/auth/logto`（同源）→ 代理转发到中间层 → 中间层 302 到 Logto。
- Logto 登录后重定向到 `https://your-app.com/api/auth/logto/callback?code=...`（同源）→ 代理转发到中间层 → 中间层换 token、写 Cookie、302 到 `https://your-app.com/space?auth=ok`。
- Cookie 的域为 `your-app.com`，前后端同域，后续请求自动带 Cookie。

---

## 2. 反向代理配置要点

代理必须把**原始请求的协议和主机**传给中间层，否则中间层无法拼出正确的 Logto `redirect_uri`。

### 2.1 Nginx 示例

```nginx
server {
    listen 443 ssl;
    server_name your-app.com;

    # 前端（Nuxt）
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 中间层（Fastify）：必须传递 X-Forwarded-Proto / X-Forwarded-Host
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        # SSE 等长连接
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

关键：`X-Forwarded-Proto`、`X-Forwarded-Host` 让中间层用 `https://your-app.com` 拼出 `redirect_uri` 和回调后跳转的前端地址。

### 2.2 Caddy 示例

```caddy
your-app.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:3000 {
            header_up X-Forwarded-Host {host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    handle {
        reverse_proxy 127.0.0.1:3001
    }
}
```

---

## 3. 环境变量（同域部署）

| 变量 | 说明 | 同域推荐 |
|------|------|----------|
| **前端** `NUXT_PUBLIC_API_BASE` | API 基址，空则用相对路径 `/api` | **留空**，请求走同源 `/api`，由代理转发 |
| **中间层** `MIDDLEWARE_PUBLIC_ORIGIN` | 拼 Logto redirect_uri 的根地址 | 可选。设为 `https://your-app.com` 更稳；不设则依赖代理传来的 X-Forwarded-* |
| **中间层** `FRONTEND_ORIGIN` | 回调后 302 到前端的地址 | **可不设**。未设且请求带 X-Forwarded-Host 时，会用 `https://your-app.com` 作为回调后跳转地址 |
| **中间层** `PORT` | 中间层监听端口 | 如 3000（仅本机被代理访问） |

总结：同域且代理正确设置 `X-Forwarded-Proto`、`X-Forwarded-Host` 时，可不设 `FRONTEND_ORIGIN`；若希望不依赖请求头，可设 `MIDDLEWARE_PUBLIC_ORIGIN=https://your-app.com`。

---

## 4. Logto 控制台配置

**方式 A：Nuxt 承载 Logto（推荐）**  
前端发起登录并接收回调，Redirect URI 填**前端主地址**下的回调路径：

- `https://your-app.com/logto-callback`
- 本地开发：`http://localhost:3001/logto-callback`

配置前端环境变量 `NUXT_PUBLIC_LOGTO_ENDPOINT`、`NUXT_PUBLIC_LOGTO_APP_ID`（与中间层 LOGTO_ENDPOINT、LOGTO_APP_ID 一致）；中间层仍配置 LOGTO_APP_SECRET 用于 code 换 token。用户全程只接触前端域名。

**方式 B：中间层直接回调**  
Redirect URI 填中间层在该域名下的回调地址（与拼出的地址完全一致）：

- `https://your-app.com/api/auth/logto/callback`

不要填中间层直连地址（如 `http://localhost:3000/...`），否则同域部署下会报 `invalid_redirect_uri`。

---

## 5. Cookie 与同源

- 用户访问的一直是 `https://your-app.com`，回调请求也是 `https://your-app.com/api/auth/logto/callback`，中间层通过代理看到的 Host 为 `your-app.com`，Set-Cookie 的域即为该主机。
- 前端页面与接口同域，`credentials: 'include'` 会正常带 Cookie，无需额外设置 Cookie 的 domain。

---

## 6. 小结

| 目标 | 做法 |
|------|------|
| 中间层对用户不可见 | 仅暴露同一主域名，`/api` 由反向代理转发到中间层 |
| 回调地址走「前端主地址」 | redirect_uri 使用 `https://主域名/api/auth/logto/callback`，在 Logto 中注册该地址 |
| 代理需传递 | `X-Forwarded-Proto`、`X-Forwarded-Host`（建议同时设 `X-Forwarded-Host`） |
| 前端 API 基址 | 同域时 `NUXT_PUBLIC_API_BASE` 留空，使用相对路径 `/api` |

按上述方式配置后，用户全程只接触主域名，中间层不暴露。
