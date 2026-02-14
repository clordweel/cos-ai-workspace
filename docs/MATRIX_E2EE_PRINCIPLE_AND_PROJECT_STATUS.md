# Matrix 加密会话原理与本项目现状

> 说明「是否只有创建加密会话的客户端才能解密」以及本项目无法解密加密消息的根本原因。最后更新：2026-02-14。

---

## 一、Matrix E2EE 原理简述

### 1.1 谁可以解密加密房间消息？

**结论：不是「只有创建加密房间的客户端才能解密」。**

- 加密房间使用 **Megolm**（组会话）：发送方设备生成会话密钥，用该密钥加密消息，再把**会话密钥分发给房间内其他参与者**（以及自己的其他设备）。
- **能解密的设备** = 任何**已收到该消息对应 Megolm 会话密钥**的设备，包括：
  - 发送方设备（持有 outbound 会话）；
  - 房间内**其他成员的设备**（接收方通过 to-device 或 key 请求拿到密钥）；
  - **同一用户的其他设备**（发送方会向自己的其他已注册设备转发密钥，或通过 Key Backup 恢复）。
- 因此：**Cinny 创建的加密房间**，在本项目（同一 Matrix 用户、另一设备/浏览器）上**理论上可以解密**，前提是：
  1. 本项目客户端**启用了 E2EE**（deviceId + 加密层初始化）；
  2. 本设备**能拿到密钥**：例如发送方把 key 发给了本 device_id、或用户在本设备上做了 **Key Backup 恢复**、或通过 key request 从其他设备转发。

### 1.2 新设备为何经常解不开历史？

- 新设备登录时，**历史消息的 Megolm 密钥**通常还没到本设备：
  - 发送方只会把 key 发给「当时已知的」设备；
  - 新设备若未做 **Key Backup 恢复**（或未从其他设备 request key），就收不到历史密钥，只能看到 “Unable to decrypt” 或 “This message was sent before this device logged in” 等。
- 这与「是否由 Cinny 创建房间」无关，只与「本设备是否拥有对应会话密钥」有关。

---

## 二、本项目无法解密的根因：未启用 E2EE

### 2.1 现状

| 环节 | 现状 | 影响 |
|------|------|------|
| 前端 createClient | 仅传 `baseUrl, accessToken, userId, logger`，**未传 deviceId** | matrix-js-sdk 文档明确：*If deviceId is not specified, end-to-end encryption will be disabled.* |
| 前端 | 未调用 `initRustCrypto()` / `initCrypto()`，未配置 CryptoStore / pickleKey | 无加密层，不参与解密、不上传 device key、不请求/存储 Megolm 密钥。 |
| 中间层 /api/auth/me | 只下发 `matrixSyncToken`（access_token）、`matrix_base_url`、`matrix_user_id`，**未下发 device_id** | 前端无法以「固定设备」身份参与 E2EE，即使想启用也无 deviceId。 |
| 中间层登录 | Matrix login 返回中有 `device_id`，但 session 只存 `matrixAccessToken`、`matrixTokenExpiresAt`，**未存未传 device_id** | 后端有 device_id 但未给前端用。 |

因此：**加密房间消息拉不到、展示不了，不是因为「只有 Cinny 能解密」，而是本项目当前根本没有启用 E2EE，SDK 收到的一直是未解密的 `m.room.encrypted` 事件，自然没有明文 body。**

### 2.2 与「创建者才能解密」的区别

- **错误理解**：Cinny 建的加密房，只有 Cinny 能解密。
- **正确理解**：任何**拥有 Megolm 密钥**的客户端（包括同用户的本项目）都能解密；本项目目前**没有加密层**，所以从不解密，与谁创建房间无关。

---

## 三、已实现的 E2EE 支持（2026-02-14）

以下步骤已落地，用于在本项目中启用加密房间解密：

1. **后端**  
   - 获取 token 后通过 **whoami** 拿到 **device_id**，写入 session 的 **matrixDeviceId**；  
   - `GET /api/auth/me` 在返回 `matrixSyncToken` 时一并返回 **matrix_device_id**；  
   - 清除 token 时同时清除 matrixDeviceId。

2. **前端**  
   - 从 `/api/auth/me` 读取 **matrix_device_id**，在 **useMatrixSyncClient** 中：  
     - 使用 **deviceId** 调用 `createClient({ baseUrl, accessToken, userId, deviceId, ... })`；  
     - 若存在 `deviceId` 且 client 有 `initRustCrypto`，则调用 **await client.initRustCrypto()** 启用 Rust Crypto（WASM）解密。  
   - 解密完成后通过 **RoomEvent.TimelineRefresh** 重填当前房间消息（见 ENCRYPTED_ROOM_MESSAGES_ROOT_CAUSE.md）。

3. **仍可能遇到的情况**  
   - **新设备 / 未做 Key Backup**：历史消息若未向本 device 发送过密钥，仍会显示「无法解密」，需用户在其他客户端做 **Key Backup** 并在本端恢复，或由发送方设备转发 key。  
   - **initRustCrypto 失败**：WASM 加载或存储异常时会在控制台告警，客户端会以降级方式继续（不解密）。

