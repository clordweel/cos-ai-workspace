# 中间层会话持久化方案（保持认证）

## 现状

- **存储**：`middleware/src/services/auth/sessionStore.ts` 支持 **memory**（默认）、**redis**、**file** 三种 store。Cookie 仅存 `sessionId`，会话数据在对应 store 中。
- **memory**：进程内存 Map，重启后清空 → 401，需重新登录。
- **file**：单文件 JSON（`sessionStoreFile.ts`），`SESSION_STORE=file` 且可选 `SESSION_FILE_PATH`，启动加载、变更防抖写回，重启后会话保留。
- **redis**：`SESSION_STORE=redis` 且 `REDIS_URL`，多实例共享。

## 目标

- 重启中间层后，已登录用户**无需重新登录**（会话可恢复）。
- 可选：多实例部署时会话共享（需持久化到外部存储）。

## Cookie（服务端会话） vs 前端 Token 对比

| 维度 | Cookie + 服务端 Session | 前端存 Token + Authorization |
|------|-------------------------|-----------------------------|
| **敏感数据在哪** | Cookie 里只有 sessionId；access/refresh token 在服务端内存或持久化 store | access_token（及 refresh_token）在浏览器 localStorage/sessionStorage |
| **请求怎么带** | 浏览器自动带 Cookie（sessionId） | 前端在请求头里带 `Authorization: Bearer <token>` |
| **中间层状态** | 有状态：要根据 sessionId 查会话（内存/文件/Redis） | 无状态：只校验 token（JWT 或 Logto introspect），不存会话 |
| **重启/多实例** | 依赖会话持久化（否则重启丢会话；多实例需共享 store） | 无影响，不依赖服务端存储 |
| **XSS 窃取** | 只能拿到 sessionId，拿不到 token；若未持久化，会话在服务端仍有效直到过期 | 能直接读到 token，可冒充用户；需严格防 XSS |
| **CSRF** | Cookie 会自动带上，需配合 SameSite/CSRF token 等防护 | 不自动带，需主动加 header，天然不易被跨站利用 |
| **登出/失效** | 服务端删 session 即失效；Cookie 可清或设过期 | 需前端删本地 token；服务端无法主动作废 JWT（除非黑名单或短过期） |
| **多登录方式** | 统一用 Cookie + 一种 session 结构即可（Logto/Frappe 都进 session） | Logto 用 Bearer，Frappe 无 JWT 通常仍用 Cookie，需两套鉴权 |
| **实现成本** | 当前已是该模型；要“重启保持”需加持久化（文件/Redis） | 需改登录回调把 token 给前端、前端存并带 header、中间层认 Bearer |

**简要结论**：Cookie + 服务端会话更利于把 token 隔离在服务端（XSS 只拿到 id）；要解决重启丢会话，给 session 加持久化即可。前端 Token 方案中间层无状态、重启/多实例友好，但 token 在浏览器，必须防 XSS，且与 Frappe 等非 JWT 登录并存时要双路径鉴权。

## 方案对比

| 方案 | 重启后保持 | 多实例共享 | 依赖 | 敏感数据 | 实现复杂度 |
|------|------------|------------|------|----------|------------|
| **内存（当前）** | ❌ | ❌ | 无 | 仅在内存 | 已实现 |
| **文件存储** | ✅ | ❌ | 无 | 落盘需注意权限/加密 | 低 |
| **Redis** | ✅ | ✅ | Redis | 在 Redis，需网络与访问控制 | 中 |
| **加密 Cookie（stateless）** | ✅ | ✅ | 无 | 全在 Cookie（加密），体积与安全权衡 | 中高 |
| **数据库（SQLite/Postgres）** | ✅ | ✅ | DB | 在 DB | 中 |
| **前端存储 token** | ✅ | ✅ | 无 | token 在浏览器 localStorage/内存，请求时带 Authorization | 中 |

### 1. 文件存储（单机持久化）

- **思路**：会话仍以 `sessionId → 数据` 形式存储，但写入本地文件（如 JSON 或每会话一文件），启动时加载，运行时写入/更新/删除同步到文件。
- **优点**：零额外依赖、单机重启后会话保留、实现简单。
- **缺点**：多实例不共享；需考虑并发写（单进程可写时加锁或合并写入）；会话中含 token，文件需限制权限（chmod 600）或考虑加密（可选）。
- **适用**：单实例部署、开发/测试环境。

### 2. Redis

- **思路**：用 Redis 做 session store，key 如 `sess:{sessionId}`，value 为 JSON，设 TTL 与 `expiresAt` 一致。
- **优点**：重启、多实例共享、TTL 天然支持过期、性能好。
- **缺点**：需部署与配置 Redis；会话数据经网络存 Redis，需保证 Redis 访问安全。
- **适用**：多实例或希望会话集中管理的生产环境。

### 3. 加密 Cookie（无状态）

- **思路**：不存服务端 session，把必要信息（如 userId、logtoSub、过期时间）放进 Cookie，服务端用密钥签名/加密，校验时解密验证。
- **难点**：当前会话含 **logtoAccessToken/refreshToken**、**frappeSid** 等敏感且体积较大的数据，全部塞进 Cookie 会超 4KB 且风险高；若只放 userId/logtoSub，每次请求需用 refresh_token 向 Logto 换新 access_token，逻辑复杂且依赖 Logto 可用性。故**不推荐**作为主方案。

### 4. 数据库

