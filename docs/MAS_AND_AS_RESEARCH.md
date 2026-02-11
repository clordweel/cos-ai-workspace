# MAS 与 Appservice 方案调研

> 研究 Matrix Authentication Service (MAS) 和 Application Service (AS) 能否改善当前「密码缓存 + Admin 设密登录」的会话 token 获取流程。

---

## 一、当前局面回顾

| 问题 | 说明 |
|------|------|
| 密码依赖 | 中间层需为用户获取 Matrix access_token 才能代其操作；无 token exchange（Logto token → Matrix token） |
| 获取方式 | Admin API 设随机密码 + `/login`，或使用用户「设置 Matrix 密码」后的缓存密码 |
| 缓存失效 | MXID 从 logtoSub 改为 username 时，旧缓存密码与新 MXID 错配，导致 401；已通过「失败时删缓存并回退到 Admin 设密」缓解 |
| 密码存储 | 缓存密码存 Redis/内存；数据丢失可恢复，但会覆盖用户自定义密码 |
| 架构约束 | 中间层为服务端，拿不到浏览器 OIDC 流程中的 token；Synapse 不支持用 Logto token 换 Matrix token |

详见 `SESSION_MATRIX_ANALYSIS.md`、`LOGTO_MATRIX_AUTH_FLOW.md`。

---

## 二、MAS（Matrix Authentication Service）

### 2.1 概述

- **MSC3861**：Matrix 下一代认证，基于 OAuth 2.0 / OpenID Connect
- **MAS**：Element 维护的 OAuth2/OIDC Provider，供 Synapse 委托认证
- **流程**：客户端请求 Synapse → Synapse 将 access_token 送 MAS 做 RFC 7662 内省 → 根据 `sub`/`username` 映射到 Matrix 用户

### 2.2 对当前局面的潜在帮助

| 能力 | 说明 |
|------|------|
| **上游 OIDC (upstream_oauth2)** | MAS 可配置 Logto 为 IdP；用户通过 Logto 完成 OAuth 后，MAS 签发 Matrix token。适用于 Element 等**客户端**的 SSO，不直接解决**服务端中间层**代用户拿 token 的需求 |
| **Personal Access Tokens** | Admin 可通过 MAS Admin API `POST /api/admin/v1/personal-sessions` 为**指定用户**创建 access_token，用于自动化、脚本、bot 等；**无需用户密码** |
| **用户管理** | MAS 管理用户（ULID）；与 Synapse 有映射；支持 `POST /api/admin/v1/users` 创建、`addUpstreamOAuthLink` 关联上游身份 |

### 2.3 Personal Session 流程（可行路径）

1. 中间层持有 MAS Admin API 凭证（需配置 `adminapi`、相应 client/secret）
2. Logto 登录后，根据 `logtoSub`/`username` 确定对应用户的 MAS user ID（或通过 `getUserByUsername` 等解析）
3. 调用 `POST /api/admin/v1/personal-sessions`，传入 `actor_user_id`、scope（如 `urn:matrix:org.matrix.msc2967.client:api:*`）
4. 返回 personal access token，中间层存入 session/Redis，用于后续 Matrix Client-Server 调用

**优点**：

- 不再需要用户 Matrix 密码
- 不再需要缓存密码
- Admin 可为任意用户签发 token，适合 server-side 代操

**前提与成本**：

- Synapse 必须已接入 MAS（当前项目若仍用 Synapse 原生密码认证，需先迁移）
- MAS 与 Synapse 需正确配置（shared secret、endpoint 等）
- 用户需在 MAS 中存在；若通过 Logto 同步，需配置 `upstream_oauth2` + `addUpstreamOAuthLink` 或 MAS 用户创建流程
- MAS 部署与运维（PostgreSQL、配置、升级）增加架构复杂度

### 2.4 与 Logto 的整合

- MAS `upstream_oauth2.providers` 可配置 Logto 作为 IdP
- `claims_imports.localpart` 可用 `{{ user.preferred_username }}` 映射 username
- `claims_imports.subject` 可用 `{{ user.sub }}` 关联 Logto sub
- 此路径主要服务**客户端**（Element 等）的 OAuth 登录；中间层若用 Personal Session，则无需走该 OAuth 流程，只需保证 MAS 中有相应用户并建立 logtoSub ↔ MAS user 的映射

---

## 三、Application Service (AS)

### 3.1 概述

- AS 通过 YAML 注册到 Synapse，配置 `as_token`、`hs_token`、`sender_localpart`、`namespaces`
- `namespaces.users` 可声明 exclusive 的 user 正则（如 `@_workspace_.*`），仅该 AS 可管理该 namespace 的用户
- 规范中有 "masqueraded users" 概念：AS 可以**代 namespace 内用户**发请求

### 3.2 AS 向 Synapse 发请求的机制

- AS 使用 `as_token` 作为 `access_token` 向 Synapse Client-Server API 发请求
- **Identity assertion**：AS 需能指定「以哪个 user_id 身份」操作；具体机制在规范中未完全明确，不同实现可能不同
- Synapse 文档与规范侧重 HS→AS 的推送（transactions、query users/rooms），对 AS→HS 时如何传 `user_id` 的标准化描述较少

