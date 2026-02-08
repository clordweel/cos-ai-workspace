/**
 * 避免 GET /_nuxt/ 产生未处理的 404（如浏览器或缓存请求该路径时）
 */
export default defineEventHandler((event) => {
  const path = (event.node?.req?.url ?? event.path ?? '').split('?')[0]
  if (event.method === 'GET' && (path === '/_nuxt' || path === '/_nuxt/')) {
    setResponseStatus(event, 204)
    return null
  }
})
