# AI 驱动交互工作台 — 项目总览

## 项目定位

为**无 IT 经验的普通员工**提供极简的 ERPNext 交互体验，面向**制造业**。  
前端与 Frappe/ERPNext 解耦，通过 **Dify** 或 **Node.js 中转层**进行安全、流式交互。

---

## 技术栈（Headless 架构）

| 层级 | 技术选型 | 职责 |
|------|----------|------|
| **前端** | Vue 3 + Nuxt 3 + Tailwind CSS + Shadcn-vue | 对话流 + 任务卡片，极简深色 UI |
| **跨端** | Tauri (Desktop) + Capacitor (Mobile/PWA) | 桌面与移动端封装 |
| **AI 引擎** | Dify (API) | Workflows、知识库、对话与意图识别 |
| **ERP 后端** | ERPNext v16 | Headless 模式，仅通过 REST API + 自定义 App **cos** |
| **中间层** | Node.js (Fastify) | SSE 流式输出、API 编排、鉴权与安全校验 |

---

## 核心要求

1. **极致性能**：必须支持 **SSE 流式输出**，杜绝卡顿感。
2. **「去 ERP 化」UX**：界面极简、抽象、深色模式；严禁传统密集表格，采用**对话流 + 任务卡片**。
3. **业务能力**：
   - **物料参数化助手**：调用 cos App 接口，根据 AI 识别的参数（模数、材质等）自动生成物料。
   - **生产辅助**：实时查询订单进度、库存状态（球磨机零件、BOM 状态）。
4. **解耦与安全**：前端不直连 Frappe，经 Dify 或 Node.js 中转；写入前需 **AI 确认** 或 **严格权限校验**。

---

## 开发原则

- **API-First**：优先定义并实现 cos App 的 RESTful 接口。
- **Stream-Oriented**：所有 AI 对话必须实现**打字机流式**效果（SSE）。
- **Safety**：调用 ERPNext 写入接口前，必须有 AI 确认环节或严格权限校验。

---

## 仓库/目录结构

```
workspace/
├── README.md                  # 工作区说明、多项目启动方式
├── PROJECT.md                 # 本文件
├── package.json               # 根脚本：pnpm dev / dev:frontend / dev:middleware
├── .env.example               # 环境变量示例
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md        # 架构与数据流
│   ├── API_SPEC.md            # cos App RESTful API 规范
│   ├── FRONTEND_SPEC.md       # 前端规范
│   └── STREAM_AND_SAFETY.md   # 流式与安全规范
├── frontend/                  # Nuxt 3 + Tailwind，对话流 + 任务卡片
│   ├── app.vue, nuxt.config.ts, layouts/, pages/
│   ├── components/            # ChatMessageBubble, ChatFlow, TaskCard/*
│   └── composables/           # useChatStream.ts
├── middleware/                # Node.js (Fastify) SSE + 编排
│   └── src/index.js
├── cos/                       # Frappe 自定义 App 说明与占位（见 cos/README.md）
│   └── README.md
└── dify/                      # 可选：Dify 工作流/知识库配置导出
```

---

## 下一步

1. 阅读 `docs/ARCHITECTURE.md` 了解整体数据流。
2. 按 `docs/API_SPEC.md` 在 **cos** App 中实现并暴露接口。
3. 在 **middleware** 中实现 SSE 代理与 Dify/ERP 编排。
4. 在 **frontend** 中实现对话流 + 任务卡片 UI，消费 SSE。