- **思路**：建 `sessions` 表（session_id, user_id, type, payload JSON, expires_at），与 Redis 类似但用现有或新加 DB。
- **优点**：与业务库统一、可审计、多实例共享。
- **缺点**：需 DB 与迁移；若当前无 DB 则引入成本高。
- **适用**：已有 PostgreSQL/MySQL 等且希望会话与业务同库时。

### 5. 前端存储 token（无状态中间层）

- **思路**：Logto 登录成功后，中间层把 **access_token**（及可选 **refresh_token**）通过安全方式交给前端，前端存入 localStorage 或 sessionStorage；之后每次请求带 `Authorization: Bearer <access_token>`。中间层**不存会话**，收到请求时用 header 里的 token 向 Logto 校验（introspect 或 JWT 验证）得到用户身份，或解码 JWT 取 sub/name 等，按需再拉 customData。access_token 过期时由前端带 refresh_token 调中间层某接口换新 token，或中间层在发现过期时用前端传来的 refresh_token 换新并返回 Set-Cookie/JSON。
- **优点**：中间层无状态、重启/多实例无影响；无需 Redis/文件等持久化；实现清晰（谁持 token 谁带上来）。
- **缺点**：
  - **XSS 风险**：localStorage/sessionStorage 可被同源脚本读取，若存在 XSS，攻击者可窃取 token；当前方案里 token 在服务端内存、Cookie 只存 sessionId，窃取 Cookie 只能拿到 id，拿不到 token 本身，相对更隔离。若采用前端存 token，需严格防 XSS（CSP、避免把不可信内容插入 DOM 等）。
  - **刷新流程**：需约定 refresh 由前端调还是中间层代劳；若中间层代劳，前端需在某次请求时带上 refresh_token（如专用 `/api/auth/refresh` 或请求体/header），中间层返回新 access_token 供前端更新存储。
  - **多登录方式**：当前还有 Frappe 用户名密码 / Token 登录，它们没有 JWT，是“服务端 session + Cookie”。若只对 Logto 用“前端存 token”，则需中间层同时支持：**Cookie session**（Frappe/旧逻辑）与 **Authorization Bearer**（Logto），两套鉴权路径。
- **适用**：希望中间层完全无状态、且能接受“token 在浏览器”的 XSS 权衡时；或仅对 Logto 用户采用、其它登录方式仍用 Cookie session。

## 推荐路线

1. **抽象会话存储接口**  
   在 `sessionStore.ts` 中定义 `SessionStore` 接口（get/set/delete/可选 list），当前内存 Map 实现该接口，便于后续替换为文件或 Redis。

2. **默认仍为内存，增加可选「文件 store」**  
   - 通过环境变量选择 store 类型，例如 `SESSION_STORE=memory`（默认）或 `SESSION_STORE=file`。  
   - `SESSION_STORE=file` 时使用单文件（如 `SESSION_FILE_PATH`，默认 `./data/sessions.json`）或按 sessionId 分文件（如 `./data/sessions/sess_xxx.json`），启动时加载、运行时写回。  
   - 单进程下可定时或每次变更写盘，避免每次请求都写；会话含 token，文件建议仅限本机读写的路径并设 600 权限。

3. **可选：Redis store**  
   - 当 `SESSION_STORE=redis` 且配置 `REDIS_URL` 时，使用 Redis 实现同一 `SessionStore` 接口，便于多实例或生产统一会话。

4. **可选**：**前端存储 token**（见上 5）：Logto 用户 token 存前端，请求带 `Authorization: Bearer`，中间层无状态；需处理 refresh 与 XSS，且与 Frappe 等 Cookie 登录并存时需双路径鉴权。
5. **不采用**：把完整 session（含 token）放进 Cookie 的 stateless 方案，因数据量与安全风险不匹配当前需求。

## 实现要点（文件 store 示例）

- **格式**：JSON，如 `{ "sess_xxx": { "type": "logto", "user": "...", "logtoSub": "...", "expiresAt": 123456 }, ... }`，与当前 `Session` 结构一致（不含 sessionId key，仅 value 对象）。
- **加载**：进程启动时若存在文件则读取并填充到内存 Map（或直接作为 store 的 backing），过期项不加载或加载后立即删除。
- **写入**：`saveSession` / `updateSession` / `logoutSession` 时更新内存并同步写文件（可 debounce 或每 N 秒写一次，减少 IO）。
- **TTL**：保留现有定时任务按 `expiresAt` 清理内存，写回文件时只写未过期会话。
- **安全**：`SESSION_FILE_PATH` 建议放在仅本机可访问的目录，文件权限 600；若需加密，可对 value 做 AES 再写入（密钥来自 env）。

## 小结

- **原因**：认证丢失是因为会话只存在内存 Map，重启即清空。  
- **方向**：抽象 store → 默认内存不变 → 增加**文件 store** 实现重启后保持认证；有需要时再增加 **Redis store** 支持多实例。  
- **可选**：**前端存储 token**：Logto 的 token 由前端保存并带 `Authorization: Bearer`，中间层无状态、重启不影响；需权衡 XSS、并实现 refresh 与（若保留 Frappe 登录）双路径鉴权。  
- **不推荐**：把完整 session（含 token）放进 Cookie 的无状态方案。

文档与实现可放在：`docs/SESSION_PERSISTENCE.md`（本文）、`middleware/src/services/auth/sessionStore.ts`（接口 + 内存实现）、`middleware/src/services/auth/sessionStoreFile.ts`（文件实现，可选新建）。
