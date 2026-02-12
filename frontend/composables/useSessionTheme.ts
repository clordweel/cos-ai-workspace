import { computed, watch } from 'vue'
import type { SessionThemeMode } from '~/composables/useLocalPreferences'

export type { SessionThemeMode }

function getStored(): SessionThemeMode {
  if (!import.meta.client) return 'system'
  const { load } = useLocalPreferences()
  const v = load().sessionTheme
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'system'
}

/**
 * 会话区独立主题：仅作用于会话区域（列表 + 聊天），与应用区/全局主题可不同。
 * 持久化经 useLocalPreferences 统一管理。
 */
export function useSessionTheme() {
  const colorMode = useColorMode()
  const sessionThemeMode = ref<SessionThemeMode>('system')

  if (import.meta.client) {
    sessionThemeMode.value = getStored()
    watch(
      sessionThemeMode,
      (v) => {
        const { patch } = useLocalPreferences()
        patch({ sessionTheme: v })
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
