# 多源认证统一设计与用户无感体验

本文分析当前 **Matrix、ERPNext、Logto** 三类认证在项目中的角色，并给出**统一前端认证**与**用户无感完成业务**的设计方案，便于后续扩展更多认证源。

---

## 1. 现状分析

### 1.1 三种认证在系统中的角色

| 认证源 | 当前用途 | 谁在认证 | 前端是否感知 |
|--------|----------|----------|--------------|
| **ERPNext (Frappe)** | 工作台「主身份」、调用 cos/物料/诊断 等 | **最终用户**（账号密码 或 API Token） | 是：账号密码 / Token 登录入口 |
| **Logto** | 工作台「主身份」的另一种获取方式（SSO） | **最终用户**（跳转 Logto 登录） | 是：单点登录入口 |
| **Matrix** | 聊天会话后端（房间、消息、流式回复） | **服务端**（env 中 MATRIX_USER_ID + 密码/Token） | 否：无用户侧 Matrix 登录 |

结论：

- **用户可见的「登录」**只有两类：**ERPNext 直连**（密码 / Token）与 **Logto SSO**。二者在中间层都会生成同一种 **Workspace Session**（Cookie `auth_session`），只是 `session.type` 为 `frappe` | `token` | `logto`。
- **Matrix** 目前是**单实例、服务端配置**的聊天后端，不区分终端用户；对话列表/发消息等不依赖用户是否登录工作台。

### 1.2 当前会话与下游使用

- **Workspace Session** 用于：
  - **`/api/auth/me`**：返回 `user`、`type`，前端据此展示「已登录」和登录方式。
  - **`/api/diagnostics`**：需登录；诊断内部用 **config 中的 cos API Key** 调 Frappe，与 session 是否带 Frappe 凭证无关。
  - **`/api/material/confirm`**：需登录；若 session 带 Frappe 凭证（`frappeSid` / `frappeToken`）则用**用户身份**调 cos，否则回退为 **config 中的 cos API Key**（此时审计上仍是「当前 session 用户」确认，但 Frappe 侧可能是系统身份）。
- **Matrix**：所有请求用 **config.matrix** 的 identity，与 Workspace Session 无关。
- **聊天流**（`/api/chat/stream`）：当前**不校验** Cookie，即未登录也可发消息（若后端配置了 mock/dify/matrix）。

### 1.3 痛点与目标

- **多入口**：用户看到「账号密码 / Token / 单点登录」三个入口，容易困惑「该选哪个」。
- **能力与身份不一致**：Logto 登录后没有 Frappe 凭证，物料确认等若要用「当前用户」在 ERP 侧执行，需要**身份绑定**或二次认证。
- **未来扩展**：可能增加更多源（如企业微信、自建 OIDC、甚至 per-user Matrix），需要**统一抽象**，避免前端和中间层各自为战。
- **无感目标**：用户**一次登录（或一次绑定）**后，在会话有效期内完成对话、物料确认、诊断等**不再反复要密码或选登录方式**。

---

## 2. 用户侧认证场景与过程

以下从**用户视角**描述当前（及设计中的）认证场景与每一步的体验，便于产品与前端对齐「用户会看到什么、做什么」。

### 2.1 首次打开工作台（未登录）

1. 用户打开工作台页面（如 `/space` 或首页）。
2. 页面加载后，布局右侧会**自动展开应用区**，并选中**「认证登录」**标签（侧栏里带锁或认证图标的入口）。
3. 用户看到：
   - 顶部提示：「请选择一种方式登录，认证信息由 Cookie 保持。」
   - **三个 Tab**：**账号密码** | **Token** | **单点登录**（若未配置 Logto，单点登录可能不可用或点击后提示未配置）。
   - 当前选中的 Tab 下是对应的表单或说明。
4. 此时**会话区（左侧）仍可用**：用户可以先浏览会话列表、甚至在某些配置下**未登录也能发消息**（聊天接口当前不强制 Cookie）。需要「诊断」「物料确认」等能力时，会再被引导回认证。

### 2.2 选择一种方式并完成登录

**方式一：账号密码**

