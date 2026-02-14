<template>
  <aside
    v-show="isSessionExpanded || !chatId || appContentVisible"
    class="flex flex-col min-h-0 shrink-0 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 session-area"
    :class="isSessionExpanded ? 'w-72 border-r' : 'flex-1 min-w-0 overflow-hidden border-b border-zinc-200 dark:border-zinc-700'"
  >
    <div class="flex-1 min-h-0 flex flex-col min-w-0">
      <!-- 抽屉：高度过渡推动下方列表整体下移 -->
      <div
        class="flex shrink-0 overflow-hidden transition-[height] duration-200 ease-out"
        :style="{ height: showAppList ? `${appDrawerHeightRem}rem` : '0' }"
      >
        <div class="relative h-full w-full">
          <SpaceAppDrawer
            :open="showAppList"
            :fill-parent="true"
            :height-rem="appDrawerHeightRem"
            :common-apps="drawerCommonApps"
            :favorite-apps="drawerFavoriteApps"
            :is-active="drawerAppActive"
            @select="emit('drawer-select', $event)"
            @close="emit('app')"
            @more="emit('more')"
          />
        </div>
      </div>
      <!-- 列表块：顶栏 + 滚动区 + 底栏，随抽屉展开被整体推下 -->
      <div class="flex-1 min-h-0 flex flex-col relative min-w-0">
        <SessionListHeader
          class="shrink-0 z-10"
          :app-drawer-open="showAppList"
          :search-bar-open="showSearchBar"
          :search-query="searchQuery"
          :creating-session="creatingSession"
          :create-session-error="createSessionError"
          @update:search-query="emit('update:searchQuery', $event)"
          @new-chat="onNewChat"
          @search="emit('search')"
          @app="emit('app')"
        />
        <div class="flex-1 min-h-0 relative z-0 min-w-0 overflow-hidden">
          <SpaceSessionListContent
            :list-view-tab="listViewTab"
            :list-padding-top="listPaddingTop"
            :pinned-collapsed="pinnedCollapsed"
            :pinned-chats="pinnedChats"
            :show-mock-section="showMockSection"
            :mock-collapsed="mockCollapsed"
            :mock-chats="mockChats"
            :active-chats="activeChats"
            :pending-chats="pendingChats"
            :pinned-ids="pinnedIds"
            :chat-id="chatId"
            :is-session-expanded="isSessionExpanded"
            :search-query="searchQuery"
            :get-chat-date-label="getChatDateLabel"
            :get-non-read-count="getNonReadCount"
            :is-mock="isMock"
            :is-session-left-room="isSessionLeftRoom"
            :invited-sessions="invitedSessions ?? []"
            :on-accept-invite="onAcceptInvite"
            :on-decline-invite="onDeclineInvite"
            @update:pinned-collapsed="emit('update:pinnedCollapsed', $event)"
            @update:mock-collapsed="emit('update:mockCollapsed', $event)"
            @session-click="emit('session-click', $event)"
            @toggle-pin="emit('toggle-pin', $event)"
            @rename="emit('rename', $event)"
            @delete="emit('delete', $event)"
          />
        </div>
        <SessionListBottomNav
          :model-value="listViewTab"
          :pending-count="totalPendingCount"
          @update:model-value="emit('update:listViewTab', $event)"
        />
      </div>
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
  /** 创建会话中（Matrix 调用 API 时） */
  creatingSession?: boolean
  /** 创建会话失败时的错误信息 */
  createSessionError?: string | null
  listViewTab: 'active' | 'favorites' | 'pending' | 'settings'
  listPaddingTop: string
  pinnedCollapsed: boolean
  pinnedChats: DisplayChatItem[]
  showMockSection?: boolean
  mockCollapsed?: boolean
  mockChats?: DisplayChatItem[]
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
  isSessionLeftRoom?: (id: string) => boolean
  drawerAppActive: (app: DrawerAppItem) => boolean
  invitedSessions?: { id: string; title: string }[]
  onAcceptInvite?: (id: string, title: string) => void
  onDeclineInvite?: (id: string) => void
}>()

function onNewChat() {
  emit('new-chat')
}

const emit = defineEmits<{
  'update:pinnedCollapsed': [value: boolean]
  'update:mockCollapsed': [value: boolean]
  'update:searchQuery': [value: string]
  'update:listViewTab': [value: 'active' | 'favorites' | 'pending' | 'settings']
  'session-click': [id: string]
  'toggle-pin': [id: string]
  rename: [id: string]
  delete: [id: string]
  'new-chat': []
  search: []
  app: []
  more: []
  'drawer-select': [app: DrawerAppItem]
}>()
</script>