**结论**：加密会话消息无法拉取/展示的根因是**未启用 E2EE**；现已通过 device_id + initRustCrypto 启用解密。若仍有个别房间或历史消息无法解密，多为**本设备尚未获得对应 Megolm 密钥**（Key Backup 恢复或 key 请求未完成）。

---

## 五、本设备尚未拿到 Megolm 密钥时如何解决

当加密会话里出现「无法解密」或只看到自己发的消息、看不到对方回复时，多半是**本设备（本浏览器/本会话）还没有收到对应的 Megolm 会话密钥**。可按下面方式之一处理。

### 方式一：Key Backup 恢复（推荐，可解密历史）

1. **在「已有密钥」的客户端上开启并备份密钥**  
   使用**能正常看到该加密会话消息**的客户端（如 Element Web/Desktop、Cinny、SchildiChat）：
   - **Element**：设置 → 安全与隐私 → 安全备份 → 启用「使用安全备份」并设置恢复密码（或使用 Key Passphrase），按提示完成备份。
   - **Cinny**：设置 → 安全 → 安全备份 → 启用备份并设置恢复密码。
2. **在本项目所在浏览器里恢复**  
   - 本项目当前**未提供** Key Backup 恢复界面，需要依赖同一 Matrix 账号在**其他客户端**上完成恢复；  
   - 若你已在 Element/Cinny 等客户端用**同一账号**登录，并在该客户端里做了「从备份恢复」或「验证此设备」并输入恢复密码，则该客户端会拉取备份中的密钥。  
   - **重要**：Megolm 密钥是按「设备」存的；在本项目浏览器里用的 device_id 与 Element/Cinny 不同。要在**本浏览器**解密，需要：
     - **方案 A**：在 matrix-js-sdk 中接入 Key Backup 恢复（本项目尚未实现），在本浏览器登录后输入恢复密码，从服务器拉取备份并导入，本设备即可解密历史。
     - **方案 B（临时）**：在 Element/Cinny 用同一账号登录**本浏览器**（或同一台电脑上的同一浏览器 profile），在 Element/Cinny 里做一次恢复，这样该浏览器里的 Element/Cinny 会持有密钥；本项目的会话与 Element 是不同 device，**仍无法直接共享**，因此若要在本项目里解密，仍需方案 A 或方式二。

**结论**：要在本项目当前浏览器里解密历史，最可靠的方式是**在本项目中实现「从 Key Backup 恢复」**（输入恢复密码 → 拉取备份 → 导入密钥）。该功能尚未实现前，可先用方式二保证**新消息**能解密。

### 方式二：让对方（或自己从另一设备）再发一条消息

- 发送方再次发消息时，会向**当前已知设备**（包括本项目所用 device_id，若已登录且 Sync 正常）分发 Megolm 密钥。
- **效果**：通常只能解密**这条新消息及之后的消息**，之前的历史仍可能显示为「无法解密」。
- **适用**：本设备是新登录的、或刚加入加密房间，主要关心新对话即可时。

### 方式三：在 Element 里对本设备/会话「请求密钥」（Request keys）

- 在 **Element** 中：打开该加密房间 → 某条无法解密的消息上会提示「请求密钥」或 "Request keys" → 点击后，其他已解密的设备（如你的手机或另一台电脑上的 Element）会收到请求，**在那边点「分享」** 后，密钥会发到本设备。
- **效果**：本设备收到密钥后，该房间时间线会刷新，对应历史消息可解密（本项目若已监听 TimelineRefresh，会重填并显示）。
- **前提**：你至少有一个**已能解密该房间**的客户端（如手机 Element），且在该客户端上同意分享密钥。

### 小结

| 目标 | 建议 |
|------|------|
| 在本项目里解密**历史**加密消息 | 需在本项目实现 Key Backup 恢复并输入恢复密码；目前未实现，可先用 Element/Cinny 在其它设备查看历史。 |
| 只关心**新消息**能正常显示 | 让对方或自己从另一设备再发一条；或在本项目保持登录并 Sync，新消息的 key 会自动发到本 device。 |
| 已有其它设备能解密 | 在 Element 里对本设备「请求密钥」并在已解密设备上点「分享」。 |

---

## 六、相关文件速查（含本次实现）

| 用途 | 文件 |
|------|------|
| 前端 Sync Client（deviceId + initRustCrypto） | `frontend/composables/useMatrixSyncClient.ts` |
| 前端 auth 读取 matrix_device_id | `frontend/composables/useAuth.ts` |
| 中间层 /api/auth/me 下发 matrix_device_id | `middleware/src/routes/auth.ts` |
| whoami 取 device_id、session 存 matrixDeviceId | `middleware/src/adapters/matrixClient.ts`（getMatrixWhoami）、`matrixSessionToken.ts`、`sessionStore.ts` |
| 加密房间根因与 TimelineRefresh 修复 | `docs/ENCRYPTED_ROOM_MESSAGES_ROOT_CAUSE.md` |
| matrix-js-sdk createClient 与 E2EE | [ICreateClientOpts](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html)（deviceId、cryptoStore、pickleKey 等） |
