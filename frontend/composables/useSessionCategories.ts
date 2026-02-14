/**
 * 会话列表分类状态：置顶、活跃、未读等
 * 供 SessionDrawer / SessionListContent 使用，与计划阶段 2 的 useSessionCategories 对应
 */
import { computed, type Ref } from 'vue'

export type SessionCategoryItem = {
  id: string
  title: string
  updatedAt?: number
  type?: string
  participants?: { name: string }[]
}

export function useSessionCategories(options: {
  displayChats: Ref<SessionCategoryItem[]>
  pinnedIds: Ref<string[]>
  getNonReadCount: (id: string) => number
  mockSessionListEnabled: Ref<boolean>
  isMockSessionId: (id: string) => boolean
}) {
  const {
    displayChats,
    pinnedIds,
    getNonReadCount,
    mockSessionListEnabled,
    isMockSessionId,
  } = options

  const byLastActive = (a: SessionCategoryItem, b: SessionCategoryItem) =>
    (b.updatedAt ?? 0) - (a.updatedAt ?? 0)

  const pinnedChats = computed<SessionCategoryItem[]>(() =>
    displayChats.value
      .filter((c) => pinnedIds.value.includes(c.id))
      .sort(byLastActive)
  )

  const mockChats = computed<SessionCategoryItem[]>(() => {
    if (!mockSessionListEnabled.value) return []
    return displayChats.value.filter(
      (c) => isMockSessionId(c.id) && !pinnedIds.value.includes(c.id)
    )
  })

  const activeChats = computed<SessionCategoryItem[]>(() => {
    const base = mockSessionListEnabled.value
      ? displayChats.value.filter((c) => !isMockSessionId(c.id))
      : displayChats.value
    return base
      .filter((c) => !pinnedIds.value.includes(c.id))
      .sort(byLastActive)
  })

  const pendingChats = computed<SessionCategoryItem[]>(() =>
    displayChats.value.filter((c) => getNonReadCount(c.id) > 0)
  )

  const totalPendingCount = computed(() =>
    displayChats.value.reduce((sum, c) => sum + getNonReadCount(c.id), 0)
  )

  return {
    pinnedChats,
    mockChats,
    activeChats,
    pendingChats,
    totalPendingCount,
    byLastActive,
  }
}
