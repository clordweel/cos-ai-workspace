<template>
  <div
    class="session-list-scroll-area absolute left-0 right-0 bottom-0 z-0 overflow-y-auto overscroll-contain pb-24"
    :style="{ top: listPaddingTop }"
  >
    <template v-if="listViewTab === 'active'">
      <div class="min-h-full flex flex-col">
        <section class="session-list-pinned border-b border-zinc-100 dark:border-zinc-700/80 bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-l-amber-400/70 dark:border-l-amber-500/50 rounded-r-md">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 rounded-r-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-inset"
            @click="emit('update:pinnedCollapsed', !pinnedCollapsed)"
          >
            <component :is="pinnedCollapsed ? ChevronRight : ChevronDown" class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <Pin class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span class="flex-1">置顶</span>
            <span
              v-if="pinnedChats.length > 0"
              class="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md bg-amber-200/80 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200 text-[11px] font-semibold tabular-nums"
            >
              {{ pinnedChats.length }}
            </span>
          </button>
          <ul v-show="!pinnedCollapsed && pinnedChats.length !== 0" class="divide-y divide-amber-100 dark:divide-amber-900/40">
            <SessionListItem
              v-for="c in pinnedChats"
              :key="c.id"
              :item="c"
              :is-active="c.id === chatId && isSessionExpanded"
              :is-mock="isMock(c.id)"
              :is-pinned="true"
              :date-label="getChatDateLabel(c.id)"
              @click="emit('session-click', c.id)"
              @toggle-pin="emit('toggle-pin', c.id)"
              @rename="emit('rename', c.id)"
              @delete="emit('delete', c.id)"
            />
          </ul>
        </section>
        <!-- Mock 会话折叠区：与置顶区同结构，便于开发前样式调试 -->
        <section
          v-if="showMockSection"
          class="session-list-mock border-b border-zinc-100 dark:border-zinc-700/80 bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-l-amber-400/70 dark:border-l-amber-500/50 rounded-r-md"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 rounded-r-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-inset"
            @click="emit('update:mockCollapsed', !mockCollapsed)"
          >
            <component :is="mockCollapsed ? ChevronRight : ChevronDown" class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <Pin class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span class="flex-1">Mock 会话</span>
            <span
              v-if="mockChats.length > 0"
              class="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md bg-amber-200/80 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200 text-[11px] font-semibold tabular-nums"
            >
              {{ mockChats.length }}
            </span>
          </button>
          <ul v-show="!mockCollapsed && mockChats.length !== 0" class="divide-y divide-amber-100 dark:divide-amber-900/40">
            <SessionListItem
              v-for="c in mockChats"
              :key="c.id"
              :item="c"
              :is-active="c.id === chatId && isSessionExpanded"
              :is-mock="true"
              :is-pinned="pinnedIds.includes(c.id)"
              :date-label="getChatDateLabel(c.id)"
              @click="emit('session-click', c.id)"
              @toggle-pin="emit('toggle-pin', c.id)"
              @rename="emit('rename', c.id)"
              @delete="emit('delete', c.id)"
            />
          </ul>
        </section>
        <section class="flex-1 min-h-0 flex flex-col">
          <template v-if="activeChats.length !== 0">
            <ul class="divide-y divide-zinc-100 dark:divide-zinc-700 min-h-full">
              <SessionListItem
                v-for="c in activeChats"
                :key="c.id"
                :item="c"
                :is-active="c.id === chatId && isSessionExpanded"
                :is-mock="isMock(c.id)"
                :is-pinned="pinnedIds.includes(c.id)"
                :date-label="getChatDateLabel(c.id)"
                @click="emit('session-click', c.id)"
                @toggle-pin="emit('toggle-pin', c.id)"
                @rename="emit('rename', c.id)"
                @delete="emit('delete', c.id)"
              />
            </ul>
          </template>
          <div
            v-else-if="searchQuery"
            class="flex-1 min-h-0 flex flex-col items-center justify-center"
          >
            <Empty
              compact
              title="无匹配会话"
              description="试试其它关键词"
              :icon="Search"
            />
          </div>
        </section>
      </div>
    </template>
    <template v-else-if="listViewTab === 'favorites'">
      <div class="min-h-full flex flex-col items-center justify-center">
        <Empty
          compact
          title="收藏与归档"
          description="暂无收藏或归档会话"
          :icon="Archive"
        />
      </div>
    </template>
    <template v-else-if="listViewTab === 'pending'">
      <div class="min-h-full flex flex-col">
        <section class="border-b border-zinc-100 dark:border-zinc-700/80 px-3 py-2">
          <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400">未读、发送中、已送达等（非已读）</p>
        </section>
        <section v-if="pendingChats.length > 0" class="flex-1 min-h-0 overflow-y-auto">
          <ul class="divide-y divide-zinc-100 dark:divide-zinc-700">
            <li
              v-for="c in pendingChats"
              :key="c.id"
              role="button"
              tabindex="0"
              class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/40 rounded-md"
              @click="emit('session-click', c.id)"
              @keydown.enter.prevent="emit('session-click', c.id)"
            >
              <SessionListThumb
                :type="c.type === 'group' ? 'group' : 'private'"
                :participants="c.participants ?? [{ name: c.title }]"
              />
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ c.title }}</p>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{{ getChatDateLabel(c.id) }}</p>
              </div>
              <span class="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-[11px] font-semibold tabular-nums">
                {{ getNonReadCount(c.id) }}
              </span>
              <span class="text-zinc-400 dark:text-zinc-500 text-xs">›</span>
            </li>
          </ul>
        </section>
        <div v-else class="flex-1 flex flex-col items-center justify-center">
          <Empty
            compact
            title="暂无待处理消息"
            description="已读以外的消息会出现在这里"
            :icon="Inbox"
          />
        </div>
      </div>
    </template>
    <template v-else-if="listViewTab === 'settings'">
      <SessionListSettings padding-top="0" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { Archive, ChevronDown, ChevronRight, Inbox, Pin, Search } from 'lucide-vue-next'