1. 用户点击「账号密码」Tab，看到：用户名输入框、密码输入框、「登录」按钮。
2. 输入 ERPNext 用户名与密码，点击「登录」。
3. 请求发往中间层 `POST /api/auth/login`，中间层用该账号调 Frappe 登录；成功则写 Cookie、返回 `{ ok: true, user: "显示名" }`。
4. 前端收到成功 → 更新为「已登录」状态，应用区认证面板变为**已登录卡片**：展示「已登录」、当前用户名、以及「退出登录」按钮。侧栏中需登录的应用入口变为可点击。

**方式二：Token**

1. 用户点击「Token」Tab，看到：API Token 输入框（占位符提示「api_key:api_secret 或 Bearer token」）、「使用 Token 登录」按钮。
2. 用户从 ERPNext 用户设置中复制 API 密钥（格式通常为 `api_key:api_secret`），粘贴后点击按钮。
3. 中间层 `POST /api/auth/token` 用该 Token 调 Frappe 校验身份；成功则写 Cookie、返回 `{ ok: true, user: "显示名" }`。
4. 前端表现同方式一：认证面板变为已登录卡片，全工作台视为已登录。

**方式三：单点登录（Logto）**

1. 用户点击「单点登录」Tab，看到说明「通过 Logto 单点登录，将跳转至登录页，完成后返回本工作台。」以及「使用 Logto 登录」按钮。
2. 用户点击按钮 → 浏览器**整页跳转**到中间层 `GET /api/auth/logto`，再被 302 到 Logto 授权页（可能带企业 IdP 登录页）。
3. 用户在 Logto 页完成登录/授权后，被重定向到中间层 `GET /api/auth/logto/callback?code=...`；中间层用 code 换 token、取用户信息、创建 Session 并写 Cookie，再 302 到**前端** `{FRONTEND_ORIGIN}/space?auth=ok`。
4. 前端加载后通过 `?auth=ok` 触发 `fetchUser()`，拉取到已登录状态 → 认证面板展示已登录卡片；若 URL 带 `auth_error=...` 则打开认证标签并展示错误信息（如「换取 token 失败」）。

### 2.3 登录后的日常使用

1. **界面状态**  
   - 应用区侧栏中「认证登录」标签页内显示「已登录」+ 用户名 + 退出按钮。  
   - 需要登录才能打开的应用（如部分扩展）在首页/侧栏可见且可点击。  
   - 用户可随时在应用区切换「首页」「联系人」「机器人」「设置」「认证登录」等标签，或折叠应用区专注会话。

2. **发消息 / 聊天**  
   - 当前实现下，发消息**不强制登录**（接口未校验 Cookie）。用户直接输入并发送即可；若后端配置了需登录，则请求会返回 401，前端会**自动打开认证面板**并聚焦「认证登录」标签，用户完成登录后可再次发送。

3. **诊断**  
   - 用户打开「设置」等入口进入诊断能力（如「系统诊断」按钮）。点击后请求 `GET /api/diagnostics`（带 Cookie）。  
   - 若**未登录**：返回 401，前端打开认证面板，用户选择一种方式登录后，可再次点击诊断。  
   - 若**已登录**：返回诊断结果（ERP 连接、当前用户、版本等），用户**无感**，无需再次输入密码。

4. **物料确认（任务卡片「确认」）**  
   - 对话中若出现「待确认创建物料」类任务卡片，用户点击「确认」后，前端请求 `POST /api/material/confirm`（带 Cookie）。  
   - 若**未登录**：401 → 前端打开认证面板，用户登录后可再次点击确认。  
   - 若**已登录**：中间层用当前 Session（若有 Frappe 凭证则用用户身份，否则可能回退系统 Key）调 cos 创建物料；用户**无感**完成确认。

5. **会话过期**  
   - Cookie 会话有效期为配置值（如 3 天）。过期后，下一次需认证的请求会得到 401。  
   - 用户侧体验与「未登录」一致：例如点击诊断或物料确认 → 401 → 前端打开认证面板，用户**重新选一种方式登录**即可，无需区分「是首次登录还是过期重登」。

### 2.4 收到 401 时的体验（需认证但未登录 / 会话失效）

1. 用户执行了某个需要登录的操作（发消息、诊断、物料确认等），但当前未登录或 Cookie 已失效。
2. 接口返回 **401**，前端统一处理：
   - **自动打开应用区**（若已折叠则展开）；
   - **选中「认证登录」标签**，使认证面板可见；
   - 可选：在输入框或面板上方提示「请先登录」或「登录已过期，请重新登录」。
