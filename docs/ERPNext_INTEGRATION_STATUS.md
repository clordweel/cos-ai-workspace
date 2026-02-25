# ERPNext 整合状态

> 与运维/部署方确认后填写。用于 Frappe/ERPNext 整合接入（见 `.cursor/plans/` 中整合计划）。

---

## 确认清单

| 项 | 说明 | 状态/值 |
|----|------|---------|
| **版本与地址** | ERPNext 版本（是否 v16）、Base URL（如 `https://<erpnext-host>/api`） | _待确认_ |
| **cos App** | 物料相关接口（create_draft、create_from_draft、find_by_params 等）是否已上线，路径是否与 [API_SPEC](API_SPEC.md) 一致 | _待确认_ |
| **Logto 整合** | ERP 是否已配置为 Logto OAuth 客户端（同一租户）；用户用 Logto 登录 ERP 后是否可生成「用户级 API Key」 | _待确认_ |
| **备忘录** | 是否存在 DocType「Memo」或「备忘录」；若无，是否用 **ToDo** 试点或新建轻量 DocType「Memo」并开放 REST 权限 | _待确认_ |
| **权限** | Memo/ToDo 的读写在 ERP 侧所需角色/权限，以及 API Key 是否具备相同权限 | _待确认_ |

---

## 当前配置（apps/api）

- **认证方式**：单 Key 试跑 / 每用户 API Key（见 [AUTH_AND_USER_CONFIG](AUTH_AND_USER_CONFIG.md) 与整合计划第四节）
- **Base URL**：由 `apps/api/.env` 中 `COS_ERP_BASE` 配置
- **已对接接口**：见下方「已对接接口列表」

---

## 已对接接口列表

| 接口 | 说明 | 状态 |
|------|------|------|
| Memo CRUD | GET/POST/PATCH/DELETE `/api/memos`（对应 ERP `/api/resource/ToDo` 或 Memo DocType） | 已实现（apps/api + apps/web）；支持单 Key 或每用户 Key（授权管理连接） |
| 已连接服务 | GET `/api/connected-services`、POST `/:provider/connect`、DELETE `/:provider` | 已实现（ConnectorCredentialsStore + 授权管理视图） |
| cos 物料 | create_draft、create_from_draft、find_by_params（见 [API_SPEC](API_SPEC.md)） | 可选，后续接入 |

---

## 变更记录

| 日期 | 变更 |
|------|------|
| 2025-02 | 初版占位；Memo 试点已实现：config、frappeClient、memo 路由、前端备忘录应用（列表+新建+关联） |

---

## Memo 试点验收清单

- [ ] 在 apps/api 配置 `COS_ERP_BASE`、`COS_ERP_API_KEY`（见 [apps/api/.env.example](../apps/api/.env.example)）。
- [ ] 登录 CosAI（Logto）后，应用区打开「备忘录」，能列出 ERP 中的 ToDo（或 Memo）。
- [ ] 能新建一条备忘录并在 ERP 侧可见。
- [ ] 未配置 ERP 时，备忘录页显示「ERP 未配置」提示，不报错。
- [ ] 可选：编辑、删除与 ERP 侧权限一致。
