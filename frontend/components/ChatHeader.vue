<template>
  <header
    class="absolute top-0 left-0 right-0 z-20 grid h-12 shrink-0 grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 border-b border-zinc-200/60 dark:border-zinc-700/60 backdrop-blur-md bg-white/75 dark:bg-zinc-800/75"
    aria-label="会话标题"
  >
    <div class="flex min-w-0 items-center gap-2">
      <NuxtLink
        v-if="!isSessionExpanded"
        to="/space"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"
        aria-label="返回会话列表"
      >
        <ChevronLeft class="h-4 w-4" />
      </NuxtLink>
    </div>
    <div class="flex min-w-0 items-center justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          class="max-w-[14rem] inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-sm font-medium truncate bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-inset"
          aria-label="会话菜单"
        >
          <span class="min-w-0 max-w-[100px] truncate text-xs">{{ title }}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" :side-offset="4" class="chat-header-dropdown w-max min-w-[10rem] text-xs">
          <DropdownMenuItem class="!text-xs" text-value="重命名会话" @select="$emit('rename')">
            <Pencil class="h-3.5 w-3.5 shrink-0 opacity-70" />
            重命名会话
          </DropdownMenuItem>
          <DropdownMenuItem class="!text-xs" text-value="分享此会话" @select="$emit('share')">
            <Share2 class="h-3.5 w-3.5 shrink-0 opacity-70" />
            分享此会话
          </DropdownMenuItem>
          <DropdownMenuItem class="!text-xs" text-value="复制会话链接" @select="$emit('copy-link')">
            <Link class="h-3.5 w-3.5 shrink-0 opacity-70" />
            复制会话链接
          </DropdownMenuItem>
          <DropdownMenuItem class="!text-xs" text-value="关闭会话" @select="$emit('close')">
            <X class="h-3.5 w-3.5 shrink-0 opacity-70" />
            关闭会话
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class="!text-xs justify-start gap-2" text-value="导出为...">
              <span class="flex min-w-0 flex-1 items-center gap-2">
                <Download class="h-3.5 w-3.5 shrink-0 opacity-70" />
                导出为…
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="text-xs">
              <DropdownMenuItem class="!text-xs" text-value="当前屏" @select="$emit('export-screen')">
                当前屏
              </DropdownMenuItem>
              <DropdownMenuItem class="!text-xs" text-value="长屏截图" @select="$emit('export-screenshot')">
                长屏截图
              </DropdownMenuItem>
              <DropdownMenuItem class="!text-xs" text-value="导出 markdown" @select="$emit('export-markdown')">
                导出 Markdown
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="!text-xs" text-value="归档会话" @select="$emit('archive')">
            <Archive class="h-3.5 w-3.5 shrink-0 opacity-70" />
            归档会话
          </DropdownMenuItem>
          <DropdownMenuItem
            class="!text-xs !text-red-600 dark:!text-red-400 hover:!bg-red-50 dark:hover:!bg-red-900/20 data-[highlighted]:!text-red-600 dark:data-[highlighted]:!text-red-400 data-[highlighted]:!bg-red-50 dark:data-[highlighted]:!bg-red-900/20"
            text-value="删除会话"
            @select="$emit('delete')"
          >
            <Trash2 class="h-3.5 w-3.5 shrink-0 opacity-80" />
            删除会话
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div class="flex min-w-0 items-center justify-end gap-1.5" :title="userName">
      <span
        v-if="userName"
        class="hidden sm:inline shrink-0 text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[6rem]"
      >{{ userName }}</span>
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white text-xs font-medium"
        aria-hidden
      >
        <img
          v-if="userAvatar"
          :src="userAvatar"
          :alt="userName || '用户'"
          class="h-full w-full object-cover"
        />
        <template v-else-if="userName?.trim()">{{ userName.trim().slice(0, 1) }}</template>
        <User v-else class="h-3.5 w-3.5" />
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Archive, ChevronLeft, Download, Link, Pencil, Share2, Trash2, User, X } from 'lucide-vue-next'

defineProps<{
  title: string
  userName: string
  /** 用户头像 URL，有则显示头像，无则显示姓名首字 */
  userAvatar?: string
  isSessionExpanded: boolean
}>()
defineEmits<{
  (e: 'close'): void
  (e: 'rename'): void
  (e: 'share'): void
  (e: 'copy-link'): void
  (e: 'export-screen'): void
  (e: 'export-screenshot'): void
  (e: 'export-markdown'): void
  (e: 'archive'): void
  (e: 'delete'): void
}>()
</script>
