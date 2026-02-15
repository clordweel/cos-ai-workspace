# 重构计划：阶段、步骤与技术栈确认

> 原则：**原 frontend、middleware 不移动、不直接改**，仅作参考；在 `apps/` 下**新建**应用（新包名、可更换技术栈）完成重构。技术栈更换需**先讨论确认**后再执行，各阶段设验证点以降低漏检故障。最后更新：2026-02-15。

---

## 一、原则与约束

| 原则 | 说明 |
|------|------|
| **原仓库不动** | `frontend/`（Nuxt/Vue）、`middleware/`（Fastify）保留在根目录，作为**直接参考**与对照，不迁入 apps、不就地重写。 |
| **新建应用** | 重构产物为 **apps/** 下新应用：新包名（后端不再叫 middleware）、可选用新框架与构建工具。 |
| **技术栈先确认** | 涉及框架/UI/后端选型时，**先在本文档或专门讨论中确认**，再进入实现阶段，避免中途大改。 |
| **可介入修复** | 每阶段设**验收/回归步骤**与可观测点（构建、冒烟、接口契约、日志），便于及时发现问题并介入修复。 |

---

## 二、技术栈需先讨论确认的项

以下在动手实现前建议先定案（可在本节直接补充结论或链接到讨论记录）。

### 2.1 前端（React 方向）

| 议题 | 选项 | 待确认 |
|------|------|--------|
| **UI 组件库** | **A. shadcn-ui（React 原生版）**：基于 Radix React + Tailwind，组件拷贝到仓库、可改；与当前 shadcn-vue 语义接近，迁移时 1:1 对照。**B. 纯 Radix UI**：无预设样式，完全自建设计系统。**C. 其他**（如 Chakra、Mantine、Ant Design 等） | 若选 React，推荐 **shadcn-ui 原生版**；是否有更合适选择（如无障碍、主题、维护成本）需确认。 |
| **构建工具** | Webpack 5（与 Element 对齐、matrix-js-sdk CJS 友好） vs Vite（更快，但需维护 optimizeDeps 等） | 已倾向 Webpack；若选 Vite 需明确 matrix-js-sdk 与 WASM 策略。 |
| **状态** | Zustand vs React Context + useReducer vs 其他 | 影响全局 UI、会话、认证等状态形态，建议先定一个主方案。 |
| **认证** | 继续「前端只做跳转 + 后端写 Cookie + GET /api/auth/me」 vs 引入 @logto/react | 当前方案简单且与现网一致；若需前端持 token 再讨论。 |

### 2.2 后端（新应用，新包名）

| 议题 | 选项 | 待确认 |
|------|------|--------|
| **包名** | 不与现有 `ai-workbench-middleware` 混淆，例如：`@cosai/api`、`@cosai/gateway`、`cosai-server` 等 | 需定一个**新包名**及对应目录名（如 `apps/api`、`apps/gateway`）。 |
| **运行时/框架** | **A. 保持 Node.js + Fastify**（与现 middleware 同栈，对照迁移成本低）。**B. Node.js + 其他**（Express、Hono、Nest 等）。**C. 换运行时**（如 Go、Rust、Bun 等） | 换栈需评估：API 契约、Logto/Matrix/cos 等集成、部署与运维。建议先确认「是否必须换栈」及候选范围。 |
| **API 契约** | 与现 middleware 的 `/api/*` 保持兼容（便于前端逐步切流量） vs 新设计一版再提供适配层 | 若保持兼容，可先按现有路由与请求/响应形态对照实现，再逐步优化。 |

### 2.3 共享与 Monorepo

| 议题 | 说明 | 待确认 |
|------|------|--------|
| **packages/** | 已存在 `packages/tsconfig-base`；是否新增 `shared-types`、`eslint-config` 等，供 apps/* 与 frontend、middleware 共用 | 可按阶段引入，先不阻塞。 |
| **契约与类型** | 前后端共享类型（如会话、消息、用户）是否通过 `packages/shared-types` 或 OpenAPI 生成 | 有利于减少漏改，建议在阶段 1 前定方案。 |

### 2.4 技术栈结论（推荐默认，2026-02-15）

以下为阶段 0 执行采用的**推荐默认**，后续若有讨论变更可在此更新。

| 类别 | 结论 | 说明 |
|------|------|------|
| **新后端包名** | `@cosai/api`，目录 `apps/api` | 与现 `ai-workbench-middleware` 区分，后续根脚本 `dev:api`。 |
| **新后端框架** | Node.js + Fastify + TypeScript | 与现 middleware 同栈，便于对照迁移；API 与现 `/api/*` 保持兼容。 |
| **新前端包名** | `@cosai/web`，目录 `apps/web` | 根脚本 `dev:web`。 |
| **新前端框架** | React 18 + TypeScript | 与 REFONTEND_REACT_WEBPACK_MIGRATION 一致。 |
| **新前端构建** | Webpack 5 | matrix-js-sdk CJS 友好；与 Element 对齐。 |
| **新前端 UI** | shadcn-ui（React 原生版） | Radix React + Tailwind，与现 shadcn-vue 语义接近。 |
| **新前端状态** | Zustand | 全局 UI、会话、认证等。 |
| **认证** | 延续「前端跳转 + 后端写 Cookie + GET /api/auth/me」 | 不引入 @logto/react，新后端实现 callback 与 /me。 |
| **packages/** | 阶段 0 仅用现有 `tsconfig-base` | shared-types、eslint-config 按阶段 1 或后续引入。 |

---

## 三、阶段与步骤总览

- **阶段 0**：技术栈确认与脚手架（前端 + 后端新应用占位）。
- **阶段 1**：新后端核心能力（鉴权、/api/auth/me、健康检查），可被新前端或现有前端调用。
- **阶段 2**：新前端壳（布局、路由、认证流、调用新后端），与现有前端功能对照表。
- **阶段 3**：会话与聊天（列表、历史、SSE 流式、Matrix 适配）。
- **阶段 4**：Matrix 实时（Sync、typing、已读、E2EE 等）与新前端集成。
- **阶段 5**：应用区、扩展、设置、任务卡片等补齐与回归。
- **阶段 6**：切换流量、下线旧前端/旧后端（可选）、文档与运维收尾。

每个阶段内：**实现 → 自测/验收 → 记录故障点与回归清单**，再进入下一阶段。

---

## 四、阶段 0：技术栈确认与脚手架

**目标**：技术栈结论落地文档；前端与后端新应用能在仓库中跑通（空壳即可）。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 0.1 | **技术栈确认**：根据 §二 完成讨论，在本文档或 CHANGELOG 中记录结论（前端 UI、构建、后端框架与包名等）。 | 无未决选型再开工。 |
| 0.2 | **新后端脚手架**：在 `apps/` 下创建新目录（如 `apps/api` 或 `apps/gateway`），新包名（如 `@cosai/api`）；选定框架（Fastify 或其他）初始化，健康检查 `GET /health` 可访问。 | `pnpm --filter <新包名> run dev` 能起、/health 返回 200。 |
| 0.3 | **新前端脚手架**：在 `apps/` 下创建新前端（如 `apps/web`），React + 选定构建工具 + 路由占位（/、/space、/logto、/logto-callback），代理 `/api` 到新后端或现 middleware。 | `pnpm --filter <前端包名> run dev` 能起、访问 / 不报错、/api 代理正确。 |
| 0.4 | **根脚本与文档**：根 `package.json` 增加 `dev:api`、`dev:web` 等；`docs/MONOREPO_APPS_PACKAGES.md`、`apps/README.md` 更新为新应用名与职责。 | 从根目录能一条命令起新前端、新后端。 |

**产出**：技术栈结论文档；`apps/<backend>`、`apps/<web>` 可运行；文档与脚本更新。

---

## 五、阶段 1：新后端核心能力

**目标**：新后端提供鉴权与用户信息，与现 middleware 行为可对照；不要求立刻切流量。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 1.1 | **环境与配置**：从工作区根或本应用目录加载 `.env`；配置项与现 middleware 对齐（Logto、Matrix、cos 等），可先实现子集。 | 配置读取正确、无硬编码敏感信息。 |
| 1.2 | **Logto 回调与会话**：实现 `GET /api/auth/logto/callback`、会话存储（内存或与现 middleware 同方案）、写 Cookie；与现 middleware 行为对照。 | 用同一 Logto 应用、同一 redirect_uri 能登录并写 Cookie。 |
| 1.3 | **GET /api/auth/me**：带 Cookie 请求返回 user、userId、preferences、matrixSyncToken、matrix_base_url、matrix_user_id、matrix_device_id 等，与现 middleware 响应结构对齐。 | 现有前端或 Postman 调新后端 /me 能得到与现网一致的可比结构。 |
| 1.4 | **健康与可观测**：`GET /health`、启动/错误日志；可选简单请求日志中间件。 | 便于部署与排错，无敏感信息泄露。 |

**产出**：新后端具备「登录 → 回调 → /me」能力；验收清单与已知差异记录在案。

---

## 六、阶段 2：新前端壳

**目标**：新前端能完成登录流、拿到 /me、展示基础布局与主题，与现有前端行为可对照。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 2.1 | **认证流**：/logto 跳转 Logto；/logto-callback 收 code 后重定向到**新后端** callback；登录后请求新后端 GET /api/auth/me（credentials: 'include'）。 | 能完成登录并拿到 /me 数据；Cookie 域名/路径正确。 |
| 2.2 | **布局**：Workspace 布局（会话区 + 应用区）与 `useWorkspaceLayout` 逻辑对照；主题（浅色/深色）与 `docs/UI_DESIGN_SYSTEM.md` 一致。 | 布局与现前端视觉和断点行为可对照。 |
| 2.3 | **路由**：/、/space、/space/:id、/logto、/logto-callback 占位；未登录时可重定向或展示登录入口。 | 路由与现前端一致，无 404。 |
| 2.4 | **UI 组件**：按确认的 UI 库（如 shadcn-ui React）安装并实现登录页、顶栏、占位内容区；与设计令牌一致。 | 无样式错乱、无障碍基本可用。 |

**产出**：新前端可登录、展示布局与主题；验收清单与已知差异记录。

---

## 七、阶段 3：会话与聊天

**目标**：新后端提供会话列表、历史消息、发消息、SSE 流式；新前端展示列表与聊天并消费 SSE。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 3.1 | **后端适配器**：参考现 `middleware/src/adapters/` 实现会话列表、历史、发消息、SSE 流式（mock 或 matrix）；API 路径与请求/响应与现 middleware 对齐。 | 用现有前端或 Postman 调新后端，行为与现网可对照。 |
| 3.2 | **新前端会话列表与聊天区**：调用新后端 GET /api/sessions、GET /api/sessions/:id/messages、POST /api/chat/stream；展示列表、消息列表、输入框与发送。 | 能创建会话、拉历史、发消息并收到流式回复。 |
| 3.3 | **SSE 与错误**：流式解析、打字机效果、错误态与重试；与现前端 useChatStream 行为对照。 | 流式不卡顿、断线或 4xx/5xx 有明确反馈。 |

**产出**：新前后端完成「会话 + 聊天 + 流式」主路径；回归清单覆盖主要接口与前端状态。

---

## 八、阶段 4：Matrix 实时

**目标**：新前端集成 matrix-js-sdk（Sync、typing、已读、E2EE 等），与新后端下发的 token/baseUrl 配合。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 4.1 | **新后端**：/api/auth/me 继续返回 matrixSyncToken、matrix_base_url、matrix_user_id、matrix_device_id（与现 middleware 一致）。 | 新前端用 /me 能拿到 Matrix 相关字段。 |
| 4.2 | **新前端 Sync**：参考现 `useMatrixSyncClient`，用 React Hooks 包装 matrix-js-sdk；startClient、ClientEvent、RoomEvent、TimelineRefresh、fillMessagesFromSyncTimeline 等。 | 新消息实时、加密房间解密后刷新、typing/已读可用。 |
| 4.3 | **构建**：按确认的构建工具（Webpack）配置 matrix-js-sdk 与 WASM；参考 Element 或官方文档，避免 CJS/WASM 404。 | 开发与生产构建无报错、Sync 正常。 |

**产出**：新前端 Matrix 实时能力与现前端可对照；已知限制（如 Key Backup）记录在案。

---

## 九、阶段 5：应用区、扩展、设置与任务卡片

**目标**：应用区（标签、侧栏、首页/联系人/设置等）、扩展入口、用户偏好、任务卡片（如物料确认）与现前端功能对齐。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 5.1 | **应用区**：标签列表、currentView 切换、侧栏折叠/固定；与 useAppView、useWorkspaceLayout 行为对照。 | 布局与交互与现前端一致。 |
| 5.2 | **设置与偏好**：PATCH /api/auth/me/preferences、主题/字体/通知等；与 useUserPreferences 对照。 | 修改偏好后刷新或新开 tab 仍生效。 |
| 5.3 | **任务卡片**：物料确认等卡片与 POST /api/material/confirm 等接口；与现前端 TaskCard 对照。 | 确认流程与错误态完整。 |
| 5.4 | **扩展**：应用扩展注册与入口；与 useAppExtensions 对照。 | 扩展列表与打开行为一致。 |

**产出**：新前端功能与现前端可逐项对照；回归清单覆盖应用区与扩展。

---

## 十、阶段 6：切换与收尾

**目标**：可选切换流量至新前后端；文档与运维就绪；原 frontend、middleware 保留作参考或只读。

| 步骤 | 内容 | 验收 / 故障点 |
|------|------|----------------|
| 6.1 | **契约与回归**：整理新后端与现 middleware 的 API 差异；全量回归（登录、会话、流式、Matrix、设置、任务卡片）。 | 无 P0/P1 遗漏。 |
| 6.2 | **切换**：若需切流量，通过路由/反向代理或前端入口将请求指到新应用；保留回滚方式。 | 回滚步骤明确且演练过。 |
| 6.3 | **文档**：ARCHITECTURE、PROJECT_STATUS、FRONTEND_SPEC、API_SPEC 等更新为新应用名与路径；CHANGELOG 记录切换与下线项。 | 新人能按文档跑通新前后端。 |

**产出**：可选的流量切换；文档与运维更新；原应用保留不删。

---

## 十一、故障点与可介入修复

为减少「重构中错过故障点导致无法及时介入」：

| 措施 | 说明 |
|------|------|
| **每阶段验收** | 每阶段结束前做步骤内验收（见各阶段表格），不通过不进入下一阶段。 |
| **契约对齐** | 新后端与现 middleware 的 API 路径、请求/响应结构保持可对照；差异列在文档或 ADR 中。 |
| **回归清单** | 在 `docs/` 或 `.cursor/plans/` 维护「重构回归清单」（登录、/me、会话 CRUD、流式、Matrix Sync、设置、任务卡片等），每阶段更新并勾选。 |
| **日志与健康** | 新后端具备 /health、请求日志、错误日志；新前端关键路径有错误态与用户提示。 |
| **技术栈先确认** | §二 中选项在阶段 0 完成确认并记录，避免实现到一半换栈或换 UI 库。 |

---

## 十二、相关文件

| 文件 | 说明 |
|------|------|
| `docs/FRONTEND_REACT_WEBPACK_MIGRATION.md` | 前端 Vue→React+Webpack 迁移范围与建议（可对应 apps/web）。 |
| `docs/MONOREPO_APPS_PACKAGES.md` | apps/、packages/ 与现有 frontend、middleware 的关系。 |
| `docs/MATRIX_JS_SDK_RESEARCH.md` | matrix-js-sdk 困境与参考（构建、类型、E2EE）。 |
| `docs/UI_DESIGN_SYSTEM.md` | 设计令牌与组件约定（新前端需遵循）。 |
| `middleware/` | 现有中间层，**仅作参考**，不修改。 |
| `frontend/` | 现有前端，**仅作参考**，不修改。 |
