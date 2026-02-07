import { ref, computed, watch, readonly, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'app-theme'

export type ThemeMode = 'light' | 'dark' | 'system'

function getStored(): ThemeMode {
  if (import.meta.server) return 'light'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {}
  return 'light'
}

function getSystemDark(): boolean {
  if (import.meta.server) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyEffective(isDark: boolean) {
  if (import.meta.server) return
  const html = document.documentElement
  if (isDark) {
    html.classList.add('dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0a0a')
  } else {
    html.classList.remove('dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fafafa')
  }
}

const themeMode = ref<ThemeMode>(getStored())
const systemDark = ref(false)

const isDark = computed(() => {
  const mode = themeMode.value
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return systemDark.value
})

export function useTheme() {
  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {}
    applyEffective(isDark.value)
  }

  onMounted(() => {
    systemDark.value = getSystemDark()
    applyEffective(isDark.value)
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      systemDark.value = mql.matches
      applyEffective(isDark.value)
    }
    mql.addEventListener('change', listener)
    onUnmounted(() => mql.removeEventListener('change', listener))
  })

  watch(isDark, (v) => {
    applyEffective(v)
  }, { immediate: false })

  return {
    isDark: readonly(isDark),
    themeMode: readonly(themeMode),
    setTheme,
  }
}
