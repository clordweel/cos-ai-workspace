# 认证通用化与 Logto 唯一入口设计方案

本文描述：**为通用化项目，削去 ERPNext 等业务耦合，由 middleware 提供项目唯一认证入口并接入 Logto** 的可行性、设计与需跳转授权的下游服务处理方式。

---

## 1. 目标与范围

### 1.1 目标

- **通用化**：middleware 不再包含 ERPNext（Frappe）特有的登录逻辑（账号密码、API Token）；业务能力（如物料、诊断）由后续**标准模块**封装，通过统一身份与可选「连接器」访问下游。
- **唯一认证入口**：用户「是谁」仅由 **Logto** 决定。middleware 只提供：
  - 跳转 Logto 登录；
  - Logto 回调后建立会话（Cookie）；
  - `/api/auth/me`、登出。
- **可扩展**：若某业务或下游服务需要**用户侧授权**（如 OAuth 跳转、绑定第三方账号），通过**连接器（connector）**机制在 middleware 上扩展，不破坏「唯一入口 = Logto」的语义。

### 1.2 范围

| 层级 | 当前 | 调整后 |
|------|------|--------|
| **身份来源** | 密码 / Token（Frappe）+ Logto | **仅 Logto** |
| **Session 类型** | `frappe` \| `token` \| `logto` | **仅 `logto`**（或统一为单一类型） |
| **middleware 认证路由** | POST /api/auth/login, POST /api/auth/token, GET /api/auth/logto, callback, me, logout | **仅** GET /api/auth/logto、callback、GET /api/auth/me、POST /api/auth/logout；可选 GET/POST **连接器** 路由 |
| **下游调用（如 cos/物料）** | 用 session 中的 frappeSid/frappeToken 或 config 中的 API Key | 由**业务模块**负责：使用 config 中的 API Key、或通过**连接器**取得的「当前用户对该下游的凭证」 |

---

## 2. 可行性分析

### 2.1 Logto 作为唯一入口

- **标准 OIDC**：Logto 实现 OIDC Authorization Code 流程，middleware 已实现「生成授权 URL → 用户跳转 Logto → 回调带 code → 用 code 换 token → 拉取用户信息 → 写 Cookie 会话」。去掉密码/Token 后，仅保留该流程即可作为**唯一**登录方式。
- **会话与刷新**：当前实现未存 Logto 的 `refresh_token`。若需延长会话、减少用户重复跳转 Logto，可在 callback 时向 Logto 请求 `scope=openid profile offline_access`，保存 `refresh_token`，在会话即将过期时用 refresh 换新 token 并延长 session，用户无感。
- **结论**：**可行**。技术栈与现有 Logto 集成一致，仅做「删除其它登录方式、仅保留 Logto」即可。

### 2.2 需跳转用户授权的下游服务

部分服务需要**用户本人**在浏览器中完成授权（OAuth/OIDC 跳转），例如：

- **第三方 OAuth 应用**：如「用 Google 账号关联」「用 GitHub 登录某服务」。用户被重定向到 Google/GitHub，授权后回调到我们，我们拿到 token 并绑定到当前 Logto 用户。
- **支持 OIDC/OAuth 的业务系统**：若未来某业务（如某 ERP、协作平台）提供「通过 OAuth 授权本系统访问」，则需一次跳转：用户点击「连接 XXX」→ 跳转至该系统的授权页 → 授权后回调 → middleware 存 token（按 Logto 用户 + 该 provider 维度）。
- **Logto 自身**：登录工作台时已经是一次跳转（到 Logto），用户已习惯；唯一入口即这次跳转。

**关键点**：

