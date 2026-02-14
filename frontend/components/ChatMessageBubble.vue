<template>
  <!-- 用户：发送状态在气泡左侧外侧，已读时顶部外侧对方头像；气泡与时间戳同一右对齐列 -->
  <div v-if="message.role === 'user'" class="w-full flex flex-col items-end gap-1">
    <!-- 已读：气泡顶部外侧，头像行占满宽度并右对齐，与气泡右侧对齐 -->
    <div
      v-if="userReceiptStatus === 'read' && readBySources.length > 0"
      class="flex w-full shrink-0 justify-end items-center"
      :title="userReceiptStatusLabel"
    >
      <span
        v-for="(src, idx) in readBySources"
        :key="idx"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
        :class="idx > 0 ? '-ml-2' : ''"
        :title="sourceLabel(src)"
      >
        <User v-if="src.type === 'other_user'" class="h-2.5 w-2.5" />
        <Bot v-else-if="src.type === 'bot'" class="h-2.5 w-2.5" />
        <Cog v-else class="h-2.5 w-2.5" />
      </span>
    </div>
    <!-- 气泡 + 时间戳同一右对齐列，保证右侧对齐一致 -->
    <div class="flex flex-col items-end max-w-[85%]">
      <div class="flex items-end gap-1.5 w-full justify-end">
        <!-- 发送状态：气泡左侧外侧；失败时显示重试按钮 -->
        <span
          v-if="userReceiptStatus && userReceiptStatus !== 'read'"
          class="flex shrink-0 items-center gap-1.5 self-center"
          :title="userReceiptStatusLabel"
          aria-hidden
        >
          <Loader2 v-if="userReceiptStatus === 'sending'" class="h-3.5 w-3.5 text-zinc-400 animate-spin" />
          <template v-else-if="userReceiptStatus === 'failed'">
            <XCircle class="h-3.5 w-3.5 text-red-500 shrink-0" />
            <button
              type="button"
              class="text-[11px] text-red-600 dark:text-red-400 hover:underline shrink-0"
              @click="emit('retryUserMessage')"
            >
              重试
            </button>
          </template>
          <Check v-else-if="userReceiptStatus === 'sent'" class="h-3.5 w-3.5 text-zinc-500" />
          <CheckCheck v-else-if="userReceiptStatus === 'delivered'" class="h-3.5 w-3.5 text-zinc-500" />
        </span>
        <ContextMenuRoot v-if="messageIndex !== undefined">
          <ContextMenuTrigger as-child>
            <div
              class="chat-bubble-user flex flex-col items-end gap-1.5 rounded-xl rounded-tr-none px-4 py-2.5 text-xs bg-primary text-primary-foreground w-fit max-w-full"
            >
              <div
                v-if="message.inReplyTo"
                class="w-full text-left border-l-2 border-primary-foreground/50 pl-2 py-0.5 -ml-1"
              >
                <span class="text-[10px] text-primary-foreground/80">
                  {{ message.inReplyTo.role === 'user' ? '回复我' : '回复对方' }}
                </span>
                <p class="text-[11px] text-primary-foreground/90 line-clamp-2 break-words">
                  {{ message.inReplyTo.content || '…' }}
                </p>
              </div>
              <div
                v-if="userBodyHtml"
                class="chat-message-text chat-message-markdown chat-message-markdown--on-primary break-words flex-1 min-w-0 w-full"
                role="region"
                aria-label="消息正文"
              >
                <div v-html="userBodyHtml" />
              </div>
              <p v-else class="chat-message-text whitespace-pre-wrap break-words flex-1 min-w-0 w-full">{{ message.content }}</p>
            </div>
          </ContextMenuTrigger>
          <ContextMenuPortal>
            <ContextMenuContent
              class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
              :side-offset="4"
            >
              <ContextMenuItem
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                text-value="回复"
                @select="emit('reply', message)"
              >
                <Reply class="h-3.5 w-3.5 shrink-0 opacity-70" />
                回复
              </ContextMenuItem>
              <ContextMenuItem
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                text-value="编辑"
                @select="emit('editUserMessage')"
              >
                <Pencil class="h-3.5 w-3.5 shrink-0 opacity-70" />
                编辑
              </ContextMenuItem>
              <ContextMenuItem
                v-if="message.receiptStatus === 'failed'"
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                text-value="重试"
                @select="emit('retryUserMessage')"
              >
                <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
                重试
              </ContextMenuItem>
              <ContextMenuItem
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                text-value="撤回"
                @select="emit('recallMessage')"
              >
                <Undo2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
                撤回
              </ContextMenuItem>
              <ContextMenuItem
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                text-value="删除"
                @select="emit('deleteMessage')"
              >
                <Trash2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
                删除
              </ContextMenuItem>
              <ContextMenuItem
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 outline-none"
                text-value="更多"
                disabled
                title="更多功能敬请期待"
              >
                <MoreHorizontal class="h-3.5 w-3.5 shrink-0 opacity-70" />
                更多
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenuPortal>
        </ContextMenuRoot>
        <template v-else>
          <div
            class="chat-bubble-user flex flex-col items-end gap-1.5 rounded-xl rounded-tr-none px-4 py-2.5 text-xs bg-primary text-primary-foreground w-fit max-w-full"
          >
            <div
              v-if="message.inReplyTo"
              class="w-full text-left border-l-2 border-primary-foreground/50 pl-2 py-0.5 -ml-1"
            >
              <span class="text-[10px] text-primary-foreground/80">
                {{ message.inReplyTo.role === 'user' ? '回复我' : '回复对方' }}
              </span>
              <p class="text-[11px] text-primary-foreground/90 line-clamp-2 break-words">
                {{ message.inReplyTo.content || '…' }}
              </p>
            </div>
            <div
              v-if="userBodyHtml"
              class="chat-message-text chat-message-markdown chat-message-markdown--on-primary break-words flex-1 min-w-0 w-full"
              role="region"
              aria-label="消息正文"
            >
              <div v-html="userBodyHtml" />
            </div>
            <p v-else class="chat-message-text whitespace-pre-wrap break-words flex-1 min-w-0 w-full">{{ message.content }}</p>
          </div>
        </template>
      </div>
      <span v-if="showTimestamp && timestampText" class="w-full text-right text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
        {{ timestampText }}
      </span>
    </div>
  </div>
  <!-- 系统消息：全宽、文字居中、浅底胶囊样式，与对话气泡区分；支持时间戳 -->
  <div
    v-else-if="message.role === 'system'"
    class="w-full py-1 flex flex-col items-center gap-0.5"
  >
    <span
      class="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100/90 dark:bg-zinc-700/60 border border-zinc-200/60 dark:border-zinc-600/50"
    >
      {{ message.content }}
    </span>
    <span v-if="showTimestamp && timestampText" class="text-[11px] text-zinc-400 dark:text-zinc-500">
      {{ timestampText }}
    </span>
  </div>
  <!-- 左侧消息：标准宽度容器；仅气泡内容区可右键菜单 -->
  <div v-else class="min-w-[20rem] max-w-[85%] text-xs text-zinc-800 dark:text-zinc-200">
    <ContextMenuRoot v-if="messageIndex !== undefined">
      <ContextMenuTrigger as-child>
        <div class="w-full">
          <div
            v-if="message.inReplyTo"
            class="mb-2 border-l-2 border-zinc-300 dark:border-zinc-500 pl-2 py-1"
          >
            <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
              {{ message.inReplyTo.role === 'user' ? '回复用户' : '回复助手' }}
            </span>
            <p class="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 break-words">
              {{ message.inReplyTo.content || '…' }}
            </p>
          </div>
          <div
            v-if="message.thinking != null && message.thinking.trim()"
            class="mb-3"
          >
            <button
              type="button"
              class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              @click="thinkingOpen = !thinkingOpen"
            >
              <span class="transition-transform" :class="thinkingOpen ? 'rotate-90' : ''">▶</span>
              <span>思考过程</span>
            </button>
            <div
              v-show="thinkingOpen"
              class="chat-message-text mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-600"
            >
              {{ message.thinking }}
            </div>
          </div>
          <div
            v-if="isThinkingPlaceholder"
            class="chat-message-text thinking-placeholder inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-600/80 bg-zinc-50/90 dark:bg-zinc-800/90 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400"
          >
            <Sparkles class="h-3.5 w-3.5 shrink-0 text-amber-500/80 dark:text-amber-400/80 thinking-icon" />
            <span>思考中</span>
            <span class="thinking-dots">
              <span class="thinking-dot" />
              <span class="thinking-dot thinking-dot-2" />
              <span class="thinking-dot thinking-dot-3" />
            </span>
          </div>
          <div
            v-else-if="useMarkdown && assistantBodyHtml"
            class="chat-message-text chat-message-markdown break-words"
            role="region"
            aria-label="消息正文"
          >
            <div v-html="assistantBodyHtml" />
          </div>
          <p v-else class="chat-message-text whitespace-pre-wrap break-words">
            <template v-if="message.contentChunks?.length">
              <span
                v-for="(chunk, i) in message.contentChunks"
                :key="i"
                class="stream-token"
              >{{ chunk }}</span>
            </template>
            <template v-else>{{ message.content }}</template>
            <span v-if="streaming" class="streaming-cursor bg-primary-500 dark:bg-primary-400 ml-0.5 align-middle" aria-hidden />
          </p>
          <div v-if="likeReactions.length > 0 || message.editedAt" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span v-if="likeReactions.length > 0" class="inline-flex items-center gap-1">
              <ThumbsUp class="h-3 w-3 shrink-0" stroke-width="2" />
              <span>{{ likeReactionsLabel }}</span>
            </span>
            <span v-if="message.editedAt" class="inline-flex items-center gap-1" :title="editedByLabel">
              已编辑<template v-if="message.editedBy">（{{ message.editedBy.label || (message.editedBy.type === 'bot' ? '机器人' : '用户') }}）</template>
            </span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent
          class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
          :side-offset="4"
        >
          <ContextMenuItem
            v-if="hasBotSource"
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="重试"
            @select="emit('retry')"
          >
            <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
            重试
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="回复"
            @select="emit('reply', message)"
          >
            <Reply class="h-3.5 w-3.5 shrink-0 opacity-70" />
            回复
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="复制"
            @select="emit('copyMessage')"
          >
            <Copy class="h-3.5 w-3.5 shrink-0 opacity-70" />
            复制
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="收藏"
            @select="emit('favorite')"
          >
            <Bookmark class="h-3.5 w-3.5 shrink-0 opacity-70" />
            收藏
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="导出 Markdown"
            @select="emit('exportMarkdown')"
          >
            <FileDown class="h-3.5 w-3.5 shrink-0 opacity-70" />
            导出 Markdown
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="查看编辑历史"
            @select="emit('viewEditHistory')"
          >
            <History class="h-3.5 w-3.5 shrink-0 opacity-70" />
            查看编辑历史
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
            text-value="听回复"
            @select="emit('listenReply')"
          >
            <Volume2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
            听回复
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
    <template v-else>
      <div
        v-if="message.inReplyTo"
        class="mb-2 border-l-2 border-zinc-300 dark:border-zinc-500 pl-2 py-1"
      >
        <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
          {{ message.inReplyTo.role === 'user' ? '回复用户' : '回复助手' }}
        </span>
        <p class="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 break-words">
          {{ message.inReplyTo.content || '…' }}
        </p>
      </div>
      <div
        v-if="message.thinking != null && message.thinking.trim()"
        class="mb-3"
      >
        <button
          type="button"
          class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          @click="thinkingOpen = !thinkingOpen"
        >
          <span class="transition-transform" :class="thinkingOpen ? 'rotate-90' : ''">▶</span>
          <span>思考过程</span>
        </button>
        <div
          v-show="thinkingOpen"
          class="chat-message-text mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-600"
        >
          {{ message.thinking }}
        </div>
      </div>
      <div
        v-if="isThinkingPlaceholder"
        class="chat-message-text thinking-placeholder inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-600/80 bg-zinc-50/90 dark:bg-zinc-800/90 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400"
      >
        <Sparkles class="h-3.5 w-3.5 shrink-0 text-amber-500/80 dark:text-amber-400/80 thinking-icon" />
        <span>思考中</span>
        <span class="thinking-dots">
          <span class="thinking-dot" />
          <span class="thinking-dot thinking-dot-2" />
          <span class="thinking-dot thinking-dot-3" />
        </span>
      </div>
      <div
        v-else-if="useMarkdown && assistantBodyHtml"
        class="chat-message-text chat-message-markdown break-words"
        role="region"
        aria-label="消息正文"
      >
        <div v-html="assistantBodyHtml" />
      </div>
      <p v-else class="chat-message-text whitespace-pre-wrap break-words">
        <template v-if="message.contentChunks?.length">
          <span
            v-for="(chunk, i) in message.contentChunks"
            :key="i"
            class="stream-token"
          >{{ chunk }}</span>
        </template>
        <template v-else>{{ message.content }}</template>
        <span v-if="streaming" class="streaming-cursor bg-primary-500 dark:bg-primary-400 ml-0.5 align-middle" aria-hidden />
      </p>
      <div v-if="likeReactions.length > 0 || message.editedAt" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span v-if="likeReactions.length > 0" class="inline-flex items-center gap-1">
          <ThumbsUp class="h-3 w-3 shrink-0" stroke-width="2" />
          <span>{{ likeReactionsLabel }}</span>
        </span>
        <span v-if="message.editedAt" class="inline-flex items-center gap-1" :title="editedByLabel">
          已编辑<template v-if="message.editedBy">（{{ message.editedBy.label || (message.editedBy.type === 'bot' ? '机器人' : '用户') }}）</template>
        </span>
      </div>
    </template>
    <!-- 消息工具栏：左侧按钮 + 右侧堆叠来源头像 -->
    <div class="mt-1.5 flex items-center gap-0.5 text-zinc-400 dark:text-zinc-500">
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        :class="userHasLiked ? '!text-zinc-700 dark:!text-zinc-200' : ''"
        aria-label="赞同"
        @click="onLike"
      >
        <ThumbsUp class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="反对"
        @click="onDislike"
      >
        <ThumbsDown class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="复制"
        @click="onCopy"
      >
        <Copy class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <button
        v-if="canEditOtherMessage"
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        aria-label="编辑"
        title="编辑"
        @click="emit('edit')"
      >
        <Pencil class="h-3.5 w-3.5" stroke-width="2" />
      </button>
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors outline-none"
          aria-label="更多"
        >
          <MoreVertical class="h-3.5 w-3.5" stroke-width="2" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal to="body">
          <DropdownMenuContent
            class="z-[100] min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
            :side-offset="4"
            align="start"
          >
            <DropdownMenuItem
              v-if="hasBotSource"
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="重试"
              @select="emit('retry')"
            >
              <RefreshCw class="h-3.5 w-3.5 shrink-0 opacity-70" />
              重试
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="收藏"
              @select="emit('favorite')"
            >
              <Bookmark class="h-3.5 w-3.5 shrink-0 opacity-70" />
              收藏
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="导出 Markdown"
              @select="emit('exportMarkdown')"
            >
              <FileDown class="h-3.5 w-3.5 shrink-0 opacity-70" />
              导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="查看编辑历史"
              @select="emit('viewEditHistory')"
            >
              <History class="h-3.5 w-3.5 shrink-0 opacity-70" />
              查看编辑历史
            </DropdownMenuItem>
            <DropdownMenuItem
              class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
              text-value="听回复"
              @select="emit('listenReply')"
            >
              <Volume2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
              听回复
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <div class="flex shrink-0">
        <span
          v-for="(src, idx) in displaySources"
          :key="idx"
          class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
          :class="idx > 0 ? '-ml-2' : ''"
          :title="sourceLabel(src)"
        >
          <User v-if="src.type === 'other_user'" class="h-3 w-3" />
          <Bot v-else-if="src.type === 'bot'" class="h-3 w-3" />
          <Cog v-else class="h-3 w-3" />
        </span>
      </div>
    </div>
    <span v-if="showTimestamp && timestampText" class="block mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
      {{ timestampText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { MessageReaction, MessageSource } from '~/composables/useChatSessions'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'radix-vue'
import { Bookmark, Bot, Check, CheckCheck, Cog, Copy, FileDown, History, Loader2, MoreHorizontal, MoreVertical, Pencil, RefreshCw, Reply, Sparkles, ThumbsDown, ThumbsUp, Trash2, Undo2, User, Volume2, XCircle } from 'lucide-vue-next'

const THINKING_PLACEHOLDER = '思考中…'

const props = defineProps<{
  message: {
    role: string
    content: string
    formattedBody?: string
    thinking?: string
    sources?: MessageSource[]
    contentChunks?: string[]
    reactions?: MessageReaction[]
    editedAt?: number
    editedBy?: MessageSource
    receiptStatus?: import('~/composables/useChatSessions').MessageReceiptStatus
    readBy?: MessageSource[]
    createdAt?: number
    inReplyTo?: { id: string; role?: 'user' | 'assistant'; content?: string }
  }
  streaming?: boolean
  showTimestamp?: boolean
  timestampText?: string
  /** 当前用户标识，用于高亮“我”的点赞（可选） */
  currentUserLabel?: string
  /** 是否拥有编辑对方消息权限；为 true 时底部工具条显示编辑按钮 */
  canEditOtherMessage?: boolean
  /** 消息在列表中的下标，传入时气泡区域才启用右键菜单 */
  messageIndex?: number
}>()
const emit = defineEmits<{
  reply: [message: import('~/composables/useChatSessions').ChatMessage]
  retry: []; favorite: []; exportMarkdown: []; listenReply: []; viewEditHistory: []; edit: [];
  editUserMessage: []; retryUserMessage: []; recallMessage: []; deleteMessage: []; copyMessage: [];
  reaction: [type: 'like' | 'dislike']
}>()

const thinkingOpen = ref(true)

const displaySources = computed(() => {
  const s = props.message.sources
  if (s && s.length > 0) return s
  return [{ type: 'bot' as const }]
})

const hasBotSource = computed(() => displaySources.value.some((s) => s.type === 'bot'))
const isThinkingPlaceholder = computed(
  () => props.message.role === 'assistant' && props.message.content === THINKING_PLACEHOLDER
)

/** 助手消息且非流式时渲染（formattedBody 优先净化 HTML，否则 content 作 Markdown） */
const useMarkdown = computed(
  () =>
    props.message.role === 'assistant' &&
    !props.streaming &&
    !isThinkingPlaceholder.value &&
    ((props.message.content?.trim() ?? '') !== '' || (props.message.formattedBody?.trim() ?? '') !== ''),
)
const { render: renderMarkdown, renderFormattedBody } = useMarkdownRender()
const assistantBodyHtml = computed(() => {
  if (!useMarkdown.value) return ''
  if (props.message.formattedBody?.trim()) return renderFormattedBody(props.message.formattedBody)
  if (props.message.content) return renderMarkdown(props.message.content)
  return ''
})
/** 用户消息：有 formattedBody 时渲染净化 HTML，否则纯文本 */
const userBodyHtml = computed(() => {
  if (props.message.role !== 'user') return ''
  if (props.message.formattedBody?.trim()) return renderFormattedBody(props.message.formattedBody)
  return ''
})

const likeReactions = computed(() => (props.message.reactions ?? []).filter((r) => r.type === 'like'))
const likeReactionsLabel = computed(() => {
  const labels = likeReactions.value.map((r) => r.by.label || (r.by.type === 'bot' ? '机器人' : '用户'))
  if (labels.length === 0) return ''
  if (labels.length <= 2) return `${labels.join('、')} 觉得很赞`
  return `${labels.slice(0, 2).join('、')} 等 ${labels.length} 人觉得很赞`
})
const editedByLabel = computed(() => {
  const e = props.message.editedBy
  if (!e) return ''
  return e.label || (e.type === 'bot' ? '机器人' : '用户')
})
const userHasLiked = computed(() =>
  props.currentUserLabel
    ? likeReactions.value.some((r) => r.by.label === props.currentUserLabel)
    : false,
)

const userReceiptStatus = computed(() => {
  if (props.message.role !== 'user') return null
  const s = props.message.receiptStatus
  return s ?? 'sent'
})
/** 已读时展示的对方头像来源；无 readBy 时默认展示一个 bot 占位 */
const readBySources = computed(() => {
  const r = props.message.readBy
  if (r && r.length > 0) return r
  return [{ type: 'bot' as const }]
})
const userReceiptStatusLabel = computed(() => {
  const s = userReceiptStatus.value
  if (!s) return ''
  const map: Record<string, string> = {
    sending: '发送中',
    sent: '已发送',
    delivered: '已送达',
    read: '已读',
    failed: '发送失败',
  }
  return map[s] ?? ''
})

function sourceLabel(src: MessageSource) {
  if (src.label) return src.label
  return src.type === 'bot' ? '机器人' : src.type === 'other_user' ? '其它用户' : '系统'
}

function onLike() {
  emit('reaction', 'like')
}
function onDislike() {
  emit('reaction', 'dislike')
}
function onCopy() {
  if (props.message.content) {
    navigator.clipboard.writeText(props.message.content)
  }
}
</script>

<style scoped>
/* 仅聊天对话文字随「界面字体大小」设置缩放（:deep 确保在 as-child 等插槽内也生效） */
:deep(.chat-message-text) {
  font-size: calc(1rem * var(--chat-text-scale, 1)) !important;
}

/* Markdown 渲染块：与气泡主题一致的段落、列表、代码块等 */
:deep(.chat-message-markdown) {
  line-height: 1.5;
}
:deep(.chat-message-markdown p) {
  margin: 0 0 0.5em;
}
:deep(.chat-message-markdown p:last-child) {
  margin-bottom: 0;
}
:deep(.chat-message-markdown h1),
:deep(.chat-message-markdown h2),
:deep(.chat-message-markdown h3),
:deep(.chat-message-markdown h4),
:deep(.chat-message-markdown h5),
:deep(.chat-message-markdown h6) {
  margin: 0.75em 0 0.35em;
  font-weight: 600;
  line-height: 1.3;
}
:deep(.chat-message-markdown h1) { font-size: 1.15em; }
:deep(.chat-message-markdown h2) { font-size: 1.08em; }
:deep(.chat-message-markdown h3) { font-size: 1.02em; }
:deep(.chat-message-markdown ul),
:deep(.chat-message-markdown ol) {
  margin: 0.35em 0;
  padding-left: 1.4em;
}
:deep(.chat-message-markdown li) {
  margin: 0.15em 0;
}
:deep(.chat-message-markdown blockquote) {
  margin: 0.5em 0;
  padding-left: 0.85em;
  border-left: 3px solid var(--tw-border-color, rgb(228 228 231));
  color: rgb(113 113 122);
}
.dark :deep(.chat-message-markdown blockquote) {
  border-left-color: rgb(82 82 91);
  color: rgb(161 161 170);
}
:deep(.chat-message-markdown pre) {
  margin: 0.5em 0;
  padding: 0.6em 0.75em;
  border-radius: 0.5rem;
  background: rgb(244 244 245);
  border: 1px solid rgb(228 228 231);
  overflow-x: auto;
  font-size: 0.9em;
  line-height: 1.4;
}
.dark :deep(.chat-message-markdown pre) {
  background: rgb(39 39 42);
  border-color: rgb(63 63 70);
}
:deep(.chat-message-markdown code) {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
:deep(.chat-message-markdown pre code) {
  padding: 0;
  background: transparent;
}
:deep(.chat-message-markdown :not(pre) > code) {
  padding: 0.15em 0.35em;
  border-radius: 0.25rem;
  background: rgb(244 244 245);
  border: 1px solid rgb(228 228 231);
}
.dark :deep(.chat-message-markdown :not(pre) > code) {
  background: rgb(39 39 42);
  border-color: rgb(63 63 70);
}
:deep(.chat-message-markdown a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}
:deep(.chat-message-markdown a:hover) {
  text-decoration: none;
}
:deep(.chat-message-markdown table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.95em;
}
:deep(.chat-message-markdown th),
:deep(.chat-message-markdown td) {
  border: 1px solid rgb(228 228 231);
  padding: 0.35em 0.6em;
  text-align: left;
}
.dark :deep(.chat-message-markdown th),
.dark :deep(.chat-message-markdown td) {
  border-color: rgb(63 63 70);
}
:deep(.chat-message-markdown hr) {
  margin: 0.75em 0;
  border: none;
  border-top: 1px solid rgb(228 228 231);
}
.dark :deep(.chat-message-markdown hr) {
  border-top-color: rgb(63 63 70);
}

/* 发送方气泡内 Markdown：随主题 primary-foreground */
:deep(.chat-message-markdown--on-primary),
:deep(.chat-message-markdown--on-primary p),
:deep(.chat-message-markdown--on-primary li),
:deep(.chat-message-markdown--on-primary blockquote),
:deep(.chat-message-markdown--on-primary th),
:deep(.chat-message-markdown--on-primary td) {
  color: inherit;
}
:deep(.chat-message-markdown--on-primary blockquote) {
  border-left-color: color-mix(in srgb, currentColor 50%, transparent);
}
:deep(.chat-message-markdown--on-primary pre) {
  background: color-mix(in srgb, currentColor 15%, transparent);
  border-color: color-mix(in srgb, currentColor 30%, transparent);
}
:deep(.chat-message-markdown--on-primary :not(pre) > code) {
  background: color-mix(in srgb, currentColor 15%, transparent);
  border-color: color-mix(in srgb, currentColor 30%, transparent);
  color: inherit;
}
:deep(.chat-message-markdown--on-primary a) {
  color: inherit;
  text-decoration: underline;
}
:deep(.chat-message-markdown--on-primary th),
:deep(.chat-message-markdown--on-primary td) {
  border-color: color-mix(in srgb, currentColor 40%, transparent);
}
:deep(.chat-message-markdown--on-primary hr) {
  border-top-color: color-mix(in srgb, currentColor 40%, transparent);
}

/* 发送方气泡内选中：高对比度，避免在 primary 背景上看不清 */
:deep(.chat-bubble-user *::selection) {
  background: rgba(255, 255, 255, 0.55);
  color: hsl(var(--primary));
}
:deep(.chat-bubble-user *::-moz-selection) {
  background: rgba(255, 255, 255, 0.55);
  color: hsl(var(--primary));
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  animation: streaming-blink 1s ease-in-out infinite;
}
@keyframes streaming-blink {
  0%,
  45%,
  55%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

/* 流式结论每段文字轻微渐显 */
.stream-token {
  animation: stream-token-in 0.2s ease-out;
}
@keyframes stream-token-in {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

/* 思考中占位：图标轻微呼吸 + 三点依次亮起 */
.thinking-icon {
  animation: thinking-icon-pulse 2s ease-in-out infinite;
}
.thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.thinking-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: thinking-dot-step 1.2s ease-in-out infinite;
}
.thinking-dot-2 {
  animation-delay: 0.2s;
}
.thinking-dot-3 {
  animation-delay: 0.4s;
}
@keyframes thinking-icon-pulse {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}
@keyframes thinking-dot-step {
  0%,
  80%,
  100% {
    opacity: 0.35;
  }
  40% {
    opacity: 1;
  }
}
</style>
