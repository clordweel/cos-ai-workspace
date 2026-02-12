/**
 * 用户偏好：统一由 Logto customData 存储（仅 Logto 登录时同步）
 * 未登录时使用本地 localStorage/color-mode，登录后从 /api/auth/me 的 preferences 加载并可通过 PATCH 回写
 * 注意：界面字体大小（uiFontSizeStep）仅存本地，经 useLocalPreferences 统一管理
 */
import type { ThemeMode } from '~/composables/useTheme'

const FONT_STEP_MIN = 1
const FONT_STEP_MAX = 5
const FONT_STEP_DEFAULT = 3

function getStoredFontStep(): number {
  if (!import.meta.client) return FONT_STEP_DEFAULT
  const { load } = useLocalPreferences()
  const prefs = load()
  const n = prefs.uiFontSizeStep
  if (typeof n === 'number' && !Number.isNaN(n) && n >= FONT_STEP_MIN && n <= FONT_STEP_MAX) return Math.round(n)
  return FONT_STEP_DEFAULT
}

const scaleMap: Record<number, number> = {
  1: 10 / 16,
  2: 12 / 16,
  3: 14 / 16,
  4: 1,
  5: 18 / 16,
}

/** 字体档位全局状态（与 useAuth 同模式，保证设置页与聊天区共享）
 * 初始化必须用 FONT_STEP_DEFAULT，避免 SSR 与客户端 hydration 时从 localStorage 读取导致 style mismatch */
const localFontStepRef = ref(FONT_STEP_DEFAULT)

export function useUserPreferences() {
  const apiBase = useApiBase()
  const { isAuthenticated, preferences, fetchUser } = useAuth()

  if (import.meta.client) {
    onMounted(() => {
      localFontStepRef.value = getStoredFontStep()
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

  /** 字体档位 1–5（仅本地 localStorage，不持久化到后端） */
  const uiFontSizeStep = computed(() => localFontStepRef.value)

  /** 会话区字体缩放倍数 */
  const sessionAreaFontScale = computed(() => scaleMap[uiFontSizeStep.value] ?? 14 / 16)

  function setUIFontSizeStep(step: number) {
    const clamped = Math.max(FONT_STEP_MIN, Math.min(FONT_STEP_MAX, Math.round(step)))
    localFontStepRef.value = clamped
    if (import.meta.client) {
      const { patch } = useLocalPreferences()
      patch({ uiFontSizeStep: clamped })
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

  /** 将偏好写回 Logto customData（仅 Logto 登录时有效；不含 uiFontSizeStep，该设置仅存本地） */
  async function savePreferences(patch: {
    theme?: ThemeMode
    notificationsEnabled?: boolean
  }): Promise<boolean> {
    if (!isAuthenticated.value) return false
    const body: Record<string, unknown> = {}
    if (patch.theme !== undefined) body.theme = patch.theme
    if (patch.notificationsEnabled !== undefined) body.notificationsEnabled = patch.notificationsEnabled
    if (Object.keys(body).length === 0) return true
    const url = `${apiBase || ''}/api/auth/me/preferences`
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; preferences?: Record<string, unknown>; error?: string }
      if (res.ok && data.ok && data.preferences) {
        const { preferences: current, setPreferences: setPref } = useAuth()
        setPref({ ...current, ...data.preferences })
        return true
      }
      if (import.meta.dev && !res.ok) {
        console.warn('[preferences] PATCH 失败:', res.status, data?.error ?? data)
      }
      return false
    } catch (e) {
      if (import.meta.dev) {
        console.warn('[preferences] PATCH 请求异常:', e)
      }
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