1. **顺序**：必须先有 **Logto 会话**（即「当前用户」），再能做「连接某服务」的跳转；否则无法把拿到的 token 绑定到「谁」。
2. **State**：跳转时必须在 `state` 中携带防 CSRF 的 nonce、以及**回调后要返回的前端地址**（returnUrl）；callback 校验 state 后交换 code、存 token，再 302 到 returnUrl。
3. **多步跳转**：若业务上需要「先 Logto 登录，再跳转连接 ERP」，流程为：用户打开前端 → 未登录则先 302 到 Logto → 登录后回到前端 → 用户点击「连接 ERP」→ 若 ERP 支持 OAuth 则再 302 到 ERP 授权页 → 回调后回前端。两次跳转互不冲突，middleware 只需保证「连接器」的 state 与 callback 正确即可。
4. **无 OAuth 的下游（如当前 ERPNext）**：多数 ERP 只提供账号密码或 API Token，**没有**用户级 OAuth 授权页。这类通过「连接器」的**表单**收集 token/密码，在服务端校验后与当前 Logto 用户绑定存储，**不需要**跳转；由业务模块或 connector 提供「设置 → 连接 ERP → 输入 Token」即可。

**结论**：**可行**。需跳转授权的服务用「连接器 + state/returnUrl + callback」标准模式即可；不需跳转的用「表单 + 服务端校验 + 绑定存储」。middleware 可提供**通用连接器抽象**（见下节），不写死 ERP/Matrix。

### 2.3 风险与前提

- **依赖 Logto 可用性**：Logto 不可用时用户无法登录。需保障 Logto 服务与网络可用，或预留「维护态」页。
- **配置**：`LOGTO_ENDPOINT`、`LOGTO_APP_ID`、`LOGTO_APP_SECRET` 为必须；未配置时前端只显示「未配置单点登录」或禁用登录入口。
- **迁移**：现有仅通过密码/Token 登录的用户，需改为在 Logto 中创建/同步账号并改用 Logto 登录；或在一段时间内保留「兼容模式」路由（由独立模块提供），逐步下线。

---

## 3. 设计方案

### 3.1 Middleware：仅 Logto 的认证核心

**保留/实现**：

- **GET /api/auth/logto**  
  - 未登录或需重新登录时，前端跳转至此。  
  - 逻辑：生成 state（含 nonce + 可选 returnUrl），302 到 Logto 授权 URL（`scope=openid profile`，可选 `offline_access`）。
- **GET /api/auth/logto/callback**  
  - 查询参数：`code`、`state`。  
  - 逻辑：校验 state、用 code 换 access_token（及可选 refresh_token），拉取用户信息，创建 Session（仅类型 `logto`，存 `user`、`logtoSub`、可选 token），Set-Cookie，302 到前端（如 `FRONTEND_ORIGIN/space?auth=ok`）。
- **GET /api/auth/me**  
  - 从 Cookie 取 Session，有则返回 `{ ok: true, user, type: 'logto', sub?, permissions? }`，无则 401。
- **POST /api/auth/logout**  
  - 服务端删除 Session，Clear-Cookie，返回 200。

**移除（从 core 中删除）**：

- **POST /api/auth/login**（Frappe 账号密码）。
- **POST /api/auth/token**（Frappe API Token）。

上述移除的接口若需「兼容期」，可放到**独立业务模块**（如 `erp-auth-compat`）中，由该模块注册路由，并在文档中标明为过渡用，最终下线。

### 3.2 Session 结构（通用化后）

```ts
interface Session {
  sessionId: string;
  type: 'logto';           // 仅此一种
  user: string;            // 展示名
  logtoSub: string;        // Logto 用户唯一标识
  expiresAt: number;
  // 可选：延长会话
  logtoRefreshToken?: string;
}
```

不再有 `frappeSid`、`frappeToken`；若业务模块需要「当前用户对 ERP 的凭证」，由**连接器**写入单独的存储（见下），按 `logtoSub` + provider 查询。

### 3.3 连接器抽象（供需跳转或需绑定的服务使用）

为支持「有的服务需要跳转用户授权」，middleware 可提供**通用连接器**机制，与具体业务解耦。

