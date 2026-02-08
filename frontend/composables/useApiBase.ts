/**
 * 解析实际请求用的 API 基址：避免「页面从别机打开、配置为 127.0.0.1」时直连失败，自动走同源代理
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
  if (isLocalBase && !isPageLocal) return ''
  return configured
}
