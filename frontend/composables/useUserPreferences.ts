/**
 * 用户偏好：统一由 Logto customData 存储（仅 Logto 登录时同步）
 * 未登录时使用本地 localStorage/color-mode，登录后从 /api/auth/me 的 preferences 加载并可通过 PATCH 回写
 */
import type { ThemeMode } from '~/composables/useTheme'

const FONT_STEP_MIN = 1
const FONT_STEP_MAX = 5
const FONT_STEP_DEFAULT = 3
const STORAGE_KEY = 'app-ui-font-size'

function getStoredFontStep(): number {
  if (import.meta.client) {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      const n = v != null ? parseInt(v, 10) : NaN
      if (!Number.isNaN(n) && n >= FONT_STEP_MIN && n <= FONT_STEP_MAX) return n
    } catch {}
  }
  return FONT_STEP_DEFAULT
}

const scaleMap: Record<number, number> = {
  1: 10 / 16,
  2: 12 / 16,
  3: 14 / 16,
  4: 1,
  5: 18 / 16,
}

export function useUserPreferences() {
  const apiBase = useApiBase()
  const { isAuthenticated, preferences, fetchUser } = useAuth()
  const localFontStepRef = ref(getStoredFontStep())

  if (import.meta.client) {
    onMounted(() => {
      if (!isAuthenticated.value) localFontStepRef.value = getStoredFontStep()
    })
  }

  /** 当前主题（Logto 登录时来自 preferences，否则来自 color-mode） */
  const theme = computed<ThemeMode>(() => {
    if (isAuthenticated.value && preferences.value?.theme) {
      const t = preferences.value.theme as string
      if (t === 'light' || t === 'dark' || t === 'system') return t
    }
    const colorMode = useColorMode()
    return (colorMode.preference as ThemeMode) || 'light'
  })

  /** 字体档位 1–5（Logto 登录时来自 preferences，否则来自 localStorage） */
  const uiFontSizeStep = computed(() => {
    if (isAuthenticated.value && preferences.value?.uiFontSizeStep != null) {
      const n = Number(preferences.value.uiFontSizeStep)
      if (!Number.isNaN(n) && n >= FONT_STEP_MIN && n <= FONT_STEP_MAX) return Math.round(n)
    }
    return localFontStepRef.value
  })

  /** 会话区字体缩放倍数 */
  const sessionAreaFontScale = computed(() => scaleMap[uiFontSizeStep.value] ?? 14 / 16)

  function setUIFontSizeStep(step: number) {
    const clamped = Math.max(FONT_STEP_MIN, Math.min(FONT_STEP_MAX, Math.round(step)))
    if (isAuthenticated.value) {
      void savePreferences({ uiFontSizeStep: clamped })
    } else {
      localFontStepRef.value = clamped
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped))
      } catch {}
    }
  }

  const localNotificationsRef = ref(true)

  /** 通知开关（Logto 登录时来自 preferences，否则为本地 ref） */
  const notificationsEnabled = computed(() => {
    if (isAuthenticated.value && preferences.value?.notificationsEnabled !== undefined) {
      return Boolean(preferences.value.notificationsEnabled)
    }
    return localNotificationsRef.value
  })

  function setNotificationsEnabled(v: boolean) {
    if (isAuthenticated.value) {
      void savePreferences({ notificationsEnabled: v })
    } else {
      localNotificationsRef.value = v
    }
  }

  /** 将偏好写回 Logto customData（仅 Logto 登录时有效） */
  async function savePreferences(patch: {
    theme?: ThemeMode
    uiFontSizeStep?: number
    notificationsEnabled?: boolean
  }): Promise<boolean> {
    if (!isAuthenticated.value) return false
    const body: Record<string, unknown> = {}
    if (patch.theme !== undefined) body.theme = patch.theme
    if (patch.uiFontSizeStep !== undefined) body.uiFontSizeStep = Math.max(FONT_STEP_MIN, Math.min(FONT_STEP_MAX, Math.round(patch.uiFontSizeStep)))
    if (patch.notificationsEnabled !== undefined) body.notificationsEnabled = patch.notificationsEnabled
    if (Object.keys(body).length === 0) return true
    try {
      const res = await fetch(`${apiBase}/api/auth/me/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; preferences?: Record<string, unknown> }
      if (res.ok && data.ok && data.preferences) {
        const { preferences: current, setPreferences: setPref } = useAuth()
        setPref({ ...current, ...data.preferences })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    theme,
    uiFontSizeStep,
    sessionAreaFontScale,
    setUIFontSizeStep,
    notificationsEnabled,
    setNotificationsEnabled,
    savePreferences,
    refreshFromApi: fetchUser,
    FONT_STEP_MIN,
    FONT_STEP_MAX,
  }
}