**概念**：

- **Provider**：一个下游服务或一种绑定类型（如 `erp`、`matrix`、`google`）。每个 provider 可有：
  - **OAuth 型**：需要用户跳转授权；配置含 `authorizationUrl`、`tokenUrl`、`clientId`、`clientSecret`、`scopes` 等。
  - **Token 型**：不需要跳转；用户在前端表单输入 token/密码，前端 POST 到 middleware，middleware 校验后存储绑定。

**OAuth 型连接器（需跳转）**：

- **GET /api/auth/connect/:provider**  
  - 要求：请求带 Cookie，已登录（Logto Session）。  
  - 查询参数：`returnUrl`（授权完成后前端要跳回的地址）。  
  - 逻辑：根据 `provider` 取配置，生成 `state`（nonce + returnUrl + provider），302 到该 provider 的 authorizationUrl。
- **GET /api/auth/connect/:provider/callback**  
  - 查询参数：`code`、`state`。  
  - 逻辑：校验 state、用 code 换 token，将 token（及必要元数据）按 `(logtoSub, provider)` 持久化；302 到 state 中的 returnUrl（可带 `connect=ok` 或 `connect_error=...`）。

这样，**任何**需要用户跳转授权的服务，只要在配置中注册一个 provider，即可复用同一套「连接 + 回调」流程，无需在 core 里写死 ERP/Matrix。

**Token 型连接器**：

- **POST /api/auth/connect/:provider**（或 **POST /api/auth/bindings/:provider**）  
  - Body：`{ token: string }` 或 `{ usr: string, pwd: string }`（视 provider 约定）。  
  - 逻辑：校验当前 Session，用提交的凭证调用该 provider 的校验接口（如 Frappe get_logged_user）；成功则将凭证加密或脱敏后按 `(logtoSub, provider)` 存储；返回 200 或 401。

当前 ERPNext 无用户级 OAuth，适合用 **Token 型** 连接器；若某服务将来提供 OAuth，则为其增加 OAuth 型配置即可。

### 3.4 业务模块与 cos/ERP 调用

- **物料、诊断等**当前依赖「调用 cos 时带谁的身份」：
  - **通用化后**：middleware 不再提供 `getFrappeAuthForSession(session)`；改为由**业务模块**（如 cos 模块）自行解决：
    - 使用**服务端 API Key**（config），且请求体/头中带上 `confirmed_by` 等为当前 Logto 用户标识（审计用）；或
    - 调用前根据 `logtoSub` 查询该用户的 **ERP 连接器** 绑定，若存在则用绑定中的凭证调 cos，否则返回 403 或提示「请先连接 ERP」。
- 这样，**认证核心**与 **ERP 业务** 解耦：认证核心只认 Logto；ERP 是否要「用户身份」、如何拿到凭证，由模块与连接器负责。

### 3.5 前端认证应用

- **唯一入口**：前端只暴露「登录」→ 跳转至 middleware `GET /api/auth/logto`（或直接跳转 Logto 并带 redirect_uri 指向 middleware callback）。**不再**展示「账号密码」「Token」Tab。
- **已登录**：展示当前用户（来自 `/api/auth/me`）、退出按钮；可选展示「已连接的服务」（从 `/api/auth/me` 的 `bindings` 或单独接口返回）。
- **连接器**：若存在「连接 ERP」「连接 Matrix」等，在**设置**或独立「连接账户」页完成：
  - OAuth 型：按钮「连接 XXX」→ 跳转 `GET /api/auth/connect/erp?returnUrl=...` → 用户在外站授权 → 回调后回到 returnUrl；
  - Token 型：表单输入 Token → POST `api/auth/connect/erp` → 成功后可使用需 ERP 身份的功能。

---

## 4. 需跳转授权的场景汇总

