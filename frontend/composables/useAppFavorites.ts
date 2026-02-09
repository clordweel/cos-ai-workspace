const STORAGE_KEY = 'workspace-app-favorites'

function load(): string[] {
  if (import.meta.server) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function save(ids: string[]) {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

/**
 * 应用扩展收藏：用于抽屉「常用与收藏」展示，持久化到 localStorage。
 */
export function useAppFavorites() {
  const favoriteIds = ref<string[]>(load())

  function isFavorite(id: string) {
    return favoriteIds.value.includes(id)
  }

  function toggle(id: string) {
    const next = favoriteIds.value.includes(id)
      ? favoriteIds.value.filter((x) => x !== id)
      : [...favoriteIds.value, id]
    favoriteIds.value = next
    save(next)
  }

  return {
    favoriteIds: readonly(favoriteIds),
    isFavorite,
    toggle,
  }
}
