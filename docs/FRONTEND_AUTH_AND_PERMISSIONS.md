# 前端鉴权与权限最佳实践

本文约定前端中**免认证**、**需认证**、**分权限**三类操作与组件的实现方式，与中间层 401/403 及 Frappe 权限保持一致。

- **多认证源与用户无感**：**docs/UNIFIED_AUTH_DESIGN.md**；前端只消费「是否已登录」与「能力位」（如 `capabilities.erp`），不按认证源写死分支。
- **认证通用化与 Logto 唯一入口**（削去 ERP 业务、middleware 仅 Logto、需跳转授权的连接器）：**docs/AUTH_GENERIC_LOGTO_DESIGN.md**。

---

## 1. 三类操作定义

| 类型 | 说明 | 典型场景 |
|------|------|----------|
| **免认证** | 任何人可访问，不依赖登录状态 | 首页、公开对话、登录页、静态说明 |
| **需认证** | 必须已登录；未登录时引导去登录，不区分角色 | 发送消息、诊断、物料确认、需登录的应用扩展 |
| **分权限** | 在已登录基础上，按权限/角色控制能力 | 管理设置、写敏感资源、按 Frappe 权限控制的功能（未来扩展） |

---

## 2. 免认证操作

- **页面/路由**：不读取 `useAuth().isAuthenticated`，不调用 `requireAuth()`。
- **组件**：不根据登录状态隐藏或禁用；若同时有「登录后更多能力」，用「需认证」方式在具体操作上做校验。
- **API 调用**：若该接口中间层不校验 Cookie，可不带 `credentials: 'include'`（当前项目为统一带 Cookie，亦可保留）。
- **示例**：首页列表、打开免登录的应用扩展（`requireAuth: false`）、仅展示的对话流（若后端允许未登录只读）。

---

## 3. 需认证操作

原则：**前端引导体验，后端做真实鉴权**。前端根据 `isAuthenticated` 控制展示与入口，在发起敏感操作前可先 `requireAuth()`；接口仍由中间层校验 Cookie，未登录返回 401。

### 3.1 状态与引导

- 使用 `useAuth()` 的 **`isAuthenticated`**（只读）判断是否已登录。
- 需要登录才允许的操作，在**执行前**调用 **`requireAuth()`**：未登录则打开应用区「认证登录」标签并聚焦，返回 `false`，调用方应中止操作。
- 布局层在挂载时 `fetchUser()`，收到 401 或未登录时可选择打开认证标签（当前 workspace 已做）。

### 3.2 组件内

- **入口可见性**：例如应用扩展入口，若 `app.requireAuth === true`，未登录时从首页列表隐藏该应用（见 `homeAppList`）；侧栏/抽屉中也可根据 `isAuthenticated` 隐藏或置灰。
- **点击/提交前**：在「发送消息」「运行诊断」「确认创建物料」等操作前，若逻辑上必须登录，先 `if (!useAuth().requireAuth()) return`，再发请求。

### 3.3 API 请求与 401

- 所有需认证的请求统一 **`credentials: 'include'`**。
- 收到 **401** 时统一处理：调用 **`useAuth().requireAuth()`**（打开认证标签），并向上抛出或返回错误，便于 UI 提示「请先登录」。
- 已在以下位置采用该模式：
  - `useChatStream.ts`：流式请求 401 → `requireAuth()` + throw
  - `AppPanel.vue`：诊断 401 → `requireAuth()` + 设置错误信息
  - `MaterialConfirm.vue`：确认 401 → `requireAuth()`

### 3.4 应用扩展

- 扩展注册时通过 **`requireAuth?: boolean`** 声明是否需要登录。
- 首页/侧栏：`homeAppList = appExtensionsList.filter(app => !app.requireAuth || isAuthenticated)`。
- 打开应用时：`if (app.requireAuth && !isAuthenticated) return` 或先 `requireAuth()` 再打开。

---

## 4. 分权限操作（含未来扩展）

当前中间层 **`/api/auth/me`** 仅返回 `{ ok, user, type }`，无权限列表。后续若增加权限/角色，建议如下。

### 4.1 后端约定

