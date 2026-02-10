import { computed, watch } from 'vue'

export type SessionThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'session-area-theme'

function getStored(): SessionThemeMode {
  if (import.meta.server) return 'system'
  try {
    const v = localStorage.getItem(STORAGE_KEY) as SessionThemeMode | null
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

/**
 * 会话区独立主题：仅作用于会话区域（列表 + 聊天），与应用区/全局主题可不同。
 * 持久化到 localStorage，解析后供会话区根节点 class 使用。
 */
export function useSessionTheme() {
  const colorMode = useColorMode()
  const sessionThemeMode = ref<SessionThemeMode>('system')

  if (import.meta.client) {
    sessionThemeMode.value = getStored()
    watch(
      sessionThemeMode,
      (v) => {
        try {
          localStorage.setItem(STORAGE_KEY, v)
        } catch {}
      },
      { immediate: false },
    )
    onMounted(() => {
      sessionThemeMode.value = getStored()
    })
  }

  /** 解析后的实际主题：system 时跟随全局 colorMode */
  const sessionThemeResolved = computed<'light' | 'dark'>(() => {
    const mode = sessionThemeMode.value
    if (mode === 'light') return 'light'
    if (mode === 'dark') return 'dark'
    return colorMode.value === 'dark' ? 'dark' : 'light'
  })

  const isSessionDark = computed(() => sessionThemeResolved.value === 'dark')

  function setSessionTheme(mode: SessionThemeMode) {
    sessionThemeMode.value = mode
  }

  return {
    sessionThemeMode,
    sessionThemeResolved,
    isSessionDark,
    setSessionTheme,
  }
}
