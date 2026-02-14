<template>
  <!--
    会话区布局（由 workspace layout 的 grid 左列承载）：
    - 外层：session-area-container，flex-col，占满 layout 给的宽度。
    - 内层：flex-row（sm+ 双栏）或 flex-col（< sm 单栏）。
    - 左：SessionSidebar，sm+ 时 w-72(288px)，否则 flex-1；v-show 控制显隐。
    - 右：main 聊天区，flex-1 min-w-0，与列表左右并排时占剩余宽度。
    - 注意：layout 在 xl+ 且应用区展开时会话列给 1fr，否则 md～lg 应用区展开时给 288px（仅列表可见）。
  -->
  <div class="session-area-container h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
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
        :is-session-left-room="isSessionLeftRoom"
        :drawer-app-active="drawerAppActive"
        :invited-sessions="invitedSessions"
        :on-accept-invite="onAcceptInvite"
        :on-decline-invite="onDeclineInvite"
        @update:pinned-collapsed="pinnedCollapsed = $event"
        @update:mock-collapsed="mockCollapsed = $event"
        @update:search-query="setSearchQuery"
        @update:list-view-tab="setListViewTab"
        @session-click="onSessionItemClick"
        @toggle-pin="togglePin"
        @rename="onSessionRename"
        @delete="onSessionDelete"
        @new-chat="openCreateSessionDialog"
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
            :display-items="displayItems"
            :ui-messages="uiMessages"
            :chat-status="chatStatus"
            :chat-title="chatTitle"
            :chat-user-name="chatUserName"
            :chat-user-avatar="chatUserAvatar"
            :is-session-expanded="isSessionExpanded"
            :session-area-font-scale="sessionAreaFontScale"
            :scroll-target-ref="chatScrollElRef"
            :session-members="sessionMembers"
            :session-id="chatId"
            :is-left-room="chatId ? isSessionLeftRoom(chatId) : false"
            :fetch-session-members="fetchSessionMembers"
            :kick-from-session="kickFromSession"
            :ban-from-session="banFromSession"
            :invite-to-session="inviteToSession"
            :leave-session="onLeaveSession"
            :current-user-mxid="matrixUserId"
            v-model:input="input"
            :streaming="streaming"
            :reply-target="replyTarget"
            :editing-message-id="editingMessageId"
            @close="onCloseChat"
            @rename="onRenameChat"
            @share="onShareConversation"
            @copy-link="onCopySessionLink"
            @export-screen="onExportCurrentScreen"
            @export-screenshot="onExportLongScreenshot"
            @export-markdown="onExportMarkdown"
            @archive="onArchiveChat"
            @delete="() => chatId && openDeleteConfirm(chatId)"
            @members-closed="refetchSessionMembers"
            @submit="send"
            @stop="stopStream"
            @clear="input = ''"
            @scroll-to-last="scrollToLastMessage"
            @add-participant="openAddParticipant"
            @cancel-reply="onCancelReply"
            @cancel-edit="onCancelEdit"
          >
            <template #content="{ message }">
              <div
                class="flex w-full"
                :class="[
                  displayMessages[getMessageIndexByUiId(message.id)]?.role === 'user' ? 'justify-end' : 'justify-start pl-2',
                  displayMessages[getMessageIndexByUiId(message.id)]?.role === 'system' ? 'pb-0.5' : 'pb-1.5'
                ]"
              >
                <ChatMessageBubble
                  v-if="displayMessages[getMessageIndexByUiId(message.id)]"
                  :message="displayMessages[getMessageIndexByUiId(message.id)]"
                  :message-index="getMessageIndexByUiId(message.id)"
                  :show-timestamp="getMessageTimestampDisplay(displayMessages, getMessageIndexByUiId(message.id)).show"
                  :timestamp-text="getMessageTimestampDisplay(displayMessages, getMessageIndexByUiId(message.id)).text"
                  :streaming="
                    messages.length > 0 &&
                    displayMessages[getMessageIndexByUiId(message.id)]?.role === 'assistant' &&
                    getMessageIndexByUiId(message.id) === displayMessages.length - 1 &&
                    streaming
                  "
                  :can-edit-other-message="displayMessages[getMessageIndexByUiId(message.id)] && canEditMessage(displayMessages[getMessageIndexByUiId(message.id)])"
                  @retry="retryMessage(getMessageIndexByUiId(message.id))"
                  @edit="onEditMessage(getMessageIndexByUiId(message.id))"
                  @view-edit-history="onViewEditHistory(getMessageIndexByUiId(message.id))"
                  @edit-user-message="onEditUserMessage(getMessageIndexByUiId(message.id))"
                  @retry-user-message="onRetryUserMessage(getMessageIndexByUiId(message.id))"
                  @recall-message="onRecallMessage(getMessageIndexByUiId(message.id))"
                  @delete-message="onDeleteMessage(getMessageIndexByUiId(message.id))"
                  @copy-message="onCopyMessage(getMessageIndexByUiId(message.id))"
                  @favorite="onFavoriteMessage(getMessageIndexByUiId(message.id))"
                  @export-markdown="onExportMarkdown()"
                  @listen-reply="onListenReply(getMessageIndexByUiId(message.id))"
                  @reply="onReplyToMessage"
                />
              </div>
            </template>
          </SpaceChatPane>
        </template>
        <ChatEmptyState
          v-if="!chatId || showChatPlaceholderOnFirstLoad"
          :creating-session="creatingSession"
          :create-session-error="createSessionError"
          @new-chat="openCreateSessionDialog"
        />
      </main>
    </div>
    <SpaceCreateSessionDialog
      :open="showCreateSessionDialog"
      :contacts="contacts"
      :creating-session="creatingSession"
      :create-session-error="createSessionError"
      @close="showCreateSessionDialog = false"
      @select-solo="onCreateSessionSelectSolo"
      @select-contact="startNewChatWithContact"
    />
    <SpaceRenameSessionDialog
      :open="renameDialogOpen"
      :current-title="renameCurrentTitle"
      @close="closeRenameDialog"
      @confirm="confirmRename"
    />
    <SpaceDeleteSessionConfirmDialog
      :open="deleteConfirmOpen"
      :is-owner="deleteConfirmIsOwner"
      @close="closeDeleteConfirm"
      @confirm="confirmDeleteSession"
    />
  </div>
