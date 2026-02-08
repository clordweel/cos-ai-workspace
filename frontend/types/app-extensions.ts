import type { Component } from 'vue'

/**
 * 工作台应用扩展：第三方或内置应用在应用区以独立标签页形式展示。
 * 扩展通过 useAppExtensions().register() 注册，首页与侧栏据此渲染入口与图标。
 */
export interface AppExtension {
  /** 唯一标识，用于标签页 appId、路由等 */
  id: string
  /** 展示名称（首页卡片、标签标题） */
  name: string
  /** 简短描述（首页卡片副标题） */
  description?: string
  /** 图标：Vue 组件（如 lucide-vue-next 的组件） */
  icon: Component
  /** 应用内容区使用的根组件；懒加载请使用 defineAsyncComponent(() => import('./MyApp.vue')) */
  component: Component
  /** 排序权重，越小越靠前；不设则按注册顺序 */
  order?: number
  /** 是否需要登录后才显示/打开 */
  requireAuth?: boolean
}
