# MAS 硬伤分析与替代方案调研

> 在 MAS（Matrix Authentication Service）实现存在硬伤时，本方案提供替代路径与选型建议。调研日期：2025-02。

---

## 一、MAS 方案已观察到的硬伤

### 1.1 createPersonalSession 返回 admin token

**现象**：调用 `POST /api/admin/v1/personal-sessions`，传入目标用户的 `actor_user_id`（MAS ULID），返回的 `access_token` 对应 admin，而非该用户。

**预期行为**（MAS 文档）：Personal Session 应为指定 `actor_user_id` 用户签发 token。

**可能原因**：
- MAS 实现或配置问题：admin client 权限、scope 解析错误
- MAS 版本或已知 bug
- 需向 [matrix-authentication-service](https://github.com/element-hq/matrix-authentication-service) 提 issue 确认

**影响**：中间层无法通过 Personal Session 无密码获取用户 token，被迫回退到 Admin 设密 + login。

### 1.2 回退路径 setMasUserPassword + login 仍失败

**现象**：MAS 设密成功（`setMasUserPassword` 返回 ok），随后 `m.login.password` 返回 `Invalid username/password`。

**架构背景**：
- Nginx 将 `/_matrix/client/*/login` 代理到 **MAS**（兼容层），而非 Synapse
- MAS 处理 m.login.password，验证密码
- Synapse Admin API 设密写 Synapse 内部存储；MAS 设密写 MAS 存储
- 若 login 由 MAS 处理，理论上应用 MAS 存储的密码

**可能原因**：
- MAS 兼容层对 identifier（m.id.user 的 user 字段）格式要求与 Synapse 不同
- 密码哈希或传播存在延迟
- MAS 与 Synapse 用户映射（username ↔ MXID）不一致
- 需查 MAS 兼容层源码或文档确认 m.login.password 的预期格式

**影响**：即便优先使用 MAS 设密，仍无法通过 login 获取用户 token，整个 MAS 路径失效。

### 1.3 小结：MAS 在当前部署下存在实现级硬伤

| 路径 | 预期 | 实际 |
|------|------|------|
| createPersonalSession | 返回对应用户 token | 返回 admin token |
| setMasUserPassword + login | 设密后 login 成功 | Invalid username/password |

在未修复 MAS 或确认配置前，**不应依赖 MAS 作为获取每用户 token 的主路径**。需要评估替代方案。

---

## 二、替代方案概览

| 方案 | 复杂度 | 依赖变更 | 无密码 | 可靠性 | 建议 |
|------|--------|----------|--------|--------|------|
| **A. 禁用 MAS，回退纯 Synapse** | 低 | 部署配置 | 否 | 高 | **短期首选** |
| **B. Synapse Admin 模拟** | 低 | 无 | 是 | 待验证 | 需查文档 |
| **C. Application Service** | 高 | AS 注册 | 是 | 中 | 中长期备选 |
| **D. 前端直连 Matrix** | 高 | 前端+部署 | 视 OIDC | 高 | 架构大改 |
| **E. 混合（直连 sync + 中间层）** | 中高 | 前端+部署 | 否 | 高 | 需先有 token |

---

## 三、方案 A：禁用 MAS，回退纯 Synapse（推荐短期）

### 3.1 思路

- 不再将 login/logout/refresh 代理到 MAS，改由 Synapse 原生处理
- 关闭 Synapse 的 `matrix_authentication_service` 委托
- 中间层继续使用 **Admin 设密 + m.login.password** 获取每用户 token
- 该路径已在无 MAS 环境下验证可行

### 3.2 部署变更步骤

1. **Nginx**：修改 `nginx-mas.conf` 或新建不含 MAS 代理的配置
   - 将 `/_matrix/client/*/(login|logout|refresh)` 改为代理到 **Synapse**（或直接删该规则，由默认 `/_matrix` 到 Synapse）
   - 或使用非 MAS 的 nginx 配置，不加载 `docker-compose.mas.yml`

2. **Synapse**：在 `homeserver.yaml` 中
   - 设置 `matrix_authentication_service.enabled: false`，或删除 `matrix_authentication_service` 配置块

3. **中间层**：在 `.env` 中
   - 不配置 `MAS_ADMIN_CLIENT_ID`、`MAS_ADMIN_CLIENT_SECRET`，或 `CHAT_PROVIDER` 仍为 matrix 但不走 MAS 路径
   - `matrixSessionToken.ts` 中 `isMasPreferred()` 将返回 false，自动回退到 Admin 设密

### 3.3 用户与密码迁移

- **syn2mas 迁移过的用户**：密码已导入 MAS，Synapse 内部可能为空或旧 hash
- **选项 1**：中间层首次请求时，`ensureMatrixTokenForSession` 会 `ensureMatrixUser` + Admin 设随机密码 + login，相当于重置为随机密码（与现有行为一致，用户无需知悉）
- **选项 2**：若有 mas2syn 或类似反向工具，可尝试导回；需查 MAS 生态
- **Element 等客户端**：若曾用 MAS OIDC 登录，回退后需用用户名+密码；用户若未设密码需通过 Admin API 或 recover 脚本重置

### 3.4 优缺点

| 优点 | 缺点 |
|------|------|
| 实现简单，部署改动集中 | 失去 MAS OIDC、Personal Session、无密码流程 |
| Admin 设密 + login 已稳定 | 需缓存密码或每次 Admin 设密 |
| 无新增依赖 | Element 等客户端需改回密码登录 |

---

## 四、方案 B：Synapse Admin 模拟（Impersonation）

### 4.1 思路

若 Synapse 支持 admin 以某 `user_id` 身份调用 Client-Server API，则无需每用户 token，仅用 admin token + 模拟头即可代用户操作。

### 4.2 调研结论

- Synapse 文档中有「Caller Impersonation」概念，但具体 API 与头部需查最新文档
- Admin API 的 `access_token` 用于管理员操作，未见标准「以 user_id 发 C-S 请求」的公开接口
- **当前判断**：Synapse 标准分发版本未提供成熟的 admin 模拟普通用户发 C-S 请求的能力；若存在，多为内部或实验性接口，不适合作为主方案依赖

### 4.3 建议

- 可作为补充调研：查阅 Synapse 源码 `rest/auth.py`、`handlers/` 等是否支持 impersonation 相关头
- 若未来版本明确支持，可考虑作为无密码、无 AS 的轻量方案

---

## 五、方案 C：Application Service (AS)

### 5.1 思路

- 注册 Matrix Application Service，配置 `as_token`、`sender_localpart`、`namespaces`
- AS 用 `as_token` 向 Synapse 发请求时，若有机制指定「以某 user_id 身份」操作，则可代用户发消息、建房、邀请等
- 规范中有 "masqueraded users" 概念，但 Synapse 对 AS 请求中 `user_id` 的传递方式未在公开文档中明确

### 5.2 实施复杂度

- 需实现 AS 的 HS→AS 回调：`/users/{userId}`、`/rooms/{roomAlias}` 等
- 需维护虚拟用户或 user_id 与 Logto 的映射
- 需确认 Synapse 是否支持、以及如何传递 `user_id`（header、query、body）

### 5.3 建议

- 作为**中长期备选**：若 MAS 长期不可用且不接受回退到密码方案，可投入时间验证 Synapse AS 的 masquerade 行为
- 参考：mautrix 等 AS 实现，以及 Synapse `ApplicationService` 相关源码

---

## 六、方案 D / E：前端直连与混合方案

详见 `SESSION_MATRIX_ANALYSIS.md` 第五、六节。

| 要点 | 说明 |
|------|------|
| **前端直连** | 前端持用户 Matrix token，直接调 Synapse；中间层做 AI 编排、bot 写回。需解决 token 获取（OIDC/密码）、CORS、安全。 |
| **混合** | 会话读写经中间层（每用户 token），sync/typing/已读由前端直连。前提仍是中间层能拿到每用户 token。 |

在 MAS 与回退路径均失效时，**每用户 token 的获取**仍是瓶颈。若采用方案 A（禁用 MAS），每用户 token 通过 Admin 设密 + login 获得，可在此基础上再做混合（前端持 token 做 sync 等）。

---

## 七、选型建议与实施顺序

### 7.1 短期（1–2 周内）

1. **首选：方案 A，禁用 MAS，回退纯 Synapse**
   - 修改 nginx 与 Synapse 配置，使 login 由 Synapse 处理
   - 中间层取消 MAS 偏好（不配 MAS_ADMIN_* 或确保 isMasPreferred 为 false）
   - 验证 Admin 设密 + login 能稳定获取每用户 token
   - 文档化回退步骤，便于运维执行

### 7.2 中期（1–3 月）

2. **并行：向 MAS 社区反馈**
   - 就 createPersonalSession 返回 admin token、setMasUserPassword 后 login 失败提交 issue
   - 跟踪 MAS 修复或配置指引
   - 若 MAS 修复，可重新评估启用 MAS

3. **可选：方案 B 补充调研**
   - 查 Synapse impersonation 相关实现，若有稳定接口再考虑采用

### 7.3 长期（3 月+）

4. **若 MAS 持续不可用且不接受密码方案**
   - 深入调研方案 C（AS masquerade）
   - 或评估方案 D/E（前端直连、混合），接受架构与职责变化

---

## 八、方案 A 实施清单（禁用 MAS）

- [ ] 备份当前 `nginx-mas.conf`、Synapse `homeserver.yaml`
- [ ] 修改 nginx：login/logout/refresh 改为代理到 Synapse，或移除 MAS 相关 proxy 规则
- [ ] 修改 Synapse：`matrix_authentication_service.enabled: false` 或删除该配置
- [ ] 重启 nginx、Synapse
- [ ] 中间层：确认不配置 `MAS_ADMIN_CLIENT_ID` 或 `MAS_ADMIN_CLIENT_SECRET`，或通过配置确保 `isMasPreferred()` 为 false
- [ ] 验证：用户 Logto 登录后，创建会话、发消息可正常使用
- [ ] 若使用 Element：引导用户使用「凭证」或「Access Token」登录（需事先通过 Admin 设密或 recover 脚本设密）

---

## 九、参考资料

- [MAS 与 Logto 整合根因分析](./MAS_LOGTO_ROOT_CAUSE_ANALYSIS.md) — 深入分析 MAS 无法实现 Logto 一次授权的根本原因
- [MAS 与 AS 调研](./MAS_AND_AS_RESEARCH.md)
- [会话设计 vs Matrix 能力](./SESSION_MATRIX_ANALYSIS.md)
- [Matrix Authentication Service 文档](https://element-hq.github.io/matrix-authentication-service/)
- [Synapse Application Services](https://matrix-org.github.io/synapse/develop/application_services.html)
- [MAS 迁移文档（含回退说明）](https://element-hq.github.io/matrix-authentication-service/setup/migration.html)
