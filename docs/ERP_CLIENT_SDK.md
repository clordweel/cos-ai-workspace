# ERPNext / Frappe 客户端 SDK 说明

> 用于实现前端业务数据时，是否存在可直接调用的 ERPNext 客户端 SDK，以及在本项目中的适用方式。

---

## 结论：存在官方推荐的 JS/TS SDK

**frappe-js-sdk** 是针对 Frappe 框架（含 ERPNext）的 TypeScript/JavaScript 客户端库，可直接调用 Frappe 的 REST API（含 `/api/method/...`），适合在 **Node 环境（如本项目的中间层）** 中封装对 cos / ERPNext 的访问。

- **npm**: [frappe-js-sdk](https://www.npmjs.com/package/frappe-js-sdk)
- **GitHub**: [The-Commit-Company/frappe-js-sdk](https://github.com/The-Commit-Company/frappe-js-sdk)
- **认证**: 支持用户名密码（Cookie）或 **Token（Bearer / API Key）**，与 cos 侧鉴权方式一致。

---

## 能力概览

| 能力 | 说明 |
|------|------|
| **认证** | `frappe.auth()`：loginWithUsernamePassword、getLoggedInUser、logout；或 `useToken: true` + token 函数 |
| **数据库** | `frappe.db()`：getDoc、getDocList、getCount、createDoc、updateDoc、deleteDoc、getValue、setValue、getSingleValue、submit、cancel、renameDoc |
| **API 调用** | `frappe.call()`：**get / post / put / delete**，对应后端 `@frappe.whitelist()` 的方法，路径为点分格式，映射到 `/api/method/<path>` |
| **文件** | `frappe.file()`：uploadFile（含进度回调） |
| **技术** | 基于 Axios，内置 TypeScript 类型 |

### 调用 cos 自定义接口示例

cos 在 Frappe 中暴露的接口形式为 `/api/method/cos.api.material.xxx`，用 SDK 的 `call` 即可：

```js
import { FrappeApp } from 'frappe-js-sdk';

const frappe = new FrappeApp(process.env.COS_ERP_BASE, {
  useToken: true,
  token: () => process.env.COS_ERP_API_KEY ?? '',
  type: 'Bearer',
});

const call = frappe.call();

// GET：例如 find_by_params
const { message: findResult } = await call.get('cos.api.material.find_by_params', {
  module: '2',
  material: '铸铁',
  spec: '',
});

// POST：例如 create_draft
const { message: draft } = await call.post('cos.api.material.create_draft', {
  module: '模数',
  material: '材质编码或名称',
  spec: '规格说明（可选）',
  quantity: 1,
  uom: 'Nos',
});

// POST：例如 create_from_draft
const { message: item } = await call.post('cos.api.material.create_from_draft', {
  draft_id: draft.draft_id,
  confirmed_by: 'user@example.com',
});
```

---

## 在本项目中的使用位置（重要）

根据 **ARCHITECTURE.md** 与 **BACKEND_STRATEGY.md**：

- **前端不直连 Frappe/ERPNext**，仅通过中间层（Fastify）访问；API Key / Token 只存在于中间层。
- 因此 **不应在前端（浏览器）中引入 frappe-js-sdk 并直连 ERPNext**，否则会违背「密钥隔离」与「仅经中间层」的架构。

**推荐用法**：在 **中间层（middleware）** 中使用 frappe-js-sdk，替代或封装当前基于 `fetch` 的 cos 调用（如 `cosClient.js`），实现：

1. 统一的 Base URL + Token 配置（与现有 `config.cos` 一致）。
2. 对 cos 的 `create_draft`、`create_from_draft`、`find_by_params`、`order_status`、`inventory.status`、`bom.status` 等方法的封装，便于类型与错误处理。
3. 前端业务数据仍全部经中间层接口（如 `POST /api/material/confirm`、未来的只读代理等）获取，**前端不直接依赖 ERPNext SDK**。

### 中间层引入示例

```bash
cd middleware && pnpm add frappe-js-sdk
```

在 apps/api 的 cos 相关服务（如 `cosClient` 或 `cosSdk`）中初始化一次 FrappeApp，对外暴露封装好的方法（如 `createFromDraft`、`createDraft`、`findByParams` 等），路由层继续调用这些方法即可。

---

## 其他可选方案

- **frappe-js-client**（[mussnad/frappe-js-client](https://github.com/mussnad/frappe-js-client)）：社区实现，功能与 frappe-js-sdk 类似，可按需对比维护状态与 API 风格。
- **直接 fetch**：当前项目已在 `cosClient.js` 中用 `fetch` 调 cos，若接口数量少、无需复用 DB 等能力，可继续用 fetch；引入 SDK 主要收益是 **call 方法语义清晰、易扩展只读/草稿等多接口** 以及 **TypeScript 类型**（若中间层迁到 TS）。

---

## 小结

| 问题 | 结论 |
|------|------|
| 是否存在 ERPNext 客户端 SDK？ | **有**，推荐使用 **frappe-js-sdk**，支持认证、DB、call（/api/method）、文件上传。 |
| 能否用于前端业务数据？ | **可以**，但应通过 **中间层** 使用 SDK 访问 cos/ERPNext，前端只消费中间层提供的 API，不直连 ERPNext。 |
| 实现前端业务数据支持时 | 在中间层用 frappe-js-sdk 封装 cos 只读与物料相关接口，前端通过现有及后续的 `/api/*` 获取业务数据即可。 |
