# 会话部分「后端支持服务选择」调研报告

> 本报告在**不修改代码与配置**的前提下，梳理当前会话相关后端与「服务选择」的现状，并给出若支持「会话/请求级服务选择」时的后端需求与可选方案。需求理解与调研范围见项目内调研计划文档。

---

## 一、现状梳理（2.1）

### 1.1 会话相关接口与数据流

| 能力 | 接口 | 适配器能力 | 由谁决定使用哪个后端 |
|------|------|------------|------------------------|
| **流式发送** | `POST /api/chat/stream` | `adapter.streamMessage()`（需 `supportsStreaming()`） | 启动时 `config.chat.provider`，全请求共用同一适配器 |
| **会话列表** | `GET /api/sessions` | `adapter.listSessions()`（需 `supportsListSessions()`） | 同上 |
| **会话历史** | `GET /api/sessions/:id/messages` | `adapter.listMessages()`（需 `supportsListMessages()`） | 同上 |
| **导出 Markdown** | `POST /api/chat/export-markdown` | 无（中间层 `messagesToMarkdown`，不经过适配器） | 与聊天后端无关 |

- **流式发送**：请求体仅含 `message`、`conversation_id`、`user_id`；路由内调用 `getChatAdapter()` 取得**当前全局**适配器后执行 `streamMessage`，不根据会话或请求参数选择不同适配器或实例。
- **会话列表 / 会话历史**：同样每次请求都通过 `getChatAdapter()` 取同一适配器；不支持时返回 501，前端静默降级（见 `useChatSessionsApi`）。
- **结论**：会话相关能力中，除导出 Markdown 外，其余三项均由**同一** `config.chat.provider` 决定的**唯一**适配器提供；不存在按会话或按请求切换后端的能力。

### 1.2 配置现状：CHAT_PROVIDER 与 Dify

- **CHAT_PROVIDER**  
  - 文档与测试中使用的环境变量名为 **`CHAT_PROVIDER`**（见 [middleware/README.md](middleware/README.md)、[.env.example](.env.example)、`package.json` 的 test 脚本）。  
  - 中间层通过 `config.chat.provider` 读取，默认 `mock`；合法值为当前已注册的 adapter 名（如 `mock`；`dify`、`zulip`、`matrix` 为预留，当前仅 mock 已实现并注册）。  
  - **服务选择**仅发生在**部署/配置层**：运维通过设置 `CHAT_PROVIDER` 在进程启动时选定「本实例」使用的唯一聊天后端，所有会话、所有用户共用该后端。

- **Dify 相关环境变量**  
  - `DIFY_API_BASE`：默认 `https://api.dify.ai/v1`。  
  - `DIFY_API_KEY`：Dify 应用 API Key。  
  - 当前 config 仅暴露**单组** `dify.apiBase` + `dify.apiKey`，即**单 Dify 应用**；代码与文档中**无**多 Dify 应用、多 API Key 的配置形态（无命名 id、无多组 apiBase/apiKey 列表）。

- **多 Dify 应用 / 多 Key**  
  - **当前不存在**。若要支持「同一部署下多个 Dify 应用或多种 Key」，需新增配置结构与路由逻辑（见第二节）。

### 1.3 小结（现状）

- **谁选**：运维（或部署配置）。  
- **何时选**：进程启动时，通过环境变量写入 `config.chat.provider`。  
- **粒度**：**环境/进程级**，全请求、全会话共用同一 provider；请求体与会话模型中**无**「目标服务/provider/应用 id」等字段参与路由。  
- **NormalizedSession.provider**：表示「该会话来自哪个后端」的元数据，用于展示与 `backendSessionId` 映射，**不参与**「本次请求走哪个后端」的决策。

---

## 二、若支持「会话/请求级服务选择」的后端需求（2.2）

### 2.1 数据与契约

- **请求/会话如何携带「目标服务」**  
  - 需要在**流式发送**与**会话列表/历史**的请求中明确「本次请求/该会话」使用的后端（或后端实例）。  
  - 建议至少包含：  
    - **provider**（类型）：`dify` | `mock` | `zulip` | `matrix` 等，用于选择适配器类型。  
    - **backend_app_id**（或等价物，可选）：同一 provider 下多实例时标识「哪个 Dify 应用 / 哪组配置」。  
  - **流式发送**：在 `POST /api/chat/stream` 的 Body 中增加字段，例如 `provider?`、`backend_app_id?`；若省略则回退为当前全局 `config.chat.provider`（兼容现有前端）。  
  - **会话列表**：`GET /api/sessions` 可通过 query 增加 `provider?`、`backend_app_id?`，表示只拉取该后端（或该应用）下的会话；若省略则使用全局 provider。  
  - **会话历史**：`GET /api/sessions/:id/messages` 的 `id` 已唯一标识会话；若会话元数据中持久化了「创建时用的 provider + backend_app_id」，中间层可根据会话 id 解析出应使用的适配器/实例，或仍由前端在 query 中带上 `provider?`、`backend_app_id?` 以显式指定。

