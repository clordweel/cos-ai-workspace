# AI 驱动交互工作台 — 项目总览

## 项目定位

为**无 IT 经验的普通员工**提供极简的 ERPNext 交互体验，面向**制造业**。  
前端与 Frappe/ERPNext 解耦，通过 **Node.js 中间层**（适配器 + Logto 鉴权）进行安全、流式交互。

---

## 技术栈（Headless 架构）

| 层级 | 技术选型 | 职责 |
|------|----------|------|
| **前端** | Vue 3 + Nuxt 3 + Tailwind CSS + Shadcn-vue | 对话流 + 任务卡片，极简浅色 UI；认证仅 Logto |
| **跨端** | Tauri (Desktop) + Capacitor (Mobile/PWA) | 桌面与移动端封装 |
| **AI/聊天** | 适配器（mock / matrix，可扩展 Dify） | 会话与流式消息经中间层适配器；Dify 可选由适配器或编排调用 |
| **ERP 后端** | ERPNext v16 | Headless 模式，仅通过 REST API + 自定义 App **cos** |
| **中间层** | Node.js (Fastify) + TypeScript | SSE 流式、适配器、Logto 鉴权、cos/物料/诊断编排 |

---

## 核心要求

1. **极致性能**：必须支持 **SSE 流式输出**，杜绝卡顿感。
2. **「去 ERP 化」UX**：界面极简、抽象，支持浅色/深色；严禁传统密集表格，采用**对话流 + 任务卡片**。
3. **业务能力**：
   - **物料参数化助手**：调用 cos App 接口，根据 AI 识别的参数（模数、材质等）自动生成物料。
   - **生产辅助**：实时查询订单进度、库存状态（球磨机零件、BOM 状态）。
4. **解耦与安全**：前端不直连 Frappe/Dify，经中间层中转；认证唯一入口为 **Logto**；写入前需 **AI 确认** 或 **严格权限校验**。

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
├── package.json               # 根脚本：pnpm workspace，dev / dev:frontend / dev:middleware
├── .env.example               # 环境变量示例（CHAT_PROVIDER、Logto、Matrix、cos）
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md        # 架构与数据流
│   ├── API_SPEC.md            # cos App RESTful API 规范
│   ├── FRONTEND_SPEC.md       # 前端规范
│   ├── STREAM_AND_SAFETY.md   # 流式与安全规范
│   ├── CONFIG_AND_AUTH_RESEARCH.md  # 配置与认证方案研究
│   └── …                      # 其它设计/会话/认证文档
├── frontend/                  # Nuxt 3 + Tailwind + Shadcn-vue，对话流 + 任务卡片
│   ├── app.vue, nuxt.config.ts, layouts/, pages/
│   ├── pages/logto.vue, logto-callback.vue  # Logto 登录与回调（前端承载时）
│   ├── components/            # SessionList*, ChatMessageBubble, ChatInputPanel, AppPanel, TaskCard/*, space/*
│   ├── composables/          # useChatStream, useChatSessions, useAppView, useAuth, useWorkspaceLayout, usePermissions…
│   └── types/app-extensions.ts
├── middleware/                # Node.js (Fastify) TypeScript，SSE + 适配器 + 编排
│   └── src/
│       ├── index.ts, config.ts
│       ├── adapters/         # mock, matrix（聊天后端适配器）
│       ├── routes/           # auth, chat, material, diagnostics, health, options
│       └── services/         # auth, difyStream, cosClient, exportMarkdown
├── cos/                       # Frappe 自定义 App 说明与占位（见 cos/README.md）
│   └── README.md
└── logs/CHANGELOG.md          # 开发变更记录
```

---

## 下一步

1. 阅读 `docs/PROJECT_STATUS.md` 了解多维度当前状态；阅读 `docs/ARCHITECTURE.md` 了解整体数据流。
2. 按 `docs/API_SPEC.md` 在 **cos** App 中实现并暴露接口。
3. 在 **middleware** 中维护/扩展聊天适配器与 SSE、Logto 与 cos 编排。
4. 在 **frontend** 中实现对话流 + 任务卡片 UI，消费 SSE；认证仅 Logto。