| 场景 | 是否跳转 | 负责方 | 说明 |
|------|----------|--------|------|
| **工作台登录** | 是（跳转 Logto） | middleware 核心 | 唯一认证入口，用户只此一次跳转即可获得身份。 |
| **连接支持 OAuth 的第三方**（如 Google、某 ERP 未来 OAuth） | 是 | middleware 连接器 | GET /api/auth/connect/:provider → 302 到第三方 → callback 换 token 并存储，302 回 returnUrl。 |
| **连接仅支持密码/Token 的服务**（如当前 ERPNext） | 否 | 连接器（Token 型） | 前端表单提交，middleware 校验后存绑定；无跳转。 |
| **Logto 刷新会话**（offline_access） | 否 | middleware 核心 | 服务端用 refresh_token 换新 token，用户无感。 |

只要保证「先有 Logto 会话，再做连接器跳转」，且 state 中带 returnUrl 与 nonce，多步跳转不会冲突，方案可行。

---

## 5. 实施建议

### 5.1 阶段一：核心仅保留 Logto

1. **Middleware**  
   - 移除 `loginWithPassword`、`loginWithToken` 及路由 POST /api/auth/login、POST /api/auth/token。  
   - Session 仅保留 `type: 'logto'` 及上述 Session 结构；移除对 `frappeSid`、`frappeToken` 的读写。  
   - 可选：在 Logto 请求中增加 `offline_access`，并在 callback 中保存 `refresh_token`，实现静默刷新。
2. **前端**  
   - 认证面板只保留「单点登录」入口（或直接一个「登录」按钮跳转 /api/auth/logto）；移除账号密码、Token 的 Tab 与表单。  
   - `/api/auth/me` 仍返回 `user`、`type`；前端仅根据 `ok` 与 `user` 判断已登录。

### 5.2 阶段二：连接器与业务解耦

1. **连接器抽象**  
   - 实现 GET /api/auth/connect/:provider、GET /api/auth/connect/:provider/callback（OAuth 型）及 POST /api/auth/connect/:provider（Token 型）的约定与配置格式。  
   - 存储层：按 `(logtoSub, provider)` 存 token 或凭证引用；可先内存/文件，后续迁 DB。
2. **业务模块（如 cos/物料）**  
   - 不再依赖 `getFrappeAuthForSession(session)`。  
   - 改为：从请求 Cookie 取 Session 得 `logtoSub`，查询「erp」连接器绑定；有则用绑定凭证调 cos，无则 403 或提示连接 ERP。  
   - 若需兼容「仅服务端 API Key」的部署，可保留「无绑定时用 config.apiKey」的策略，由配置或环境决定。

### 5.3 阶段三：可选兼容与下线

- 若需过渡期，可将「密码/Token 登录」迁至独立包或路由（如 `erp-auth-compat`），仅在有该模块时注册；文档标明 deprecated，计划下线时间。  
- 前端在「未配置 Logto」时，可显示「请联系管理员配置单点登录」，不再提供密码/Token 表单。

---

## 6. 小结

| 问题 | 结论 |
|------|------|
| **middleware 唯一认证入口 + Logto** | **可行**。删除密码/Token，仅保留 Logto 的 redirect + callback + me + logout 即可。 |
| **削去 ERPNext 业务内容** | **可行**。Session 不再带 Frappe 凭证；cos/物料等由业务模块 + 连接器获取「用户对 ERP 的凭证」。 |
| **有的服务需要跳转用户授权** | **可行**。通过「连接器」抽象：OAuth 型走 GET connect + GET callback，state 带 returnUrl；Token 型走 POST connect，无跳转。先有 Logto 会话再做连接，多步跳转可链式进行。 |
| **通用化** | 认证核心与具体业务解耦；新下游（含需 OAuth 的）通过配置新 provider 即可接入，无需改 core。 |

以上方案在技术可行性与可扩展性上均可满足「通用化项目、middleware 唯一认证入口、接入 Logto、支持需跳转授权的服务」的目标。
