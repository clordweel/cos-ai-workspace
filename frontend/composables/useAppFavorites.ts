function load(): string[] {
  if (!import.meta.client) return []
  const { load: loadPrefs } = useLocalPreferences()
  const arr = loadPrefs().appFavorites
  return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
}

/**
 * 应用扩展收藏：用于抽屉「常用与收藏」展示，持久化经 useLocalPreferences 统一管理。
 */
export function useAppFavorites() {
  const favoriteIds = ref<string[]>(load())

  if (import.meta.client) {
    onMounted(() => {
      favoriteIds.value = load()
    })
  }

  function isFavorite(id: string) {
    return favoriteIds.value.includes(id)
  }

  function toggle(id: string) {
    const next = favoriteIds.value.includes(id)
      ? favoriteIds.value.filter((x) => x !== id)
      : [...favoriteIds.value, id]
    favoriteIds.value = next
    if (import.meta.client) {
      const { patch } = useLocalPreferences()
      patch({ appFavorites: next })
    }
  }

  return {
    favoriteIds: readonly(favoriteIds),
    isFavorite,
    toggle,
  }
}