- **NormalizedSession / 请求体**  
  - **NormalizedSession**：建议增加可选字段，例如 `backendAppId?: string`，表示该会话归属的「后端应用/实例」；现有 `provider` 已可表示类型。  
  - **请求体**：如上，流式与列表/历史接口需支持可选 `provider`、`backend_app_id`（或统一命名为 `backend_app_id`），以便路由到正确适配器或实例。

- **多 Dify 应用时的配置形态**  
  - 方案一：**多组并列配置**，例如 `dify.apps` 数组，每项为 `{ id: string, apiBase: string, apiKey: string }`，`id` 即 `backend_app_id`。  
  - 方案二：**前缀/命名环境变量**，例如 `DIFY_APP_<id>_API_BASE`、`DIFY_APP_<id>_API_KEY`，由配置加载时解析为 map。  
  - 无论哪种，中间层均需「按 backend_app_id 取对应 apiBase/apiKey」的逻辑，并注入到 Dify 适配器或其实例中。

### 2.2 中间层路由

- **解析「目标服务」**  
  - 从请求体（流式）或 query（列表/历史）或从「会话 id → 会话元数据」中解析出 `provider` 与可选的 `backend_app_id`。  
  - 若未传则使用 `config.chat.provider` 与默认实例（当前行为），保证兼容。

- **选择适配器或实例**  
  - **按 provider**：通过现有 `getChatAdapter(provider)` 或新增 `getChatAdapterByProvider(provider)` 取得对应类型的适配器（需扩展注册表，支持按 name 取）。  
  - **同 provider 多实例**：若为「单适配器 + 多配置」（见 2.3），则根据 `backend_app_id` 取对应配置再调用同一适配器；若为「多适配器实例」，则需按 `backend_app_id` 映射到具体实例再调用。

- **与鉴权、user_id 的配合**  
  - 鉴权与 `user_id` 保持不变：仍由中间层从 Cookie/Header 解析用户，或使用请求中的 `user_id`（若未登录）；「目标服务」仅用于选择后端，不替代身份校验。  
  - 若未来做权限控制（如「仅部分用户可用某 Dify 应用」），可在解析出 `provider` + `backend_app_id` 后增加一层校验，再继续路由。

### 2.3 适配器扩展

- **同一 provider 多实例（如多 Dify 应用）**  
  - **方案 A：单适配器 + 多配置**  
    - Dify 适配器保持单份实现；config 中维护多组 `{ id, apiBase, apiKey }`。  
    - 路由层根据 `backend_app_id` 选出配置，将对应 `apiBase`/`apiKey` 以参数形式传入 `streamMessage` / `listSessions` / `listMessages`（或适配器内部根据传入的 `backendAppId` 自取配置）。  
    - 优点：实现简单，无需为每个实例建适配器实例。  
  - **方案 B：多适配器实例**  
    - 启动时为每个 Dify 应用创建一个适配器实例（或工厂返回「带绑定配置」的闭包），注册到按 `backend_app_id` 的 map；路由时按 `backend_app_id` 取实例再调用。  
    - 优点：隔离清晰；缺点：注册与生命周期稍复杂。

- **listSessions / listMessages 的隔离**  
  - 每个 Dify 应用有独立的 conversation 与 message 空间，因此 `listSessions`、`listMessages` 必须按「当前选中的 Dify 应用」调用对应 apiBase/apiKey，否则会串会话。  
  - 即：**按应用/按会话归属隔离**是硬性要求；无论采用「单适配器+多配置」还是「多实例」，调用 Dify API 时都必须使用该会话所属应用的凭证。

### 2.4 与现有文档的衔接

- **SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md**  
  - 已描述「多后端并存」可在配置中为「当前空间」选一个 provider，并提到若未来需多 tab/多空间用不同后端可扩展为「按空间/会话类型选 adapter」。  
  - 本调研的「会话/请求级服务选择」即该扩展的具化：按**会话或请求**携带的 provider（及可选 backend_app_id）选 adapter 或实例，与文档中的「按空间/会话类型选 adapter」一致，仅粒度从「空间/类型」细化为「请求/会话」。

