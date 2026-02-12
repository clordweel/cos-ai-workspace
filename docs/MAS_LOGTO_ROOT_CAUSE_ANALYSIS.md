# MAS 无法与 Logto 整合的根本原因分析

> 研究 MAS（Matrix Authentication Service）为何无法按预期实现「Logto 授权一次 → 自动获取 Matrix token 管理会话」的根因。调研日期：2025-02。

---

## 一、预期整合模型

| 环节 | 预期 |
|------|------|
| 用户入口 | 仅 Logto 登录，一次授权 |
| 中间层 | Logto 回调后，自动为该用户获取 Matrix access_token |
| 用户侧 | 无需知晓或输入 Matrix 密码，即可管理会话/聊天 |

---

## 二、MAS 的认证模型（设计取向）

MAS 的核心设计是为 **MSC3861** 服务的：将 Matrix 认证从原生密码迁移到 **OAuth 2.0 / OpenID Connect**。

### 2.1 MAS 支持的认证路径

| 路径 | 使用场景 | 用户交互 |
|------|----------|----------|
| **upstream_oauth2** | 配置 Google、GitHub、**Logto** 等为 IdP | 用户在 MAS 登录页选择 IdP，完成 **浏览器 OAuth 流程** |
| **m.login.password（兼容层）** | 迁移期支持传统客户端 | 用户输入用户名+密码（MAS 或迁移来的 Synapse 密码） |
| **Personal Session（Admin API）** | 自动化、脚本、bot 等 | **无用户交互**，admin 为指定用户签发 token |

### 2.2 MAS 与 Logto 的「官方」整合方式

MAS 文档中的 Logto 整合：在 `upstream_oauth2.providers` 中配置 Logto 为 IdP。

**流程**：
1. 用户打开 Element 或 MAS 登录页
2. 选择「使用 Logto 登录」
3. 跳转到 Logto 完成 OAuth 授权
4. 回调到 MAS，MAS 根据 `claims_imports`（如 `localpart: {{ user.preferred_username }}`）创建/关联用户
5. MAS 签发 Matrix token，客户端获得

**特点**：这是 **浏览器端 OAuth 流程**，用户必须在 MAS 登录页发起，完成一次 OAuth 跳转。

### 2.3 我们的整合模型与 MAS 的错位

| 维度 | 我们的模型 | MAS 的模型 |
|------|------------|------------|
| **入口** | 工作台 Logto 登录，用户只认 Logto | MAS 登录页或 Element，OAuth 由 MAS 发起 |
| **OAuth 发生时机** | Logto 回调时，中间层已有 session | 用户主动在 MAS/Element 发起 OAuth |
| **谁来拿 token** | **中间层**（服务端）代用户获取 | 客户端（浏览器/Element）通过 OAuth 回调获得 |
| **是否需用户再操作** | 不需要，一次 Logto 即可 | 若走 MAS OAuth，需用户在工作台外再完成一次 MAS 流程 |

**根本矛盾**：我们要求 **服务端无交互地** 为用户获取 Matrix token；MAS 的设计以 **客户端 OAuth 流程** 或 **兼容层密码登录** 为主，服务端代操仅依赖 **Personal Session**。

---

## 三、Personal Session：理论上可行，实际失效

### 3.1 设计意图

Admin 通过 `POST /api/admin/v1/personal-sessions` 传入 `actor_user_id`（目标用户的 MAS ULID），可为该用户签发 access_token，**无需用户密码、无需 OAuth**。这正是我们需要的路径。

### 3.2 实际表现

传入 `actor_user_id = 对应用户的 MAS ULID`，返回的 `access_token` 经 whoami 查询，对应 **admin**，而非该用户。

### 3.3 可能根因（待 MAS 社区确认）

1. **owner 与 actor 混淆**  
   - 请求由 `client_credentials`（admin client）发起，无关联用户。  
   - 若 MAS 实现中，在 owner 为用户时正确用 actor，在 owner 为 client 时错误回退到「默认用户」或 admin，则会出现此现象。

2. **admin_clients 与 admin 用户的映射**  
   - `policy.data.admin_clients` 含 admin client ID，`admin_users` 含 `"admin"`。  
   - 若实现中将「admin client 的调用」关联到 admin 用户，并错误地以 admin 用户作为 token 的 sub，则会返回 admin token。

