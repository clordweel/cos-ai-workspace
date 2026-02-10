<template>
  <header
    class="session-list-header h-12 shrink-0 flex items-center justify-between gap-1 border-b border-zinc-200/60 dark:border-zinc-700/60 backdrop-blur-md bg-white/75 dark:bg-zinc-800/75 px-2"
    role="banner"
    aria-label="会话列表"
  >
    <!-- 竖三点图标紧贴头像，整体一点击打开/收起应用抽屉 -->
    <button
      type="button"
      class="flex shrink-0 items-center gap-0 rounded-lg p-0.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
      title="应用"
      aria-label="打开应用抽屉"
      @click="$emit('app')"
    >
      <MoreVertical class="h-3.5 w-3.5 shrink-0" />
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 dark:border-zinc-600/80 text-black dark:text-white"
      >
        <img
          v-if="userAvatarUrl"
          :src="userAvatarUrl"
          :alt="userName || '用户'"
          class="h-full w-full object-cover"
        />
        <span
          v-else-if="userName"
          class="text-[9px] font-medium text-zinc-600 dark:text-zinc-300"
        >
          {{ userFirstChar }}
        </span>
        <User v-else class="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
      </span>
    </button>
    <div class="flex min-w-0 flex-1 items-center justify-end gap-1">
      <SessionSearchBar
        :open="searchBarOpen"
        :model-value="searchQuery"
        @update:model-value="$emit('update:searchQuery', $event)"
        @toggle="$emit('search')"
      />
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"
        title="新会话"
        aria-label="新会话"
        @click="$emit('new-chat')"
      >
        <MessageSquarePlus class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { MessageSquarePlus, MoreVertical, User } from 'lucide-vue-next'
import { computed } from 'vue'
import { useAuth } from '~/composables/useAuth'

const props = withDefaults(
  defineProps<{
    appDrawerOpen?: boolean
    searchBarOpen?: boolean
    searchQuery?: string
    /** 可选：用户头像 URL，未传则用用户名首字或默认图标 */
    userAvatar?: string
  }>(),
  { appDrawerOpen: false, searchBarOpen: false }
)

defineEmits<{
  'new-chat': []
  search: []
  app: []
  'update:searchQuery': [value: string]
}>()

const { user } = useAuth()
const userName = computed(() => {
  const u = user.value
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && 'name' in u && typeof (u as { name?: string }).name === 'string') return (u as { name: string }).name
  return null
})
const userAvatarUrl = computed(() => {
  if (props.userAvatar) return props.userAvatar
  const u = user.value
  if (u && typeof u === 'object' && 'avatar' in u && typeof (u as { avatar?: string }).avatar === 'string')
    return (u as { avatar: string }).avatar
  return ''
})
const userFirstChar = computed(() => {
  const name = userName.value
  if (!name || !name.trim()) return '?'
  return name.trim().charAt(0).toUpperCase()
})
</script>
