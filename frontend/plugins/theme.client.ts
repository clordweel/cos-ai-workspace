/**
 * 在 @nuxtjs/color-mode 已设置 html class 后，同步 meta theme-color，避免首屏闪动。
 * 具体主题 class 与持久化由 @nuxtjs/color-mode 负责。
 */
export default defineNuxtPlugin(() => {
  const isDark = document.documentElement.classList.contains('dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', isDark ? '#0a0a0a' : '#fafafa')
})