3. **API 或实现 bug**  
   - 需查阅 [element-hq/matrix-authentication-service](https://github.com/element-hq/matrix-authentication-service) 源码中 personal-session 创建逻辑，确认 token sub 的设置规则。

**结论**：Personal Session 在文档上符合需求，但当前实现可能将 token 错误地签发给 admin，导致该路径不可用。

---

## 四、回退路径 setMasUserPassword + login：设计可行，实际失效

### 4.1 设计意图

当 Personal Session 不可用时，用 Admin API 在 MAS 中设密，再以 `m.login.password` 登录获取 token。MAS 兼容层应支持该流程。

### 4.2 实际表现

- `setMasUserPassword` 返回成功  
- `m.login.password` 返回 `Invalid username/password`  

### 4.3 可能根因

1. **用户来源与密码存储**  
   - 我们通过 `createMasUser(username)` 在 MAS 中创建用户，而非 syn2mas 迁移。  
   - `setMasUserPassword` 写入 MAS 密码库，新密码应使用 argon2id（v2）。  
   - 若配置或实现中，新建用户的密码未被正确存储或版本不匹配，会导致验证失败。

2. **identifier 解析**  
   - Matrix 规范：`m.id.user` 的 `user` 可为 localpart 或完整 MXID。  
   - 我们发送 `user: "@chenwensong:10.1.1.15"` 或 `"chenwensong"`。  
   - 若 MAS 兼容层对格式、大小写、服务器名等有特殊要求，可能导致解析不到对应用户。

3. **homeserver 与请求目标不一致**  
   - MAS 的 `matrix.homeserver` 需与 Synapse `server_name` 一致。  
   - login 请求的 Host、URL 可能影响 MAS 对「当前服务器」的判定；若不一致，可能导致用户解析失败。

4. **password_login_enabled**  
   - 若 MAS 配置中 `password_login_enabled: false` 或兼容层被禁用，会拒绝密码登录。

5. **密码兼容层的成熟度**  
   - 部分文档提到「Local password authentication (in development)」，暗示密码登录可能尚未完全稳定。

**结论**：回退路径在理论上是合理的，但受 MAS 实现、配置或兼容层限制，当前无法通过。

---

## 五、与 Logto 整合的架构断层

### 5.1 Logto 在 MAS 侧的「缺位」

我们 **未** 在 MAS 中配置 `upstream_oauth2` 指向 Logto，原因包括：

- 我们希望用户 **仅** 在工作台完成 Logto 登录，不再跳转到 MAS 登录页。
- MAS 的 upstream OAuth 是「用户 → MAS 登录页 → 选 IdP → OAuth → 回调 MAS」；这与「工作台 Logto 回调 → 中间层代取 Matrix token」的模型不同。

因此，在 MAS 视角下，**不存在** 来自 Logto 的 OAuth 会话，也没有「Logto sub → MAS 用户」的自动关联。

### 5.2 我们自建的映射

我们的映射是：`logtoSub / username → Matrix MXID → MAS username → MAS ULID`，由中间层在 Logto 回调后维护：

- 通过 `ensureMatrixUser` 创建 Synapse/MAS 用户；
- 通过 `getMasUserByUsername` 解析 MAS ULID；
- 再尝试 Personal Session 或 setMasUserPassword + login。

问题在于：**MAS 本身不感知 Logto**，仅能通过 Admin API 操作用户；而 Admin API 的两个关键能力（Personal Session、密码登录）在当前部署下均不可用。

### 5.3 根本矛盾总结

| 需求 | MAS 设计 | 结果 |
|------|----------|------|
| 服务端无用户交互代取 token | 依赖 Personal Session 或兼容层密码 | Personal Session 返回错误 token；密码登录验证失败 |
| Logto 一次授权即完成 | MAS 的 Logto 整合需 MAS 主导的 OAuth 流程 | 与我们「工作台唯一入口」的模型不符 |
| 用户无感知 Matrix | 需能自动签发或密码登录 | 两条路径均失效 |

**根本原因**：  
MAS 的 Logto 整合模型是「MAS 作为 OAuth 客户端，向 Logto 发起授权」；我们需要的是「Logto 已完成授权，中间层代替用户向 MAS 取 token」。这两种模型存在架构级差异，而我们依赖的「服务端代取」能力（Personal Session、程序化密码登录）在 MAS 侧要么实现有误，要么尚未完善，导致无法按预期工作。

---

## 六、可验证的排查步骤

1. **Personal Session**  
   - 向 MAS 社区提 issue，附请求/响应及 whoami 结果。  
   - 查阅源码中 `actor_user_id` 与 token sub 的映射逻辑。

2. **密码登录**  
   - 调用 `GET /api/admin/v1/site-config` 确认 `password_login_enabled`。  
   - 检查 `matrix.homeserver` 与 `server_name` 是否一致。  
   - 用 curl 直接对 MAS 发 `m.login.password`，尝试不同 identifier 格式（localpart、完整 MXID）。

3. **用户与密码**  
   - 在 MAS Admin 或 DB 中确认用户存在且密码已写入。  
   - 对比 `setMasUserPassword` 与 MAS 实际存储的密码哈希版本。

---

## 七、结论与建议

**根本原因（概括）**：

1. **架构不匹配**：我们需要的是「Logto 授权后，服务端代取 Matrix token」，而 MAS 的设计以「客户端 OAuth」和「浏览器端密码登录」为主。
2. **Personal Session 实现问题**：理论上支持服务端无密码代取，但当前实现返回 admin token，无法使用。
3. **兼容层密码登录不稳定**：setMasUserPassword 成功，但 m.login.password 验证失败，可能是实现、配置或兼容性问题。

**建议**：

1. **短期**：按 `MAS_ALTERNATIVES_RESEARCH.md` 执行**方案 A**，禁用 MAS，回退 Synapse 原生认证，使用 Admin 设密 + login 获取 token。
2. **中期**：向 MAS 社区反馈 Personal Session 与密码登录问题，跟踪修复与配置说明。
3. **长期**：若 MAS 支持服务端代取 token 的能力成熟，再评估重新启用 MAS。
