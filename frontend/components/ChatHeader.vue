<template>
  <header
    class="absolute top-0 left-0 right-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 px-3 border-b border-zinc-200/60 dark:border-zinc-700/60 backdrop-blur-md bg-white/75 dark:bg-zinc-800/75"
    aria-label="会话标题"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <NuxtLink
        v-if="!isSessionExpanded"
        to="/space"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors"
        aria-label="返回会话列表"
      >
        <ChevronLeft class="h-4 w-4" />
      </NuxtLink>
      <button
        type="button"
        class="flex items-center -space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 rounded-full"
        :aria-label="participantsLabel"
        :title="participantsLabel"
        @click="showMembersDialog = true"
      >
        <template v-if="displayParticipants.length > 0">
          <span
            v-for="(p, i) in displayParticipants.slice(0, 4)"
            :key="p.userId"
            class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs font-medium"
            :class="{ 'ring-2 ring-white dark:ring-zinc-800': i > 0 }"
          >
            <img
              v-if="p.avatarUrl"
              :src="p.avatarUrl"
              :alt="p.displayName || p.userId"
              class="h-full w-full object-cover"
            />
            <template v-else>{{ (p.displayName || p.userId).trim().slice(0, 1) || '?' }}</template>
          </span>
          <span
            v-if="displayParticipants.length > 4"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-700 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 -ml-2"
          >
            +{{ displayParticipants.length - 4 }}
          </span>
        </template>
        <span
          v-else
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white text-xs font-medium border-2 border-white dark:border-zinc-800"
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
      </button>
    </div>
    <!-- 预留：语音/视频通话图标位，后续接 Matrix 1:1 / MatrixRTC -->
    <div class="flex min-w-0 shrink-0 items-center gap-0.5">
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        aria-label="语音通话（敬请期待）"
        title="语音通话（敬请期待）"
        disabled
      >
        <Phone class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        aria-label="视频通话（敬请期待）"
        title="视频通话（敬请期待）"
        disabled
      >
        <Video class="h-4 w-4" />
      </button>
    </div>
    <div class="flex min-w-0 shrink-0 items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          class="flex h-7 shrink-0 items-center gap-0.5 rounded-md bg-transparent py-0.5 pl-0.5 pr-1 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-inset text-zinc-600 dark:text-zinc-400"
          :aria-label="`会话菜单：${title}`"
          :title="userName || '会话菜单'"
        >
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white text-[10px] font-medium"
            aria-hidden
          >
            <img
              v-if="userAvatar"
              :src="userAvatar"
              :alt="userName || '用户'"
              class="h-full w-full object-cover"
            />
            <template v-else-if="userName?.trim()">{{ userName.trim().slice(0, 1) }}</template>
            <User v-else class="h-3 w-3" />
          </span>
          <Menu class="h-3.5 w-3.5 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" :side-offset="4" class="chat-header-dropdown w-max min-w-[10rem] text-xs">
          <DropdownMenuItem class="!text-xs" text-value="会话成员" @select="onOpenMembers">
            <Users class="h-3.5 w-3.5 shrink-0 opacity-70" />
            会话成员
          </DropdownMenuItem>
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
    <SpaceSessionMembersDialog
      :open="showMembersDialog"
      :session-id="sessionId"
      :current-user-mxid="currentUserMxid"
      :fetch-members="fetchMembersFn"
      :kick="kickFn"
      :ban="banFn"
      :invite="inviteFn"
      :leave-session="leaveSessionFn"
      @close="onMembersDialogClose"
    />
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
import { ref, computed } from 'vue'
import { Archive, ChevronLeft, Download, Link, Menu, Pencil, Phone, Share2, Trash2, User, Users, Video, X } from 'lucide-vue-next'
import type { ApiSessionMember } from '~/composables/useChatSessionsApi'

const props = defineProps<{
  title: string
  userName: string
  /** 用户头像 URL，有则显示头像，无则显示姓名首字 */
  userAvatar?: string
  isSessionExpanded: boolean
  /** 会话成员（用于右侧堆叠头像；空时显示当前用户头像） */
  sessionMembers?: ApiSessionMember[]
  /** 当前会话 ID（用于成员弹窗） */
  sessionId?: string
  /** 当前用户 Matrix ID，用于成员列表中不显示踢出/屏蔽自己 */
  currentUserMxid?: string
  /** 拉取成员列表（成员弹窗内用） */
  fetchMembers?: (sessionId: string) => Promise<ApiSessionMember[]>
  /** 踢出成员 */
  kick?: (sessionId: string, userId: string) => Promise<boolean>
  /** 屏蔽成员 */
  ban?: (sessionId: string, userId: string) => Promise<boolean>
  /** 邀请成员 */
  invite?: (sessionId: string, userId: string) => Promise<boolean>
  /** 当前用户退出会话（非拥有者时在成员弹窗中显示；成功后跳转） */
  leaveSession?: (sessionId: string) => Promise<boolean>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-members'): void
  (e: 'rename'): void
  (e: 'share'): void
  (e: 'copy-link'): void
  (e: 'export-screen'): void
  (e: 'export-screenshot'): void
  (e: 'export-markdown'): void
  (e: 'archive'): void
  (e: 'delete'): void
  (e: 'members-closed'): void
}>()

const showMembersDialog = ref(false)

/** 参与者列表排除当前用户（会话拥有者） */
const displayParticipants = computed(() =>
  (props.sessionMembers ?? []).filter(
    (m) => !props.currentUserMxid || m.userId !== props.currentUserMxid,
  ),
)

const participantsLabel = computed(() =>
  displayParticipants.value.length > 0
    ? `参与者（${displayParticipants.value.length}）`
    : '参与者',
)

function onOpenMembers() {
  showMembersDialog.value = true
  emit('open-members')
}

function onMembersDialogClose() {
  showMembersDialog.value = false
  emit('members-closed')
}

const fetchMembersFn = computed(() => props.fetchMembers ?? (async () => [] as ApiSessionMember[]))
const kickFn = computed(() => props.kick ?? (async () => false))
const banFn = computed(() => props.ban ?? (async () => false))
const leaveSessionFn = computed(() => props.leaveSession)
const inviteFn = computed(() => props.invite ?? (async () => false))
</script>
