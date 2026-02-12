/**
 * 本地偏好设置：使用单条 localStorage 记录集中管理
 * 键：workspace-local-preferences，值：JSON 对象
 */
export type SessionThemeMode = 'light' | 'dark' | 'system'

export interface LocalPreferences {
  uiFontSizeStep?: number
  sessionTheme?: SessionThemeMode
  appFavorites?: string[]
}

const STORAGE_KEY = 'workspace-local-preferences'

const LEGACY_KEYS = {
  uiFontSizeStep: 'app-ui-font-size',
  sessionTheme: 'session-area-theme',
  appFavorites: 'workspace-app-favorites',
} as const

function loadRaw(): LocalPreferences {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        return {
          uiFontSizeStep: typeof parsed.uiFontSizeStep === 'number' ? parsed.uiFontSizeStep : undefined,
          sessionTheme: ['light', 'dark', 'system'].includes(parsed.sessionTheme as string)
            ? (parsed.sessionTheme as SessionThemeMode)
            : undefined,
          appFavorites: Array.isArray(parsed.appFavorites)
            ? (parsed.appFavorites as string[]).filter((x): x is string => typeof x === 'string')
            : undefined,
        }
      }
    }
  } catch {}
  return {}
}

/** 从旧版独立 key 迁移数据到统一存储 */
function migrateFromLegacy(): LocalPreferences {
  const current = loadRaw()
  let changed = false
  const merged = { ...current }

  try {
    if (merged.uiFontSizeStep == null) {
      const v = localStorage.getItem(LEGACY_KEYS.uiFontSizeStep)
      const n = v != null ? parseInt(v, 10) : NaN
      if (!Number.isNaN(n) && n >= 1 && n <= 5) {
        merged.uiFontSizeStep = n
        changed = true
      }
    }
    if (merged.sessionTheme == null) {
      const v = localStorage.getItem(LEGACY_KEYS.sessionTheme) as SessionThemeMode | null
      if (v === 'light' || v === 'dark' || v === 'system') {
        merged.sessionTheme = v
        changed = true
      }
    }
    if (merged.appFavorites == null) {
      const raw = localStorage.getItem(LEGACY_KEYS.appFavorites)
      if (raw) {
        const parsed = JSON.parse(raw)
        const arr = Array.isArray(parsed) ? parsed.filter((x: unknown): x is string => typeof x === 'string') : []
        if (arr.length > 0) {
          merged.appFavorites = arr
          changed = true
        }
      }
    }
  } catch {}

  if (changed) {
    saveRaw(merged)
    // 移除旧 key，避免重复迁移
    try {
      localStorage.removeItem(LEGACY_KEYS.uiFontSizeStep)
      localStorage.removeItem(LEGACY_KEYS.sessionTheme)
      localStorage.removeItem(LEGACY_KEYS.appFavorites)
    } catch {}
  }

  return merged
}

function saveRaw(prefs: LocalPreferences) {
  if (!import.meta.client) return
  try {
    const toSave: Record<string, unknown> = {}
    if (prefs.uiFontSizeStep != null) toSave.uiFontSizeStep = prefs.uiFontSizeStep
    if (prefs.sessionTheme != null) toSave.sessionTheme = prefs.sessionTheme
    if (prefs.appFavorites != null) toSave.appFavorites = prefs.appFavorites
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {}
}

/** 读取并合并（含旧数据迁移，优先用新 key） */
function load(): LocalPreferences {
  if (!import.meta.client) return {}
  const merged = migrateFromLegacy()
  const raw = loadRaw()
  return { ...merged, ...raw }
}

/** 部分更新并持久化 */
function patch(updates: Partial<LocalPreferences>) {
  const current = load()
  const next = { ...current }
  if (updates.uiFontSizeStep !== undefined) next.uiFontSizeStep = updates.uiFontSizeStep
  if (updates.sessionTheme !== undefined) next.sessionTheme = updates.sessionTheme
  if (updates.appFavorites !== undefined) next.appFavorites = updates.appFavorites
  saveRaw(next)
  return next
}

/**
 * 集中管理本地偏好：单条 localStorage 记录，JSON 存储
 */
export function useLocalPreferences() {
  return {
    load,
    patch,
  }
}
