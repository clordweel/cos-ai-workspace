<template>
  <aside
    v-show="isSessionExpanded || !chatId || appContentVisible"
    class="flex flex-col min-h-0 shrink-0 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 session-area"
    :class="isSessionExpanded ? 'w-72 border-r' : 'flex-1 min-w-0 overflow-hidden border-b border-zinc-200 dark:border-zinc-700'"
  >
    <div class="relative flex-1 min-h-0 flex flex-col min-w-0">
      <SpaceSessionListContent
        :list-view-tab="listViewTab"
        :list-padding-top="listPaddingTop"
        :pinned-collapsed="pinnedCollapsed"
        :pinned-chats="pinnedChats"
        :active-chats="activeChats"
        :pending-chats="pendingChats"
        :pinned-ids="pinnedIds"
        :chat-id="chatId"
        :is-session-expanded="isSessionExpanded"
        :search-query="searchQuery"
        :get-chat-date-label="getChatDateLabel"
        :get-non-read-count="getNonReadCount"
        :is-mock="isMock"
        @update:pinned-collapsed="emit('update:pinnedCollapsed', $event)"
        @session-click="emit('session-click', $event)"
        @toggle-pin="emit('toggle-pin', $event)"
        @rename="emit('rename', $event)"
        @close="emit('close', $event)"
      />
      <SpaceAppDrawer
        :open="showAppList"
        :height-rem="appDrawerHeightRem"
        :common-apps="drawerCommonApps"
        :favorite-apps="drawerFavoriteApps"
        :is-active="drawerAppActive"
        @select="emit('drawer-select', $event)"
        @close="emit('app')"
        @more="emit('more')"
      />
      <SessionListHeader
        class="absolute left-0 right-0 z-20 transition-[top] duration-200 ease-out bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md"
        :style="{ top: toolbarTop }"
        :app-drawer-open="showAppList"
        :search-bar-open="showSearchBar"
        :search-query="searchQuery"
        @update:search-query="emit('update:searchQuery', $event)"
        @new-chat="emit('new-chat')"
        @search="emit('search')"
        @app="emit('app')"
      />
      <SessionListBottomNav
        :model-value="listViewTab"
        :pending-count="totalPendingCount"
        @update:model-value="emit('update:listViewTab', $event)"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { DisplayChatItem } from '~/components/space/SessionListContent.vue'
import type { DrawerAppItem } from '~/components/space/AppDrawer.vue'
import SessionListBottomNav from '~/components/SessionListBottomNav.vue'
import SessionListHeader from '~/components/SessionListHeader.vue'
import SpaceAppDrawer from '~/components/space/AppDrawer.vue'
import SpaceSessionListContent from '~/components/space/SessionListContent.vue'

defineProps<{
  isSessionExpanded: boolean
  /** 应用区内容展开时为 true，此时始终显示会话列表、隐藏聊天区 */
  appContentVisible?: boolean
  chatId?: string
  listViewTab: 'active' | 'favorites' | 'pending' | 'settings'
  listPaddingTop: string
  toolbarTop: string
  pinnedCollapsed: boolean
  pinnedChats: DisplayChatItem[]
  activeChats: DisplayChatItem[]
  pendingChats: DisplayChatItem[]
  pinnedIds: string[]
  searchQuery: string
  showAppList: boolean
  showSearchBar: boolean
  appDrawerHeightRem: number
  drawerCommonApps: DrawerAppItem[]
  drawerFavoriteApps: DrawerAppItem[]
  totalPendingCount: number
  getChatDateLabel: (id: string) => string
  getNonReadCount: (id: string) => number
  isMock: (id: string) => boolean
  drawerAppActive: (app: DrawerAppItem) => boolean
}>()

const emit = defineEmits<{
  'update:pinnedCollapsed': [value: boolean]
  'update:searchQuery': [value: string]
  'update:listViewTab': [value: 'active' | 'favorites' | 'pending' | 'settings']
  'session-click': [id: string]
  'toggle-pin': [id: string]
  rename: [id: string]
  close: [id: string]
  'new-chat': []
  search: []
  app: []
  more: []
  'drawer-select': [app: DrawerAppItem]
}>()
</script>
