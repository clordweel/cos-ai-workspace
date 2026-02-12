<template>
  <!--
    会话区布局（由 workspace layout 的 grid 左列承载）：
    - 外层：session-area-container，flex-col，占满 layout 给的宽度。
    - 内层：flex-row（sm+ 双栏）或 flex-col（< sm 单栏）。
    - 左：SessionSidebar，sm+ 时 w-72(288px)，否则 flex-1；v-show 控制显隐。
    - 右：main 聊天区，flex-1 min-w-0，与列表左右并排时占剩余宽度。
    - 注意：layout 在 xl+ 且应用区展开时会话列给 1fr，否则 md～lg 应用区展开时给 288px（仅列表可见）。
  -->
  <div class="session-area-container h-full w-full min-w-0 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
    <div
      class="flex min-h-0 min-w-0 flex-1"
      :class="isSessionExpanded ? 'flex-row w-full' : 'flex-col'"
    >
      <SpaceSessionSidebar
        :is-session-expanded="isSessionExpanded"
        :app-content-visible="appContentVisible && showAppPanel"
        :chat-id="chatId"
        :creating-session="creatingSession"
        :create-session-error="createSessionError"
        :list-view-tab="listViewTab"
        :list-padding-top="listPaddingTop"
        :toolbar-top="toolbarTop"
        :pinned-collapsed="pinnedCollapsed"
        :pinned-chats="pinnedChats"
        :show-mock-section="mockSessionListEnabled"
        :mock-collapsed="mockCollapsed"
        :mock-chats="mockChats"
        :active-chats="activeChats"
        :pending-chats="pendingChats"
        :pinned-ids="pinnedIds"
        :search-query="searchQuery"
        :show-app-list="showAppList"
        :show-search-bar="showSearchBar"
        :app-drawer-height-rem="appDrawerHeightRem"
        :drawer-common-apps="drawerCommonApps"
        :drawer-favorite-apps="drawerFavoriteApps"
        :total-pending-count="totalPendingCount"
        :get-chat-date-label="getChatDateLabel"
        :get-non-read-count="getNonReadCount"
        :is-mock="isMockSession"
        :drawer-app-active="drawerAppActive"
        @update:pinned-collapsed="pinnedCollapsed = $event"
        @update:mock-collapsed="mockCollapsed = $event"
        @update:search-query="setSearchQuery"
        @update:list-view-tab="setListViewTab"
        @session-click="onSessionItemClick"
        @toggle-pin="togglePin"
        @rename="onSessionRename"
        @delete="onSessionDelete"
        @new-chat="startNewChat"
        @search="toggleSearchBar"
        @app="toggleAppList"
        @more="onDrawerMore"
        @drawer-select="onDrawerAppClick"
      />
      <main
        class="flex-1 min-h-0 flex flex-col overflow-hidden relative"
        :class="{ 'min-w-0': !(chatId && showChatPlaceholderOnFirstLoad) }"
        v-show="isSessionExpanded || !!chatId"
        :style="[
          { '--chat-text-scale': sessionAreaFontScale },
          chatId && showChatPlaceholderOnFirstLoad ? { minWidth: '20rem' } : {}
        ]"
      >
        <template v-if="chatId && !showChatPlaceholderOnFirstLoad">
          <SpaceChatPane
            :scroll-ref="scrollRef"
            :chat-title="chatTitle"
            :chat-user-name="chatUserName"
            :chat-user-avatar="chatUserAvatar"
            :is-session-expanded="isSessionExpanded"
            :session-area-font-scale="sessionAreaFontScale"
            v-model:input="input"
            :streaming="streaming"
            @close="onCloseChat"
            @rename="onRenameChat"
            @share="onShareConversation"
            @copy-link="onCopySessionLink"
            @export-screen="onExportCurrentScreen"
            @export-screenshot="onExportLongScreenshot"
            @export-markdown="onExportMarkdown"
            @archive="onArchiveChat"
            @delete="onDeleteChat"
            @submit="send"
            @stop="stopStream"
            @clear="input = ''"
            @scroll-to-last="scrollToLastMessage"
            @add-participant="openAddParticipant"
          >
            <template v-if="virtualRows.length > 0">
              <div
                :style="{
                  height: `${virtualTotalSize}px`,
                  width: '100%',
                  position: 'relative',
                }"
              >
                <div
                  v-for="virtualRow in virtualRows"
                  :key="virtualRow.key"
                  :data-index="virtualRow.index"
                  class="flex w-full pb-3"
                  :class="
                    (displayMessages[virtualRow.index]?.role === 'user'
                      ? 'justify-end'
                      : 'justify-start')
                  "
                  :style="{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }"
                  :ref="
                    (el) => {
                      if (el) rowVirtualizerRef.measureElement(el)
                    }
                  "
                >
                  <ChatMessageBubble
                    v-if="displayMessages[virtualRow.index]"
                    :message="displayMessages[virtualRow.index]"
                    :message-index="virtualRow.index"
                    :show-timestamp="getMessageTimestampDisplay(displayMessages, virtualRow.index).show"
                    :timestamp-text="getMessageTimestampDisplay(displayMessages, virtualRow.index).text"
                    :streaming="
                      messages.length > 0 &&
                      displayMessages[virtualRow.index]?.role === 'assistant' &&
                      virtualRow.index === displayMessages.length - 1 &&
                      streaming
                    "
                    :can-edit-other-message="displayMessages[virtualRow.index] && canEditMessage(displayMessages[virtualRow.index])"
                    @retry="retryMessage(virtualRow.index)"
                    @edit="onEditMessage(virtualRow.index)"
                    @view-edit-history="onViewEditHistory(virtualRow.index)"
                    @edit-user-message="onEditUserMessage(virtualRow.index)"
                    @retry-user-message="onRetryUserMessage(virtualRow.index)"
                    @recall-message="onRecallMessage(virtualRow.index)"
                    @delete-message="onDeleteMessage(virtualRow.index)"
                    @copy-message="onCopyMessage(virtualRow.index)"
                    @favorite="onFavoriteMessage(virtualRow.index)"
                    @export-markdown="onExportMarkdown()"
                    @listen-reply="onListenReply(virtualRow.index)"
                  />
                </div>
              </div>
            </template>
            <div v-else class="space-y-3">
              <div
                v-for="(msg, i) in displayMessages"
                :key="'msg-' + i"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <ChatMessageBubble
                  :message="msg"
                  :message-index="i"
                  :show-timestamp="getMessageTimestampDisplay(displayMessages, i).show"
                  :timestamp-text="getMessageTimestampDisplay(displayMessages, i).text"
                  :streaming="
                    messages.length > 0 &&
                    msg.role === 'assistant' &&
                    i === displayMessages.length - 1 &&
                    streaming
                  "
                  :can-edit-other-message="canEditMessage(msg)"
                  @retry="retryMessage(i)"
                  @edit="onEditMessage(i)"
                  @view-edit-history="onViewEditHistory(i)"
                  @edit-user-message="onEditUserMessage(i)"
                  @retry-user-message="onRetryUserMessage(i)"
                  @recall-message="onRecallMessage(i)"
                  @delete-message="onDeleteMessage(i)"
                  @copy-message="onCopyMessage(i)"
                  @favorite="onFavoriteMessage(i)"
                  @export-markdown="onExportMarkdown()"
                  @listen-reply="onListenReply(i)"
                />
              </div>
            </div>
          </SpaceChatPane>
        </template>
        <ChatEmptyState
          v-if="!chatId || showChatPlaceholderOnFirstLoad"
          :creating-session="creatingSession"
          :create-session-error="createSessionError"
          @new-chat="startNewChat"
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getMessageTimestampDisplay } from '~/composables/useMessageTimestamp'

