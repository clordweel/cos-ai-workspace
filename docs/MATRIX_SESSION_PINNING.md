# Matrix 会话置顶与可行方案

## 结论摘要

- **Matrix 协议本身不提供「置顶」语义**，但提供 **Account Data** 与 **Room tags (m.tag)**，客户端可用它们实现置顶/排序并**跨设备同步**。
- 本项目前端已有置顶 UI（`pinnedIds`、置顶区、右键菜单），但 **置顶状态目前仅在内存**，刷新即丢失。
- 下面给出在 Matrix 上实现置顶的两种规范做法，以及不依赖后端的过渡方案。

---

## 一、Matrix 协议能力

### 1. Account Data（用户级键值存储）

- **接口**（需用户 access token）：
  - `GET /_matrix/client/v3/user/{userId}/account_data/{type}`
  - `PUT /_matrix/client/v3/user/{userId}/account_data/{type}`
- **说明**：`type` 为任意字符串（建议命名空间如 `com.workspace.pinned_rooms`），body 为任意 JSON。数据存在 homeserver，**跨设备同步**，适合存「用户偏好」。
- **限制**：仅当前用户可读写自己的 account data；规范未定义「置顶」的 type，由客户端自定义。

### 2. Room tags（m.tag）

- **接口**：同上 account_data，`type` 固定为 **`m.tag`**。
- **Body 格式**（规范）：
  ```json
  {
    "roomId1": { "order": 0.5 },
    "roomId2": { "order": 0.3 }
  }
  ```
- **说明**：以「标签」形式为每个房间存元数据；`order` 数值越小越靠前。Element 等客户端用 tag（如 `m.favourite`、自定义 tag）+ `order` 做列表排序与「收藏/置顶」展示。
- **特点**：与 Matrix/Element 生态一致，可做「按 tag 分组 + 组内按 order 排序」；实现上需读写整份 `m.tag` 并合并到会话列表排序。

---

## 二、可行方案对比

| 方案 | 存储位置 | 跨设备 | 实现复杂度 | 适用场景 |
|------|----------|--------|------------|----------|
| **A. Matrix Account Data（自定义 type）** | Synapse | ✅ | 中（中间层 + 前端） | 需要与 Matrix 一致、跨设备同步 |
| **B. Matrix Room tags (m.tag)** | Synapse | ✅ | 中高（需维护 m.tag 结构） | 希望与 Element 等客户端语义一致 |
| **C. Logto customData** | Logto | ✅ | 低（复用现有 PATCH preferences） | 偏好与账号强绑定、不强调 Matrix 生态 |
| **D. 前端 localStorage** | 浏览器 | ❌ 仅本机 | 低 | 快速落地、后续再接服务端 |

---

## 三、推荐实现路径

### 方案 A：Matrix Account Data（推荐）

- **思路**：用自定义 account_data type 存「置顶房间 ID 列表」，例如：
  - type：`com.workspace.pinned_rooms`（或项目内统一命名空间）
  - body：`{ "pinnedRoomIds": ["!xxx:server", "!yyy:server"] }`
- **中间层**：
  - 在 `matrixClient.ts` 中新增：`getAccountData(userToken, type)`、`setAccountData(userToken, type, content)`，内部调用 Matrix `GET/PUT .../account_data/{type}`（**必须使用用户 token**，禁止 admin token）。
  - 在会话相关路由中（需已具备 `matrixAccessToken`）：  
    - `GET /api/chat/sessions/pinned`：返回当前用户的 `pinnedRoomIds`（无则 `[]`）。  
    - `PUT /api/chat/sessions/pinned`：body `{ "pinnedRoomIds": string[] }`，写回 Matrix account_data。
- **前端**：
  - 进入 space 或会话列表加载后，请求 `GET /api/chat/sessions/pinned`，用返回结果初始化 `pinnedIds`（并过滤掉当前列表中不存在的 roomId，避免出现已退出的房间）。
  - 置顶/取消置顶时调用 `PUT /api/chat/sessions/pinned`，再更新本地 `pinnedIds`。
