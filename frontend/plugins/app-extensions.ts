import { Package, ClipboardList, Layers, PackageOpen } from 'lucide-vue-next'
import AppPlaceholder from '~/components/AppPlaceholder.vue'

/**
 * 注册内置应用扩展（占位），供首页与侧栏展示。
 * 服务端与客户端均执行，保证 drawerApps 等依赖 list 的初始渲染一致，避免 hydration mismatch。
 * 第三方扩展可在自己的 client 插件中调用 useAppExtensions().register()。
 */
export default defineNuxtPlugin(() => {
  const { register } = useAppExtensions()
  const builtIn: Array<{ id: string; name: string; description: string; icon: typeof Package; order: number }> = [
    { id: 'material', name: '物料助手', description: '参数化创建球磨机零件', icon: Package, order: 10 },
    { id: 'order', name: '订单进度', description: '查询生产与交货状态', icon: ClipboardList, order: 20 },
    { id: 'bom', name: 'BOM 状态', description: '查看物料清单与齐套', icon: Layers, order: 30 },
    { id: 'inventory', name: '库存概览', description: '球磨机零件库存', icon: PackageOpen, order: 40 },
  ]
  builtIn.forEach((item) => {
    register({
      id: item.id,
      name: item.name,
      description: item.description,
      icon: item.icon,
      component: AppPlaceholder,
      order: item.order,
    })
  })
})
