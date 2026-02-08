# 工作台应用扩展开发指南

工作台应用区支持**标准化扩展**：第三方或项目内可注册独立「应用」，在首页以卡片展示、在侧栏以标签页打开，实现可插拔能力。

## 扩展契约

- **注册表**：`useAppExtensions()`（composable）维护扩展列表；通过 `register(ext)` 注册、`unregister(id)` 卸载。
- **视图模型**：`useAppView()` 的 `currentView` 包含 `'app'`；当标签的 `view === 'app'` 且带 `appId` 时，应用内容区由该扩展的根组件渲染。
- **首页与侧栏**：首页应用卡片、侧栏标签图标与标题均来自扩展注册信息（name、description、icon）。

## 类型定义

扩展元数据实现接口 `AppExtension`（`~/types/app-extensions.ts`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一标识，用于标签 `appId`、区分扩展 |
| `name` | `string` | 展示名称（首页卡片、标签标题） |
| `description` | `string`（可选） | 简短描述（首页卡片副标题） |
| `icon` | `Component` | 图标组件（如 lucide-vue-next） |
| `component` | `Component` | 应用内容区根组件；懒加载请用 `defineAsyncComponent(() => import('./MyApp.vue'))` |
| `order` | `number`（可选） | 排序权重，越小越靠前 |
| `requireAuth` | `boolean`（可选） | 为 true 时仅登录用户可见/可打开 |

## 注册方式

在 **Nuxt 客户端插件** 中注册，确保在应用区渲染前执行（例如 `plugins/my-ext.client.ts`）：

```ts
// plugins/my-ext.client.ts
import { Package } from 'lucide-vue-next'
import MyApp from '~/components/my-ext/MyApp.vue'

export default defineNuxtPlugin(() => {
  const { register } = useAppExtensions()
  register({
    id: 'my-app',
    name: '我的应用',
    description: '简短说明',
    icon: Package,
    component: MyApp,
    order: 50,
    requireAuth: false,
  })
})
```

懒加载示例（按需加载扩展页面）：

```ts
import { defineAsyncComponent } from 'vue'
import { Package } from 'lucide-vue-next'

export default defineNuxtPlugin(() => {
  const { register } = useAppExtensions()
  register({
    id: 'my-app',
    name: '我的应用',
    description: '简短说明',
    icon: Package,
    component: defineAsyncComponent(() => import('~/components/my-ext/MyApp.vue')),
    order: 50,
  })
})
```

## 扩展根组件约定

- 扩展的 `component` 会在应用内容区**全区域**渲染（在 `AppPanel` 内、与首页/设置等同级）。
- 可使用项目内任意 composable（如 `useAppView`、`useChatSessions`、`useApiBase`、`useAuth`）。
- 样式建议与现有规范一致：圆角容器、`border-zinc-200`、浅色背景等（见 `.cursor/rules/frontend-spec.mdc`）。

## 内置占位应用

物料助手、订单进度、BOM 状态、库存概览由 `plugins/app-extensions.client.ts` 注册为占位应用，使用通用占位组件 `AppPlaceholder.vue`（显示「敬请期待」）。后续可替换为真实业务组件或从注册表移除。

## 与标签/导航的联动

- 用户点击首页某扩展卡片 → 调用 `addTab('app', ext.id)`，打开新标签并展示该扩展的 `component`。
- 侧栏标签的图标与标题：`WorkspaceAppNav` 通过 `useAppExtensions().get(tab.appId)` 取扩展的 `icon` 与 `name`。
- 未注册或已卸载的 `appId` 在内容区会显示「未找到该应用或扩展已卸载」。

## 小结

| 步骤 | 说明 |
|------|------|
| 1 | 实现 `AppExtension` 接口（id、name、description、icon、component 等） |
| 2 | 在 client 插件中调用 `useAppExtensions().register(ext)` |
| 3 | 扩展根组件按需使用 useAppView、useAuth、useApiBase 等 |
| 4 | 可选：懒加载 `component`、`requireAuth`、`order` 控制展示与顺序 |

按上述方式即可在不改动核心布局与路由的前提下，为工作台增加新的应用入口与内容区。