- 在 **`/api/auth/me`** 中增加可选字段，例如：`permissions: string[]` 或 `roles: string[]`，由 Frappe / cos 或中间层根据当前用户填充。
- 写操作接口继续在中间层与 cos 内做**权限校验**，前端权限仅用于控制展示与入口，不做安全依据。

### 4.2 前端约定

- 使用 **`usePermissions()`**（`composables/usePermissions.ts`）统一封装：
  - **`can(permission: string): boolean`**：当前用户是否拥有某权限（依赖 `/api/auth/me` 返回的 `permissions`，未实现时恒为 `false`）。
  - **`canAccessApp(app: AppExtension): boolean`**：是否可访问该应用（免认证或已登录）。
  - **`requireAuth(): boolean`**：需登录时调用，未登录则打开认证标签并返回 `false`。
  - **`isAuthenticated`**、**`permissions`**：只读引用，便于模板或计算属性使用。
- 组件内：
  - **按钮/菜单**：`v-if="can('material:create')"` 或 `:disabled="!can('admin:settings')"`。
  - **应用扩展**：列表用 `canAccessApp(app)` 过滤；打开前 `if (!canAccessApp(app)) requireAuth()` 或直接 return。
  - **路由/页面**：在路由中间件或页面 `setup` 中若需权限，先 `requireAuth()`，再 `if (!can('xxx')) navigateTo('/space')` 或展示无权限提示。
- 权限名建议与 cos/Frappe 一致（如 `material:create`、`admin:settings`），便于前后端对照。

### 4.3 当前可做的准备

- **`useAuth()`** 已暴露 **`permissions`**（只读），并在 `fetchUser` 成功时从 `data.permissions` 同步、登出时清空；中间层尚未返回时为空数组。
- **`usePermissions().can(permission)`** 基于上述 `permissions`，后端在 `/api/auth/me` 中增加 `permissions: string[]` 后即可生效。
- 需要「仅登录」的 UI 控制用 **`isAuthenticated`** 或 **`usePermissions().requireAuth()`** 即可。

---

## 5. 路由与页面级保护（可选）

- 若整页必须登录：在 **Nuxt 路由中间件** 或 **layout** 中调用 `fetchUser()`，若未登录则 `requireAuth()` 并 `abortNavigation()` 或重定向到首页。
- 当前项目多为「单页 + 应用区」形态，未强制路由级保护，而是在具体操作与 401 时统一 `requireAuth()`；若后续增加纯需登录子路由，可采用上述中间件方式。

---

## 6. 小结

| 场景 | 做法 |
|------|------|
| 免认证 | 不依赖 `isAuthenticated`，不调用 `requireAuth()` |
| 需认证 | 用 `isAuthenticated` 控制入口/列表；操作前 `requireAuth()`；请求带 `credentials: 'include'`，401 时统一 `requireAuth()` |
| 分权限 | 用 `usePermissions().can(perm)` 控制按钮/菜单/路由；权限数据来自 `/api/auth/me`（未来）；真实校验在中间层与 cos |
| 应用扩展 | `requireAuth` 标记 + 列表过滤 + 打开前校验 |

所有**写操作**与敏感读操作，以**中间层与 cos 的鉴权/权限为准**；前端仅负责引导登录与按权限隐藏/禁用，不信任前端单独作为安全依据。

---

## 7. 使用 usePermissions 示例

```vue
<script setup lang="ts">
const { can, canAccessApp, requireAuth, isAuthenticated } = usePermissions()
</script>

<template>
  <!-- 分权限：仅拥有权限时显示 -->
  <button v-if="can('material:create')" @click="create">创建物料</button>

  <!-- 需认证：未登录时禁用并提示 -->
  <button :disabled="!isAuthenticated" @click="requireAuth() && submit()">提交</button>

  <!-- 应用列表过滤（canAccessApp 已考虑 requireAuth） -->
  <div v-for="app in appList.filter(canAccessApp)" :key="app.id" @click="open(app)">...</div>
</template>
```

在发起需认证的 API 请求后若收到 401，统一调用 `useAuth().requireAuth()` 或 `usePermissions().requireAuth()` 打开认证标签。