3. 用户在上述面板中**任选一种方式**完成登录后，可**直接重试原操作**（如再点一次「确认」或「发送」），无需再找入口。

### 2.5 收到 403 时的体验（已登录但能力不足，设计中的行为）

1. 当中间层实现「无 Frappe 凭证则不允许以用户身份写 ERP」后，可能出现：用户已用 **Logto** 登录，点击物料确认时，接口返回 **403**，body 中 `code: 'erp_binding_required'`。
2. 前端统一处理（建议）：
   - 打开认证面板，并**自动切换到「账号密码」或「Token」** Tab；
   - 提示：「该功能需要 ERP 账号，请使用账号密码或 Token 登录」或「请绑定 ERP 账号」。
3. 用户使用账号密码或 Token 重新登录（或在未来「绑定 ERP」流程中补全凭证）后，再次点击确认即可**无感**完成，同一会话内不再反复提示。

### 2.6 退出登录

1. 用户在应用区「认证登录」标签页内点击「退出登录」。
2. 前端请求 `POST /api/auth/logout`（带 Cookie），中间层删除服务端 Session 并清除 Set-Cookie。
3. 前端将 `isAuthenticated` 置为 false，认证面板恢复为「请选择一种方式登录」；需登录的应用入口再次隐藏或置灰。  
4. 用户若再执行需认证操作，会再次触发 2.4 的 401 流程。

### 2.7 小结：用户感知到的「认证」是什么

- **一次选择**：在「账号密码 / Token / 单点登录」中**选一种**并完成，即视为「已登录」。
- **一个状态**：全工作台只有一个「已登录」状态，不区分是哪种方式登的；用户只关心「能发消息、能点诊断、能确认物料」。
- **一次引导**：需要登录时，界面**自动打开认证面板**并聚焦登录表单，用户完成登录后继续操作即可。
- **（设计中的）一次绑定**：若未来区分「有 ERP 能力 / 无 ERP 能力」，无能力时 403 会**明确引导**到密码/Token 或绑定页，避免用户不知道选哪种方式。

---

## 3. 统一认证模型（建议）

### 3.1 概念分层

- **Workspace 身份（主身份）**  
  当前端「已登录」时，即有一个 **Workspace 身份**：`user`（展示名）+ `session.type`。  
  获取方式：**任一**登录方式（密码 / Token / Logto / 未来更多）成功 → 写入同一 Cookie → 视为同一类「已登录」。

- **服务绑定（Service Bindings）**  
  某业务能力依赖**特定后端**时，该后端可要求「当前 Workspace 用户」具备对应**绑定**：
  - **ERPNext 绑定**：session 中已有 Frappe 凭证（`frappeSid` 或 `frappeToken`），即密码/Token 登录，或未来「Logto 用户绑定 ERP 账号」后写入。
  - **Matrix 绑定**（未来）：若要做「每用户一个 Matrix 账号」，则 session 或用户档案中存该用户的 Matrix 凭证或映射。
  - **其他**：例如「已连接企业微信」「已绑定 Dify 个人 API Key」等，可同构扩展。

- **前端不区分「三种认证服务」**  
  前端只关心：**是否已登录**、**当前用户能用到哪些能力**（由 `/api/auth/me` 或专门的能力接口返回）。  
  登录方式（密码 / Token / Logto）只是**建立主身份**的多种入口，前端可统一为「一种登录状态 + 可选的能力/绑定状态」。

### 3.2 中间层抽象（便于扩展更多认证源）

- **认证提供方（Auth Provider）**  
  每种登录方式对应一个 Provider：`password`（Frappe）、`token`（Frappe API Key）、`logto`（OIDC）。  
  未来可加：`wecom`、`matrix`（per-user）、`oidc_custom` 等。  
  所有 Provider 成功后的**产出**统一为：**同一个 Session 存储**（当前即 Cookie + in-memory session），并可选写入**绑定信息**（如 Frappe sid/token、Matrix access_token 等）。

- **Session 扩展字段（建议）**  
  在现有 `session.user`、`session.type` 基础上，可增加例如：
  - `bindings?: { erp?: boolean; matrix?: boolean; ... }`  
    或由 `/api/auth/me` 根据 session 内容**计算**后返回，前端只消费「能力位」，不关心具体是哪个 Provider。