definePageMeta({ layout: 'workspace' })

const {
  chatId,
  showChatPlaceholderOnFirstLoad,
  sessionAreaFontScale,
  isSessionExpanded,
  appContentVisible,
  showAppPanel,
  openAddParticipant,
  openPanel,
  listViewTab,
  listPaddingTop,
  toolbarTop,
  pinnedCollapsed,
  pinnedChats,
  mockSessionListEnabled,
  mockCollapsed,
  mockChats,
  activeChats,
  pendingChats,
  pinnedIds,
  searchQuery,
  showAppList,
  showSearchBar,
  appDrawerHeightRem,
  drawerCommonApps,
  drawerFavoriteApps,
  totalPendingCount,
  getChatDateLabel,
  getNonReadCount,
  isMockSession,
  setSearchQuery,
  setListViewTab,
  onSessionItemClick,
  togglePin,
  onSessionRename,
  onSessionDelete,
  startNewChat,
  toggleSearchBar,
  toggleAppList,
  onDrawerMore,
  onDrawerAppClick,
  drawerAppActive,
  creatingSession,
  createSessionError,
  displayChats,
  scrollRef,
  input,
  streaming,
  messages,
  displayMessages,
  rowVirtualizerRef,
  virtualRows,
  virtualTotalSize,
  chatTitle,
  chatUserName,
  chatUserAvatar,
  send,
  stopStream,
  scrollToLastMessage,
  onCloseChat,
  onRenameChat,
  onShareConversation,
  onCopySessionLink,
  onExportCurrentScreen,
  onExportLongScreenshot,
  onExportMarkdown,
  onArchiveChat,
  onDeleteChat,
  canEditMessage,
  onEditMessage,
  onViewEditHistory,
  onEditUserMessage,
  onRetryUserMessage,
  onRecallMessage,
  onDeleteMessage,
  onCopyMessage,
  onFavoriteMessage,
  onListenReply,
  retryMessage,
} = useSpacePage()
</script>

<style scoped>
@media (max-width: 320px) {
  .session-area-container {
    border-radius: 0;
    border: none !important;
  }
}

.search-slide-enter-active,
.search-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