- **优点**：与 Matrix 房间一致、跨设备同步、不污染 Logto customData；实现清晰。
- **注意**：仅当 `CHAT_PROVIDER=matrix` 时提供上述 API；Mock 或其它 adapter 可返回空数组或走方案 D。

### 方案 B：Matrix Room tags (m.tag)

- **思路**：为需要「置顶」的房间打一个自定义 tag（如 `u.pinned` 或 `com.workspace.pinned`），并设 `order`；列表展示时先按「是否有该 tag」分组，再按 `order` 排序。
- **实现要点**：
  - 读取：`GET .../account_data/m.tag`，得到 `Record<roomId, { order?: number }>`，筛选出带置顶 tag 的房间（若用 tag 名作 key，需查规范/Element 对 m.tag 的扩展格式）。
  - 写入：为某 room 置顶时，在现有 m.tag 中为该 room 添加/更新 tag 与 order；取消置顶时删除对应 tag。**注意**：m.tag 是整份覆盖，需先 GET 再合并后 PUT。
- **优点**：与 Element 等客户端的「标签 + 排序」模型一致，便于日后与其它 Matrix 客户端互操作。
- **缺点**：需维护完整 m.tag 结构，实现与测试量略大。

### 方案 C：Logto customData

- **思路**：在用户 customData 中增加 `pinnedRoomIds?: string[]`，通过现有 `GET /api/auth/me` 与 `PATCH /api/auth/me/preferences`（或单独 PATCH customData）读写。
- **优点**：无需改 Matrix 适配器，复用现有偏好接口。
- **缺点**：房间 ID 是 Matrix 专属，若将来换会话后端需迁移；且 customData 更适合「账号级偏好」，与「Matrix 房间状态」语义略分离。

### 方案 D：仅前端持久化（过渡）

- **思路**：将 `pinnedIds` 持久化到 **localStorage**（可放入现有 `useLocalPreferences` 或单独 key），进入 space 时从 localStorage 恢复；置顶/取消时写回 localStorage。
- **优点**：不改中间层、不依赖 Matrix/Logto，实现最快；刷新同设备可保留。
- **缺点**：不跨设备、不跨浏览器；适合作为「先上线、后接服务端」的过渡，后续再接入方案 A 或 B。

---

## 四、与当前代码的对接

- **前端**：`useSpaceSessionList.ts` 中的 `pinnedIds` 当前为 `ref<string[]>(['mock-private-zhangsan', 'mock-group-product'])`，无持久化。  
  - 若采用 **方案 A/B**：在 space 页或 composable 内，会话列表加载完成后请求置顶列表并赋给 `pinnedIds`；`togglePin` 中在更新本地状态后调用 PUT API。  
  - 若采用 **方案 D**：在 `pinnedIds` 初始化时从 localStorage 读取；在 `togglePin` 中写回 localStorage（并注意只保留当前会话列表中存在的 id，避免脏数据）。
- **Mock 会话**：置顶列表中可以同时包含「真实 Matrix roomId」与「Mock 会话 id」；服务端 API 只负责 Matrix 的 account_data，前端可把「真实置顶」与「Mock 置顶」合并展示（例如真实从 API 拉取，Mock 从 localStorage 或内存合并）。

---

## 五、参考

- Matrix Client-Server API：Account Data、Room tagging（m.tag）  
  - https://spec.matrix.org/latest/client-server-api/#client-config  
  - https://spec.matrix.org/latest/client-server-api/#room-tagging  
- Element Web room list：tag 与 order 的用法  
  - https://web-docs.element.dev/Element%20Web/room-list-store.html  
- 本项目：`docs/MATRIX_CLIENT_BEST_PRACTICES.md`、`docs/AUTH_AND_USER_CONFIG.md`