- **能力与 401/403**  
  - 未登录 → 401，前端统一 `requireAuth()`，打开认证面板。  
  - 已登录但某接口需要「ERP 绑定」而当前 session 无 Frappe 凭证 → 建议 **403** 或 **409**，body 中 `code: 'erp_binding_required'`，前端据此引导「使用账号密码/Token 登录以使用物料功能」或「在设置中绑定 ERP 账号」。

这样，**Matrix、ERPNext、Logto** 在架构上统一为：  
- **Logto / 密码 / Token**：都是「获取 Workspace 主身份」的入口；  
- **ERPNext**：同时是「主身份」的来源之一，也是「物料/诊断等能力」的绑定目标；  
- **Matrix**：当前仅为服务端通道，未来若 per-user，则作为「聊天能力」的绑定目标。

---

## 4. 前端统一认证与无感体验

### 4.1 单一「已登录」状态

- 继续使用现有 **Cookie + `/api/auth/me`**，前端 **`useAuth()`** 只暴露：
  - `isAuthenticated`、`user`、`authLoading`、`permissions`（已有）；
  - 可选：**`capabilities`** 或 **`bindings`**（见下），用于控制「物料确认」「诊断」「设置中的绑定管理」等入口的展示与禁用原因。
- **不**在前端区分「当前是 Logto 还是 ERP 登录」做业务逻辑分支；仅在需要**引导用户去绑定 ERP** 时，可提示「请使用账号密码或 Token 登录以使用物料创建」或提供「绑定 ERP」设置页。

### 4.2 登录入口的「统一」与「无感」

- **优先一种主入口（可配置）**  
  - 若环境配置了 Logto，可将「单点登录」作为**默认/首选**入口（如大按钮「使用公司账号登录」），密码/Token 折叠为「其他登录方式」。  
  - 若未配置 Logto，则保持当前「账号密码 / Token / 单点登录」三选一即可。  
  这样用户多数场景下**一次点击**即可完成登录，无需在三种方式间选择。

- **记住上次成功的方式（可选）**  
  前端可把「上次使用的登录方式」存 localStorage（如 `lastAuthMode: 'logto'`），下次打开认证面板时默认选中该方式，减少重复选择。

- **登录后静默刷新能力**  
  登录成功或 Logto 回调后，除 `fetchUser()` 拉取 `user` 外，可同时拉取 **capabilities/bindings**（若接口提供），使「物料确认」「诊断」等入口立即可用或立即显示「需要绑定 ERP」提示，无需用户再点一次。

### 4.3 能力与绑定状态（建议 API）

- **扩展 `/api/auth/me` 响应**（示例）：

```json
{
  "ok": true,
  "user": "张三",
  "type": "logto",
  "permissions": [],
  "capabilities": {
    "erp": true,
    "chat": true,
    "matrix": false
  }
}
```

- **语义**：
  - `capabilities.erp`：当前 session 是否具备调用 cos/物料/诊断等需 Frappe 身份的能力（即是否有 Frappe 凭证或已绑定）。
  - `capabilities.chat`：当前是否可用聊天（当前实现中恒为 true；若未来聊天也需登录，可据此控制）。
  - `capabilities.matrix`：若未来支持 per-user Matrix，可表示是否已绑定 Matrix。
- 前端根据 `capabilities`：
  - 展示/隐藏「物料确认」「诊断」等入口；
  - 或在入口处禁用并 tooltip「请使用账号密码或 Token 登录以使用该功能」。

这样用户**只需在「需要 ERP 能力时」**选一次密码/Token（或完成一次绑定），之后在同一会话内**无感**使用。

### 4.4 401/403 与引导

- **401 未登录**：保持现状，前端 `requireAuth()`，打开认证面板。
- **403 需要绑定**：若中间层对物料确认等返回 403 且 body 含 `code: 'erp_binding_required'`，前端可：
  - 提示「该功能需要 ERP 账号，请使用账号密码或 Token 重新登录」；
  - 或打开认证面板并自动切到「账号密码」或「Token」标签，避免用户不知道选哪个。

---

## 5. 实施建议（分阶段）

### 5.1 短期（不破坏现有行为）

- **中间层**：  
  - 在 **`/api/auth/me`** 中根据现有 session 计算并返回 **`capabilities`**（如 `erp: !!session.frappeSid || !!session.frappeToken`，`chat: true`，`matrix: false`）。  
  - 不在本阶段改 session 存储结构。