- **SESSION_REQUIREMENTS.md**  
  - 已列出会话相关能力与 API 的对应关系；新增「服务选择」后，需在「发消息、会话列表、会话历史」的请求/契约中补充可选字段（provider、backend_app_id），并在文档中说明「省略时使用全局 provider」。

- **SESSION_BACKEND_AND_IM_OPTIONS.md**  
  - 聚焦 Dify 单应用与可选 IM 后端；多 Dify 应用属于「同类型多实例」的配置与路由扩展，可与该文档的「Dify 自带会话 API」一节并列补充「多应用时的配置与隔离」说明。

---

## 三、输出物：结论摘要与可选方案（2.3）

### 3.1 结论摘要

- **当前「会话部分的后端支持服务选择」**  
  - **谁选**：运维（部署方）。  
  - **何时选**：进程启动时，通过环境变量设定 `CHAT_PROVIDER`（及 Dify 的 `DIFY_API_BASE`、`DIFY_API_KEY`）。  
  - **粒度**：**环境/进程级**；所有会话、所有请求共用同一聊天后端（当前仅 mock 已注册；dify/zulip/matrix 为预留）。  
  - **请求/会话是否参与选择**：不参与；请求体与会话模型无「目标服务」字段，不按会话或请求切换后端或 Dify 应用。

### 3.2 可选方案（会话/请求级服务选择）

在**不写代码、不改配置**的前提下，仅给出方案形态与要点；实现时需按上节「数据与契约、路由、适配器扩展」落地。

- **方案一：单适配器 + 多配置（推荐用于多 Dify 应用）**  
  - **配置形态**：例如 `chat.difyApps: { id: string; apiBase: string; apiKey: string }[]` 或通过命名环境变量注入为 map；全局 `CHAT_PROVIDER` 仍表示默认 provider，请求/会话可带 `backend_app_id` 指定 Dify 应用。  
  - **路由逻辑**：流式/列表/历史请求解析 `provider`（可选）+ `backend_app_id`（可选）；若为 dify 且带 `backend_app_id`，则从多配置中取对应 apiBase/apiKey，再调用同一 Dify 适配器的 `streamMessage`/`listSessions`/`listMessages` 并传入该配置（或由适配器根据 id 自取）。  
  - **对前端/会话模型的冲击**：前端需在发消息与拉列表/历史时可选传 `provider`、`backend_app_id`；会话模型需持久化或展示「该会话所属 provider + backend_app_id」，以便续聊与历史拉取时一致使用同一后端实例。  
  - **风险点**：配置项或环境变量增多；多 Dify 应用时需注意各应用配额/限流互不影响（由 Dify 侧控制）。

- **方案二：多适配器实例（按 backend_app_id 注册）**  
  - **配置形态**：同上多组 Dify 配置；启动时为每个 `backend_app_id` 创建一个 Dify 适配器实例并注册到 `getAdapterByAppId(backend_app_id)`。  
  - **路由逻辑**：请求解析出 `backend_app_id` 后，从注册表取适配器实例再调用；无 `backend_app_id` 时回退到当前全局单例行为。  
  - **对前端/会话模型的冲击**：与方案一类似；前端与会话模型均需携带或持久化「目标 backend_app_id」。  
  - **风险点**：实例数量随应用数增加，注册与生命周期管理略复杂；适合对「每应用完全隔离」有强要求的场景。

**推荐方向**：优先采用**方案一（单适配器 + 多配置）**实现多 Dify 应用选择；在保持现有「单 provider 全局默认」的前提下，通过请求/会话级可选参数扩展，兼容现有前端并最小化中间层改动。若后续有「每应用独立适配器逻辑」的需求，再考虑方案二或混合（部分 provider 多实例、部分单例）。

---

## 四、文档索引

- 会话功能需求总览：[SESSION_REQUIREMENTS.md](SESSION_REQUIREMENTS.md)  
- 会话消息标准化与多后端可行性：[SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md](SESSION_MESSAGE_ABSTRACTION_FEASIBILITY.md)  
- 会话后端与 IM 选型：[SESSION_BACKEND_AND_IM_OPTIONS.md](SESSION_BACKEND_AND_IM_OPTIONS.md)  
- 中间层环境变量与适配器说明：[middleware/README.md](../middleware/README.md)