### 3.3 虚拟用户与注册

- 当 HS 收到 namespace 内未知 user 的相关请求时，会调用 `GET /_matrix/app/v1/users/{userId}` 询问 AS
- AS 若返回 200，**必须**用 Client-Server API 创建该用户
- 创建用户通常需 `/register`；可配合 MSC3231 的 `m.login.registration_token` 或无密码注册（若 Synapse 支持）
- AS 自身无「不经过 /register 直接拿用户 token」的标准 API

### 3.4 对当前局面的潜在帮助

| 能力 | 说明 |
|------|------|
| 代用户操作 | 若 Synapse 支持 AS 的 identity assertion，AS 可用 as_token + 某 user_id 以该用户身份调用 C-S API |
| 虚拟用户管理 | 可注册 namespace（如 `@workspace_.*:server`），由 AS 负责创建与维护这些用户 |
| 无密码 | 理论上 AS 创建用户时可用 registration_token 等机制，避免密码 |

**限制**：

- Synapse 对 AS masquerade 的完整支持需查源码或实测
- AS 需实现 HS→AS 的回调（`/users/{userId}`、`/rooms/{roomAlias}` 等），并正确创建用户
- 架构上中间层需同时扮演「会话后端」和「Matrix AS」，职责增加

---

## 四、方案对比与建议

| 维度 | 当前方案（Admin 设密 + 密码缓存） | MAS Personal Session | AS (Identity Assertion) |
|------|----------------------------------|----------------------|--------------------------|
| 是否需要用户密码 | 是（或缓存） | 否 | 否（若 AS 可代操） |
| 是否需缓存密码 | 可选（有则用） | 否 | 否 |
| 部署复杂度 | 低 | 高（MAS + 迁移 Synapse） | 中（AS 注册 + 回调实现） |
| 与 Logto 关系 | 独立，仅用 Logto 做身份 | 可配置 upstream，或 Admin 建用户 | 独立，AS 自建映射 |
| 规范与生态 | 成熟 | MSC3861 已合并，Element 支持 | 规范有 masquerade，实现细节因 HS 而异 |
| 实施可行性 | 已实现 | 需 MAS 部署与 Synapse 迁移 | 需验证 Synapse AS masquerade 行为 |

### 建议

1. **短期**：继续沿用当前「Admin 设密 + 密码缓存 + 失败删缓存回退」；已能应对 MXID 变更等场景，实现成本低。
2. **中期（若需去除密码）**：
   - **优先考虑 MAS**：若团队可接受部署 MAS 并将 Synapse 迁移到 MAS 认证，则 Personal Session 可完全替代密码逻辑，实现「Logto 登录 → 中间层调 MAS Admin API 签 token」的无密码流程。
   - **AS 方案**：需先验证 Synapse 对 AS identity assertion 的支持（as_token + user_id 的传参方式），并实现 AS 回调和虚拟用户创建；可作为 MAS 不可用时的备选。
3. **长期**：MAS 是 Matrix 认证的方向；若项目长期依赖 Matrix，迁移到 MAS 有利于与 Element、OIDC 生态统一。

---

## 五、MAS Personal Session 实施要点（若采用）

1. **MAS 部署**：参考 [matrix-authentication-service](https://github.com/element-hq/matrix-authentication-service)，配置数据库、Synapse 共享密钥、HTTP 监听等。
2. **Synapse 迁移**：配置 `experimental_msc3861_oauth_delegation` 等，将认证委托给 MAS。
3. **用户同步**：  
   - 方案 A：Logto 登录时，中间层调 MAS Admin API 创建/获取用户，并 `addUpstreamOAuthLink` 关联 Logto sub；  
   - 方案 B：配置 MAS `upstream_oauth2` 为 Logto，用户通过 OAuth 首次登录时 MAS 自动创建用户；中间层通过 username/sub 查 MAS user。
4. **Token 签发**：Logto 回调成功后，中间层用 MAS Admin API `POST /api/admin/v1/personal-sessions`，传入对应用户的 `actor_user_id` 和 scope，获得 access_token 并写入 session。
5. **代码改动**：`matrixSessionToken.ts` 中 `ensureMatrixTokenForSession` 改为调用 MAS Admin API，不再使用 `setMatrixPasswordByAdmin` + `loginAsUser`；可移除 `matrixPasswordStore`。

---

## 六、参考资料

- [Matrix Authentication Service 文档](https://element-hq.github.io/matrix-authentication-service/)
- [MSC3861: OAuth2/OIDC based authentication](https://github.com/matrix-org/matrix-spec-proposals/pull/3861)
- [Application Service API (Matrix Spec)](https://spec.matrix.org/latest/application-service-api/)
- [Synapse Application Services](https://matrix-org.github.io/synapse/develop/application_services.html)
- [SESSION_MATRIX_ANALYSIS.md](./SESSION_MATRIX_ANALYSIS.md) — 当前架构与可选方案
- [LOGTO_MATRIX_AUTH_FLOW.md](./LOGTO_MATRIX_AUTH_FLOW.md) — Logto 与 Matrix 认证流程
