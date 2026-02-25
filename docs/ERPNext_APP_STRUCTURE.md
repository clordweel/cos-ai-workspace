# 以 ERPNext 为例的应用封装实现结构

> 说明「服务类应用」（需后端接口）在本仓库中的分层与数据流，便于扩展新应用（如 Outline、其他 DocType）时复用同一结构。

---

## 1. 分层总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│  应用区入口（apps/web）                                                   │
│  首页卡片 / 标签 → AppContent(view=app, appId) → 具体应用组件              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ fetch /api/...  (credentials: include)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  业务路由（apps/api）                                                     │
│  鉴权(Session) → 取凭证(Config 或 ConnectorCredentialsStore) → 调 Driver  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 内部调用
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Driver / 客户端（apps/api）                                              │
│  frappeClient（FrappeApp + db/call）→ 实际请求 ERPNext API                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + Bearer
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  外部系统（ERPNext）                                                       │
│  /api/resource/ToDo、/api/method/cos.api.*                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 各层职责与文件（以备忘录为例）

### 2.1 前端：应用入口与数据绑定

| 层级 | 文件 / 位置 | 职责 |
|------|-------------|------|
| **应用注册** | [constants/appView.ts](apps/web/src/constants/appView.ts) | `APP_DISPLAY_NAMES['memo-test']`、AppView 类型 |
| **路由分发** | [AppContent.tsx](apps/web/src/components/app/AppContent.tsx) | `view === 'app' && appId === 'memo-test'` → 渲染 MemoTestApp |
| **数据层** | [hooks/useMemos.ts](apps/web/src/hooks/useMemos.ts) | 调用 `GET/POST /api/memos`，维护 memos / loading / error / erpUnconfigured |
| **UI 组件** | [testApps/MemoTestApp.tsx](apps/web/src/components/app/testApps/MemoTestApp.tsx) | 列表、新建、503 提示、「关联到当前会话」 |
| **首页入口** | [HomeContent.tsx](apps/web/src/components/app/HomeContent.tsx) | 卡片「备忘录」→ `onOpenApp('memo-test')` |

约定：前端**不直连** ERPNext，仅请求 apps/api 的 `/api/*`，依赖 Cookie 登录态。

### 2.2 后端：路由与鉴权

| 层级 | 文件 / 位置 | 职责 |
|------|-------------|------|
| **路由注册** | [index.ts](apps/api/src/index.ts) | `memoRoutes`、`connectedServicesRoutes` |
| **业务路由** | [routes/memo.ts](apps/api/src/routes/memo.ts) | `GET/POST/PATCH/DELETE /api/memos`；Session 鉴权；取 ERP Token；调 frappeClient；统一错误转 HTTP |
| **凭证解析** | [routes/memo.ts](apps/api/src/routes/memo.ts) 内 `getErpTokenForSession` | 优先 `config.cos.apiKey`，否则 `ConnectorCredentialsStore.get(logtoSub, 'erpnext').apiKey` |
| **授权管理** | [routes/connectedServices.ts](apps/api/src/routes/connectedServices.ts) | `GET /api/connected-services`、`POST /:provider/connect`、`DELETE /:provider`，写 ConnectorCredentialsStore |

约定：所有需 ERP 的请求先 `getSessionFromCookie`，再取 Token（单 Key 或每用户 Key），再调 Driver。

### 2.3 Driver：与 ERPNext 的对接

| 层级 | 文件 / 位置 | 职责 |
|------|-------------|------|
| **配置** | [config.ts](apps/api/src/config.ts) | `config.cos.baseUrl`、`config.cos.apiKey`（可选） |
| **客户端封装** | [services/frappeClient.ts](apps/api/src/services/frappeClient.ts) | `createFrappeApp(baseUrl, token)`、`listMemos` / `getMemo` / `createMemo` / `updateMemo` / `deleteMemo`；内部用 frappe-js-sdk 的 `db().getDocList/createDoc/...` |
| **凭证存储** | [services/connectorCredentialsStore.ts](apps/api/src/services/connectorCredentialsStore.ts) | 按 `logtoSub + provider` 读/写/删；当前实现为 Logto customData 的 `connector_credentials` |

约定：Driver 只负责「用谁的身份、调哪个 API」；业务语义（如 Memo 用 ToDo DocType）在路由或 frappeClient 的封装函数内体现。

---

## 3. 数据流示例：列表示意

1. 用户打开应用区「备忘录」→ `AppContent` 渲染 `MemoTestApp`。
2. `MemoTestApp` 使用 `useMemos()` → 首次 `fetch('/api/memos', { credentials: 'include' })`。
3. **apps/api** `GET /api/memos`：
   - `getSessionFromCookie` → 401 或得到 session；
   - `isErpConfigured()`（baseUrl + 至少一种凭证来源）→ 否则 503；
   - `getErpTokenForSession(session)` → config.apiKey 或 ConnectorCredentialsStore；
   - 无 Token → 503「请先在授权管理中连接 ERPNext」；
   - `listMemos(config.cos.baseUrl, token)` → frappeClient 用 frappe-js-sdk 调 `/api/resource/ToDo`；
   - 返回 `{ memos: [...] }` 或统一错误体。
4. 前端 `useMemos` 解析 401/503/200，更新 memos / error / erpUnconfigured，组件展示列表或提示。

---

## 4. 扩展新应用时的对照清单

- **前端**：在 `appView.ts` 增加 appId 与展示名；在 `AppContent` 增加 `appId === 'xxx'` 分支并挂载对应组件；如需调用后端则新增 `useXxx`（调用 `/api/xxx`）；首页如需入口则在 `HomeContent` 加卡片。
- **后端**：在 `index.ts` 注册新路由；新建 `routes/xxx.ts`，鉴权 + 取凭证（若需连接器则用 `getConnectorCredentialsStore().get(logtoSub, 'erpnext')`）+ 调 Driver；若为新 DocType 或新接口，在 `frappeClient.ts` 增加封装函数（或新文件如 `outlineClient.ts`）。
- **凭证**：若需每用户独立连接，在 `connectedServices.ts` 的 `SUPPORTED_PROVIDERS` 中已包含 erpnext/outline；新 provider 可在此扩展，并在 ConnectorCredentialsStore 中使用同一接口。

---

## 5. 与「应用核心类型」的对应关系

- 备忘录属于**类型 B（需后端支持的服务类应用）**：数据在 ERPNext，必须经 apps/api；依赖 ConnectorCredentialsStore 与「ErpNext Driver」（frappeClient）。
- 若做「根据会话生成 Memo 待办」则进入**类型 C（AI 生成式）**：在类型 B 之上增加「会话/编排 → 草稿 → 确认卡片 → 再调同一 Driver 写入」的流程。

详见 `.cursor/plans/` 中 Frappe/ERPNext 整合计划第三节（应用核心类型）。
