const STORAGE_KEY = 'app-theme'

export default defineNuxtPlugin(() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    let isDark = false
    if (v === 'dark') isDark = true
    else if (v === 'system') isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    // v === 'light' or invalid: isDark stays false (default 浅色)
    if (isDark) {
      document.documentElement.classList.add('dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0a0a')
    } else {
      document.documentElement.classList.remove('dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fafafa')
    }
  } catch {}
})
