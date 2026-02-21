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
| **中间层** | Node.js (Fastify) + TypeScript | SSE 流式、适配器、Logto 鉴权、cos/物料编排 |

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
│   ├── PROJECT_STATUS.md      # 多维度当前状态（推荐先读）
│   ├── API_SPEC.md、FRONTEND_SPEC.md、STREAM_AND_SAFETY.md 等
│   └── archive/               # 研究/选型与 MAS 归档
├── apps/web/                  # 当前前端（React + Webpack）
├── apps/api/                  # 当前中间层（Fastify），SSE + Matrix 适配器 + 编排
├── frontend/                  # 【已废弃】Nuxt 3 旧前端，请勿修改或引用；由 apps/web 替代
├── middleware/                # 【已废弃】旧中间层，请勿修改或引用；由 apps/api 替代
├── cos/                       # Frappe 自定义 App 说明与占位（见 cos/README.md）
│   └── README.md
└── logs/CHANGELOG.md          # 开发变更记录
```

---

## 下一步

1. 先读 `docs/PROJECT_STATUS.md`、`docs/ARCHITECTURE.md`；Agent 见 `AGENTS.md`。
2. 中间层：适配器（mock/matrix）、Logto 与 cos 编排；前端：对话流 + 任务卡片，认证仅 Logto。
3. cos 按 `docs/API_SPEC.md` 暴露接口。
