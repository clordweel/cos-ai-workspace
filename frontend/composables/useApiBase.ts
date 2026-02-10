/**
 * 解析实际请求用的 API 基址：避免「页面从别机打开、配置为 127.0.0.1」时直连失败，自动走同源代理。
 * 浏览器端：若配置的 base 与当前页同主机但不同端口（如页 3001、API 3000），返回空串使请求走同源并带 Cookie，由 Vite 代理转发。
 */
export function useApiBase(): string {
  const config = useRuntimeConfig()
  const configured = (config.public?.apiBase as string) || ''
  if (import.meta.server) return configured
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (!origin) return configured
  const isLocalBase =
    configured === 'http://127.0.0.1:3000' ||
    configured === 'http://localhost:3000' ||
    configured.startsWith('http://127.0.0.1:') ||
    configured.startsWith('http://localhost:')
  const isPageLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
  // 别机访问本地 API 时走配置的 base
  if (isLocalBase && !isPageLocal) return ''
  // 同机但不同端口（如前端 3001、中间层 3000）时走同源，否则 Cookie 不会随请求发送
  if (isPageLocal && isLocalBase && configured) {
    try {
      const baseUrl = new URL(configured)
      const pageUrl = new URL(origin)
      if (baseUrl.hostname === pageUrl.hostname && baseUrl.port !== pageUrl.port) return ''
    } catch {}
  }
  return configured
}
