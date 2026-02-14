# 前端 Matrix 实时消息（Sync）方案评估

> 说明当前「前端直连 matrix-js-sdk 做 sync」的做法、遇到的问题与可选替代方案。最后更新：2026-02-13。

---

## 一、当前方案（方案二/三 · Sync 已实现）

- **做法**：前端在拿到 `/api/auth/me` 下发的 `matrixSyncToken`、`matrix_base_url`、`matrix_user_id` 后，用 **matrix-js-sdk** 创建 Client、`startClient()`，通过 `ClientEvent.Event` 接收新消息并 append 到当前会话；typing/已读经 `useMatrixSyncClient` 的 `sendTyping`/`sendReadReceipt` 在 `useSpaceChatPane` 中调用。
- **入口**：`frontend/composables/useMatrixSyncClient.ts`；在 `useSpacePage` 中当 `hasSyncToken` 为 true 时调用 `startSyncClient()`，失败时单次 2.5s 后重试；登出或 token 清空时 `stopSyncClient()`。
- **baseUrl**：优先使用 API 下发的 `matrix_base_url`，为空时回退到 `NUXT_PUBLIC_MATRIX_BASE_URL`（便于浏览器直连时使用公网/代理地址）。
- **优点**：实时路径短、不占用中间层长连接；与 Element 等客户端的「前端 sync」模式一致；资源占用最优（方案二/三）。

---

## 二、CJS/ESM 互操作问题（频发原因）

matrix-js-sdk 虽声明 `"type": "module"`，但**部分依赖**仍是 CommonJS（无 `export default` / 命名导出与 ESM 解析方式不一致）。在 Vite 开发/构建时，这些包被按 ESM 加载，会报错例如：

- `does not provide an export named 'default'`（如 unhomoglyph、loglevel）
- `does not provide an export named 'EventEmitter'`（如 events）

**根本原因**：SDK 面向 Node/Webpack 等环境，依赖树中 CJS 包较多，Vite 的依赖预构建（esbuild）只有被纳入预构建的包才会被正确做 CJS→ESM 转换。

---

## 三、当前应对：optimizeDeps.include 逐个纳入

在 `frontend/nuxt.config.ts` 的 `vite.optimizeDeps` 中，**一次性纳入 matrix-js-sdk 及其除 WASM 外的直接依赖**，由 Vite 统一预构建并做 CJS→ESM 互操作；**`@matrix-org/matrix-sdk-crypto-wasm` 必须放在 `exclude`**，因其通过 `import('./pkg/xxx.wasm')` 加载 WASM，预构建后 WASM 不会复制到 deps 目录会导致 404。

```ts
optimizeDeps: {
  include: [
    'matrix-js-sdk',
    'another-json',
    'bs58',
    'content-type',
    'events',
    'jwt-decode',
    'loglevel',
    'matrix-events-sdk',
    'matrix-widget-api',
    'oidc-client-ts',
    'p-retry',
    'sdp-transform',
    'unhomoglyph',
    'uuid',
  ],
  exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
},
```
注：不包含 `@babel/runtime`，因其无 `"."` 入口，作为 optimizeDeps 顶层条目会触发 "Missing . specifier"；预构建 matrix-js-sdk 时会自动拉入。修改 optimizeDeps 后若仍出现 WASM 404，可删除 `frontend/node_modules/.vite` 与 `frontend/.nuxt` 后重跑 `pnpm dev`。

**曾单独暴露问题的包**（已包含在上述列表中）：

| 包名 | 报错位置示例 | 说明 |
|------|--------------|------|
| unhomoglyph | utils.ts | default export |
| loglevel | logger.ts | default export |
| events | typed-event-emitter.ts | EventEmitter 命名导出 |
| matrix-events-sdk | extensible_events.ts | NamespacedValue 等命名导出 |
| content-type | parse 等 | 命名导出 |

**若仍出现新包报错**（多为 SDK 的**传递依赖**）：从报错路径确认包名，将该包名追加到 `optimizeDeps.include` 数组，清空 `node_modules/.vite` 与 `.nuxt` 后重新 `pnpm dev`。

**局限性**：仅能覆盖当前列出的直接依赖；若 matrix-js-sdk 的**传递依赖**中有 CJS 包未被打进预构建，仍可能偶发新报错，届时按上句追加即可。

---

## 四、方案对比与替代选项

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **A. 当前做法**（前端 SDK + optimizeDeps 修补） | 实现简单，实时路径短，无需改中间层 | CJS 问题可能随依赖变化复现，需维护 include 列表 | 可接受偶尔新增包时补一刀的情况 |
| **B. 后端 Sync**（中间层跑 Matrix Client，前端只收 SSE/WS） | 前端无 matrix-js-sdk，彻底避免 CJS/ESM 问题；可统一鉴权与限流 | 中间层需维护每用户长连接与 Sync 状态，实现与运维复杂度高 | 希望前端零 CJS 风险、且能接受后端改造成本时 |
| **C. 独立 ESM 壳包**（用 esbuild 等把 matrix-js-sdk 打成单 ESM 再被前端引用） | 一次打包可固化 CJS 互操作 | 需单独构建与版本同步，SDK 升级要重打 | 多项目复用同一 SDK 版本且希望前端不再碰 CJS 时 |

**建议**：

- **短期**：继续采用方案 A，按报错包名扩展 `optimizeDeps.include`，并在本文档「已知需纳入的包」表中更新，便于后续排查。
- **若 CJS 报错反复出现、影响迭代**：评估将 Sync 迁到中间层（方案 B），由中间层持有 Matrix Client、将新消息通过 SSE 或 WebSocket 推给前端；前端仅消费自有 API，不再直接依赖 matrix-js-sdk。

---

## 五、相关文件

| 文件 | 说明 |
|------|------|
| `frontend/nuxt.config.ts` | `vite.optimizeDeps.include` 配置 |
| `frontend/composables/useMatrixSyncClient.ts` | Sync 客户端启动与事件处理 |
| `docs/MATRIX_INTEGRATION_STATUS.md` | § 六 前端实时消息不可用排查 |
