# Matrix 密钥备份配置说明

> 密钥备份（Key Backup）用于把 E2EE 的 Megolm 密钥加密后存到 Synapse，换设备或重装后可用「恢复密钥/恢复密码」拉回密钥并解密历史消息。最后更新：2026-02。

---

## 一、服务端（Synapse）：无需额外配置

- **room_keys** 相关 API（如 `/_matrix/client/v3/room_keys/version`）是 Matrix 客户端-服务端规范的一部分，Synapse 默认支持。
- 只要请求能正确到达 Synapse（单域名时 Nginx 用 `location ^~ /_matrix` 转发），**无需在 Synapse 里单独开启或配置**密钥备份。
- 带 token 请求 `room_keys/version` 时：
  - **200 + 有 version**：该账号已创建过密钥备份。
  - **404**：该账号尚未创建备份，属正常；客户端可提示用户去「设置 → 安全备份」里创建。

---

## 二、在客户端「创建」密钥备份（推荐用 Element / Cinny）

密钥备份是**由客户端创建并上传**的，服务器只存加密后的数据。同一 Matrix 账号在任一支持备份的客户端里创建即可，之后其他设备可用「恢复密钥」恢复。

### 2.1 Element（Web / Desktop / 移动端）

1. 打开 **设置（Settings）** → **安全与隐私（Security & Privacy）**。
2. 找到 **安全备份（Secure Backup）** / **Recovery key**。
3. 点击 **启用「使用安全备份」**（或 “Set up”）。
4. 二选一：
   - **恢复密码（Key Passphrase）**：设一个密码，换设备时用该密码恢复（需牢记）。
   - **恢复密钥（Recovery Key）**：生成一串密钥，下载或抄写保存，换设备时输入该密钥恢复。
5. 按提示完成，客户端会把加密后的密钥上传到 Synapse；之后 `room_keys/version` 会返回版本信息。

### 2.2 Cinny

1. **设置** → **安全（Security）**。
2. **安全备份（Secure Backup）** → **启用备份**。
3. 设置恢复密码或恢复密钥，完成上传。

### 2.3 本仓库前端（apps/web）

- 当前**未提供**「创建密钥备份」或「从备份恢复」的界面。
- 如需备份：请用**同一 Matrix 账号**在 Element 或 Cinny 中按上面步骤创建。
- 创建后，该账号在任意客户端（包括本项目）登录时，SDK 请求 `room_keys/version` 会得到 200；在本项目里解密历史仍需要**在本项目中实现「从备份恢复」**（输入恢复密钥/密码并拉取密钥），该功能尚未实现，详见 `docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md` 第五节。

---

## 三、小结

| 角色 | 是否需要配置 | 说明 |
|------|--------------|------|
| **Synapse** | 否 | 默认支持 key backup API，保证 `/_matrix/*` 反代到 Synapse 即可。 |
| **创建备份** | 在客户端操作 | 使用 Element / Cinny 等：设置 → 安全备份 → 启用并设置恢复密钥/密码。 |
| **本项目 apps/web** | 暂无 UI | 创建备份请用 Element/Cinny；恢复备份需后续在项目中接 SDK 恢复流程。 |

---

## 四、相关文档

- 加密原理与「无法解密」排查：`docs/MATRIX_E2EE_PRINCIPLE_AND_PROJECT_STATUS.md`
- 单域名 Nginx（含 `/_matrix` 转发）：`docs/nginx-cosai-single-domain.conf`