- **前端**：  
  - **useAuth** 拉取并暴露 **`capabilities`**（只读）；  
  - 认证面板：若配置了 Logto，可将「单点登录」置于最前或默认；可选记住 `lastAuthMode`。  
  - 物料确认/诊断等：若 `capabilities.erp === false`，可置灰或提示「请使用账号密码或 Token 登录以使用该功能」，点击时先 `requireAuth()` 并可选自动切换到密码/Token 标签。

### 5.2 中期（身份绑定与 403）

- **中间层**：  
  - 物料确认等接口：若必须用**用户身份**调 cos，则当 session 无 Frappe 凭证时返回 **403** 且 `code: 'erp_binding_required'`，不再回退到系统 API Key（或保留回退为配置项）。  
  - 可选：提供「绑定 ERP」流程（如 Logto 用户再输入一次 Frappe 账号密码，写入 session 的 frappeSid/frappeToken），与现有 password/token 登录复用同一套 Session 字段。
- **前端**：  
  - 统一处理 403：若 `code === 'erp_binding_required'`，引导至密码/Token 登录或「绑定 ERP」设置。  
  - 设置页可展示「已连接：ERPNext / Logto」，未绑定时展示「连接 ERP 账号」按钮（跳转或内嵌密码/Token 表单）。

### 5.3 长期（更多认证源与 per-user Matrix）

- **新认证源**：新增 Provider（如企业微信、自建 OIDC），在中间层注册为一种登录方式，产出同一 Session 形态；前端仅增加一个登录入口或由后端配置决定是否展示。  
- **Per-user Matrix**：若需每用户独立 Matrix 身份，可在 session 或用户档案中存 Matrix 凭证/映射；聊天相关接口从「当前用户」解析 Matrix 身份，前端仍只关心「是否已登录」和 `capabilities.matrix`。  
- **统一能力接口**：可将 `capabilities` 抽成独立接口（如 `GET /api/auth/capabilities`），由中间层汇总各后端健康与绑定状态，前端只轮询或随 `fetchUser` 拉取一次，实现「一处登录、处处无感」的体验。

---

## 6. 小结

| 维度 | 建议 |
|------|------|
| **概念** | 单一 Workspace 身份 + 多「服务绑定」；Matrix/ERPNext/Logto 在架构上统一为「主身份来源」或「能力绑定目标」。 |
| **前端** | 只认「是否已登录」与「capabilities」；不按认证源分支业务；401 → requireAuth()，403 → 按 code 引导绑定或登录方式。 |
| **无感** | 优先一种登录入口（如 Logto）、可选记住上次方式、登录后刷新 capabilities；能力不足时明确引导到密码/Token 或绑定，避免反复试错。 |
| **扩展** | 新认证源作为新 Provider 产出同一 Session；新能力用 capabilities 位或 bindings 表示；前端仅做展示与引导，不写死三种服务。 |

这样，**当前三种认证**得以统一抽象，前端统一认证体验，用户在一次登录（或一次绑定）后即可无感完成业务；后续新增认证源只需在中间层和配置上扩展，前端改动最小。

---

## 7. 前端对接要点（与 useAuth / usePermissions）

- **文档**：多源认证与能力模型见本文；鉴权与权限的日常用法见 **docs/FRONTEND_AUTH_AND_PERMISSIONS.md**。
- **`/api/auth/me` 扩展后前端需消费的字段**（在实现 capabilities 后）：
  - `ok`、`user`、`type`、`permissions`：保持现状。
  - **`capabilities`**（可选）：`{ erp?: boolean; chat?: boolean; matrix?: boolean }`，用于：
    - 控制「物料确认」「诊断」等入口的可用性；
    - 无 ERP 能力时提示「请使用账号密码或 Token 登录」或引导至绑定。
- **useAuth 扩展建议**：在 `fetchUser` 中解析 `data.capabilities`，写入 `ref<Capabilities>` 并暴露为只读；登出时清空。  
  **usePermissions** 可增加 `canUseErp()`、`canUseChat()` 等便捷方法，内部读 `capabilities`，便于模板与逻辑统一判断。
- **403 处理**：在 `useChatStream`、物料确认等封装中，若 `res.status === 403` 且 body 中 `code === 'erp_binding_required'`，可调用统一方法（如 `useAuth().requireErpBinding()`）打开认证面板并切换到密码/Token 或设置中的绑定入口，避免各组件重复写引导逻辑。
