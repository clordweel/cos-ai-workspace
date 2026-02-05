# AI 驱动交互工作台 — 工作区

本工作区包含**多个子项目**，统一在此目录下开发与联调。

---

## 目录结构

| 目录 | 说明 | 技术栈 |
|------|------|--------|
| **frontend** | 前端应用（对话流 + 任务卡片） | Nuxt 3, Vue 3, Tailwind, Shadcn-vue |
| **middleware** | 中间层（SSE 流式、API 编排） | Node.js, Fastify |
| **cos** | Frappe 自定义 App（物料/生产 API） | Frappe, ERPNext v16 |
| **docs** | 架构与 API 文档 | — |

详细架构见 [PROJECT.md](./PROJECT.md) 与 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

---

## 环境准备

1. **Node.js** 18+（frontend、middleware）
2. **pnpm** 或 **npm**（推荐 pnpm）
3. **ERPNext v16 + cos** 部署在可访问的服务器或本地 bench
4. **Dify** 实例（API Key 用于对话流）

复制环境变量并按需修改：

```bash
cp .env.example .env
# 编辑 .env，填写 DIFY_API_BASE、DIFY_API_KEY、COS_ERP_BASE 等
```

---

## 启动各项目

### 方式一：根目录脚本（推荐）

```bash
# 安装根依赖 + 各子项目依赖
npm run install:all

# 并行启动中间层 + 前端（开发）
npm run dev
```

### 方式二：按子项目分别启动

```bash
# 中间层（默认 http://localhost:3000）
cd middleware && npm install && npm run dev

# 前端（默认 http://localhost:3001；需配置 NUXT_PUBLIC_API_BASE 或代理到中间层）
cd frontend && npm install && npm run dev
```

**cos** 为 Frappe App，需在 ERPNext bench 环境中安装与运行，见 [cos/README.md](./cos/README.md)。

---

## 开发顺序建议

1. **middleware**：先打通 Dify SSE 代理与健康检查。
2. **frontend**：对接 `/api/chat/stream`，实现打字机效果与任务卡片占位。
3. **cos**：按 [docs/API_SPEC.md](./docs/API_SPEC.md) 实现只读接口与物料草稿/写入接口。
4. 联调：前端 → 中间层 → Dify + cos。
