# API 包本地验证脚本

本目录用于 **仅限本地** 验证 api 包接口的测试脚本，**禁止在 CI 或生产环境执行**。

## 约定

- **用途**：本地开发时快速验证接口行为（如健康检查、会话列表、流式回复等）。
- **运行方式**：在 `apps/api` 目录下用 `pnpm run script:xxx` 或 `npx tsx scripts/xxx.ts`，依赖本包 `.env` 或脚本内说明的环境变量。
- **认证**：
  - **无需认证的接口**（如 `GET /health`）：直接请求即可。
  - **需要认证的接口**：允许以下任一方式：
    1. **绕过**：在脚本内使用 mock 数据或本地仅有的测试 token，**不得提交真实 token/密码**。
    2. **明确需求提示**：在脚本顶部或 README 中写明「需登录后从浏览器 DevTools 复制 Cookie」或「需设置环境变量 `AUTH_SESSION_COOKIE=auth_session=xxx`」，便于他人本地复现。
- **敏感信息**：脚本中不得硬编码真实 Cookie、token、密码；若需本地覆盖，使用环境变量并在本 README 或脚本注释中说明。

## 环境变量（脚本常用）

| 变量 | 说明 | 示例 |
|------|------|------|
| `API_BASE_URL` | 待测 API 根地址（脚本用，与 api 包 `.env` 中的 `API_PORT` 对应） | `http://localhost:3000` |
| `AUTH_SESSION_COOKIE` | 可选。用于需登录的接口，值为完整 Cookie 字符串 | `auth_session=xxx`（从浏览器复制） |

## 已有脚本

- `local-health.ts` — 请求 `GET /health`，无需认证。
- `local-auth-me.ts` — 请求 `GET /api/auth/me`，需 Cookie；未设置 `AUTH_SESSION_COOKIE` 时仅打印需求提示。
- `debug-dify-stream.ts` — 直接请求 Dify 流式接口，打印原始 chunk 与结构化解析结果（thinking / answer），用于格式解析调试。需 `DIFY_API_KEY`（及可选 `DIFY_API_BASE`）；可选 `DEBUG_DIFY_QUERY` 覆盖默认问题（默认「自我介绍。」）。

## 运行前

确保 api 服务已启动（如 `pnpm run dev`），或 `API_BASE_URL` 指向已运行实例。