import { Empty } from '~/components/ui/empty'
import SessionListItem from '~/components/SessionListItem.vue'
import SessionListThumb from '~/components/SessionListThumb.vue'
import SessionListSettings from '~/components/space/SessionListSettings.vue'

export interface DisplayChatItem {
  id: string
  title: string
  type?: string
  updatedAt?: number
  participants?: { name: string }[]
}

defineProps<{
  listViewTab: 'active' | 'favorites' | 'pending' | 'settings'
  listPaddingTop: string
  pinnedCollapsed: boolean
  pinnedChats: DisplayChatItem[]
  /** 仅当 showMockSection 为 true 时展示；与置顶区同结构的 Mock 折叠区，便于样式调试 */
  showMockSection?: boolean
  mockCollapsed?: boolean
  mockChats?: DisplayChatItem[]
  activeChats: DisplayChatItem[]
  pendingChats: DisplayChatItem[]
  pinnedIds: string[]
  chatId?: string
  isSessionExpanded: boolean
  searchQuery: string
  getChatDateLabel: (id: string) => string
  getNonReadCount: (id: string) => number
  isMock: (id: string) => boolean
}>()

const emit = defineEmits<{
  'update:pinnedCollapsed': [value: boolean]
  'update:mockCollapsed': [value: boolean]
  'session-click': [id: string]
  'toggle-pin': [id: string]
  rename: [id: string]
  delete: [id: string]
}>()
</script>

<style scoped>
.session-list-scroll-area *::selection {
  background: rgb(59 130 246 / 0.18);
  color: inherit;
}
.session-list-scroll-area *::-moz-selection {
  background: rgb(59 130 246 / 0.18);
  color: inherit;
}
:global(.dark) .session-list-scroll-area *::selection {
  background: rgb(96 165 250 / 0.22);
  color: inherit;
}
:global(.dark) .session-list-scroll-area *::-moz-selection {
  background: rgb(96 165 250 / 0.22);
  color: inherit;
}
.session-list-scroll-area {
  scrollbar-gutter: stable;
}
.session-list-scroll-area::-webkit-scrollbar {
  width: 2px;
}
.session-list-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.session-list-scroll-area::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(161 161 170 / 0.4);
}
.session-list-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.6);
}
</style>