</template>

<script setup lang="ts">
import { getMessageTimestampDisplay, getDateSeparatorBefore } from '~/composables/useMessageTimestamp'

definePageMeta({ layout: 'workspace' })

const {
  chatId,
  showChatPlaceholderOnFirstLoad,
  sessionAreaFontScale,
  isSessionExpanded,
  appContentVisible,
  showAppPanel,
  chatScrollElRef,
  openAddParticipant,
  openPanel,
  listViewTab,
  listPaddingTop,
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
  isSessionLeftRoom,
  setSearchQuery,
  setListViewTab,
  onSessionItemClick,
  togglePin,
  onSessionRename,
  onSessionDelete,
  deleteConfirmOpen,
  deleteConfirmIsOwner,
  closeDeleteConfirm,
  openDeleteConfirm,
  confirmDeleteSession,
  renameDialogOpen,
  renameCurrentTitle,
  closeRenameDialog,
  confirmRename,
  startNewChat,
  toggleSearchBar,
  toggleAppList,
  onDrawerMore,
  onDrawerAppClick,
  drawerAppActive,
  invitedSessions,
  onAcceptInvite,
  onDeclineInvite,
  showCreateSessionDialog,
  openCreateSessionDialog,
  onCreateSessionSelectSolo,
  startNewChatWithContact,
  contacts,
  creatingSession,
  createSessionError,
  fetchSessionMembers,
  kickFromSession,
  banFromSession,
  inviteToSession,
  displayChats,
  input,
  streaming,
  messages,
  displayMessages,
  uiMessages,
  chatStatus,
  getMessageIndexByUiId,
  chatTitle,
  chatUserName,
  chatUserAvatar,
  replyTarget,
  editingMessageId,
  onReplyToMessage,
  onCancelReply,
  onCancelEdit,
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
  onLeaveSession,
  sessionMembers,
  refetchSessionMembers,
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

const { matrixUserId } = useAuth()

/** 日期分隔线与消息交错列表，用于在消息容器外渲染分隔线（与消息同级） */
const displayItems = computed(() => {
  const items: Array<
    { type: 'date'; label: string } | { type: 'message'; uiMessage: import('~/composables/useSpaceChatPane').UiMessage }
  > = []
  const msgs = displayMessages.value
  const ui = uiMessages.value
  for (let i = 0; i < msgs.length; i++) {
    const label = getDateSeparatorBefore(msgs, i)
    if (label) items.push({ type: 'date', label })
    if (ui[i]) items.push({ type: 'message', uiMessage: ui[i] })
  }
  return items
})
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
