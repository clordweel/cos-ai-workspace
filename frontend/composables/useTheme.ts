import { computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * 基于 @nuxtjs/color-mode 的主题 composable，与 shadcn-vue 暗色模式文档一致。
 * 同步 meta theme-color，并对外保持原有 useTheme 接口供设置页等使用。
 * themeMode 使用可写 computed，确保 Select 等组件的 v-model 能正确更新。
 */
export function useTheme() {
  const colorMode = useColorMode()
  const { isAuthenticated, preferences } = useAuth()

  if (import.meta.client) {
    watch(
      () => colorMode.value,
      (value) => {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (meta) meta.setAttribute('content', value === 'dark' ? '#0a0a0a' : '#fafafa')
      },
      { immediate: true },
    )
    // Logto 登录后应用 customData 中的 theme
    watch(
      () => (isAuthenticated.value && preferences.value?.theme ? preferences.value.theme as ThemeMode : null),
      (theme) => {
        if (theme && (theme === 'light' || theme === 'dark' || theme === 'system')) {
          colorMode.preference = theme
        }
      },
      { immediate: true },
    )
  }

  const themeMode = computed<ThemeMode>({
    get: () => (colorMode.preference as ThemeMode) || 'light',
    set: (mode: ThemeMode) => {
      colorMode.preference = mode
    },
  })

  return {
    isDark: computed(() => colorMode.value === 'dark'),
    themeMode,
    setTheme(mode: ThemeMode) {
      colorMode.preference = mode
      if (isAuthenticated.value) {
        const { savePreferences } = useUserPreferences()
        void savePreferences({ theme: mode })
      }
    },
  }
}
