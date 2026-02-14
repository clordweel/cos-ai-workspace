<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="w-[calc(100%-2rem)] max-w-md rounded-xl border-zinc-200 p-0 gap-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      :show-close-button="true"
    >
      <DialogHeader class="border-b border-zinc-200 dark:border-zinc-600 px-5 py-4 pr-10">
        <DialogTitle class="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          会话成员
        </DialogTitle>
        <DialogDescription class="sr-only">
          查看成员、邀请、取消邀请、踢出或屏蔽
        </DialogDescription>
      </DialogHeader>
      <div class="px-5 py-4">
        <div v-if="sessionId" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <Input
              v-model="inviteInput"
              placeholder="输入 Matrix ID（如 @user:server）"
              class="flex-1 rounded-lg border-zinc-200 dark:border-zinc-600 text-sm"
              @keydown.enter.prevent="onInvite"
            />
            <Button
              type="button"
              size="sm"
              :disabled="!inviteInput.trim() || inviting"
              @click="onInvite"
            >
              {{ inviting ? '邀请中…' : '邀请' }}
            </Button>
          </div>
          <p v-if="inviteError" class="text-xs text-red-600 dark:text-red-400">
            {{ inviteError }}
          </p>
        </div>
      </div>
      <div class="min-h-[12rem] max-h-[min(50vh,320px)] overflow-y-auto border-t border-zinc-200 dark:border-zinc-600">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <span class="text-sm text-zinc-500 dark:text-zinc-400">加载中…</span>
        </div>
        <template v-else-if="members.length === 0">
          <Empty
            compact
            title="暂无成员"
            description="邀请成员后将显示在此"
            :icon="Users"
            class="py-8"
          />
        </template>
        <ul v-else class="divide-y divide-zinc-100 dark:divide-zinc-700/80">
          <li
            v-for="m in members"
            :key="m.userId"
            class="flex items-center gap-3 px-5 py-2.5"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs font-medium"
            >
              <img
                v-if="m.avatarUrl"
                :src="m.avatarUrl"
                :alt="m.displayName || m.userId"
                class="h-full w-full object-cover"
              >
              <template v-else>{{ (m.displayName || m.userId).slice(0, 1) }}</template>
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {{ m.displayName || m.userId }}
              </p>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {{ m.userId }}
              </p>
            </div>
            <span class="shrink-0 flex items-center gap-1.5">
              <span
                v-if="m.isOwner"
                class="rounded px-1.5 py-0.5 text-[11px] font-medium bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200"
              >
                会话拥有者
              </span>
              <span
                class="rounded px-1.5 py-0.5 text-[11px] font-medium"
                :class="m.membership === 'invite'
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'"
              >
                {{ m.membership === 'invite' ? '待接受' : '已加入' }}
              </span>
            </span>
            <div v-if="m.userId !== currentUserMxid" class="shrink-0 flex items-center gap-1">
              <Button
                v-if="m.membership === 'invite'"
                type="button"
                variant="outline"
                size="sm"
                class="text-xs"
                :disabled="actionTarget === m.userId"
                @click="onCancelInvite(m.userId)"
              >
                {{ actionTarget === m.userId ? '处理中…' : '取消邀请' }}
              </Button>
              <template v-if="m.membership === 'join' && !m.isOwner">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="text-xs"
                  :disabled="actionTarget === m.userId"
                  @click="onKick(m.userId)"
                >
                  {{ actionTarget === m.userId ? '处理中…' : '踢出' }}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  class="text-xs"
                  :disabled="actionTarget === m.userId"
                  @click="onBan(m.userId)"
                >
                  屏蔽
                </Button>
              </template>
            </div>
          </li>
        </ul>
      </div>
      <DialogFooter class="border-t border-zinc-200 dark:border-zinc-600 px-5 py-3 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between">
        <div v-if="showLeaveSession" class="flex items-center">
          <Button
            type="button"
            variant="outline"
            class="text-xs text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-600"
            :disabled="leaving"
            @click="onLeaveSession"
          >
            {{ leaving ? '退出中…' : '退出会话' }}
          </Button>
        </div>
        <div class="flex justify-end sm:flex-1">
          <Button variant="outline" type="button" class="min-w-[4.5rem]" @click="emit('close')">
            关闭
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Users } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Empty } from '~/components/ui/empty'
import type { ApiSessionMember } from '~/composables/useChatSessionsApi'

const props = defineProps<{
  open: boolean
  sessionId: string | undefined
  sessionTitle?: string
  currentUserMxid?: string
  fetchMembers: (sessionId: string) => Promise<ApiSessionMember[]>
  kick: (sessionId: string, userId: string) => Promise<boolean>
  ban: (sessionId: string, userId: string) => Promise<boolean>
  invite: (sessionId: string, userId: string) => Promise<boolean>
  /** 当前用户非拥有者时用于退出会话（成功后关闭弹窗并跳转） */
  leaveSession?: (sessionId: string) => Promise<boolean>
}>()

const emit = defineEmits<{ close: [] }>()

const members = ref<ApiSessionMember[]>([])
const loading = ref(false)
const inviteInput = ref('')
const inviting = ref(false)
const inviteError = ref('')
const actionTarget = ref<string | null>(null)
const leaving = ref(false)

/** 当前用户是否为会话拥有者（拥有者不显示退出会话） */
const currentUserIsOwner = computed(
  () => props.currentUserMxid && members.value.some((m) => m.userId === props.currentUserMxid && m.isOwner),
)

/** 当前用户非拥有者且已加入时显示「退出会话」 */
const showLeaveSession = computed(
  () =>
    props.sessionId &&
    props.currentUserMxid &&
    props.leaveSession &&
    !currentUserIsOwner.value &&
    members.value.some((m) => m.userId === props.currentUserMxid && m.membership === 'join'),
)

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}

async function loadMembers() {
  if (!props.sessionId) return
  loading.value = true
  try {
    members.value = await props.fetchMembers(props.sessionId)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.sessionId] as const,
  ([open, id]) => {
    if (open && id) {
      inviteError.value = ''
      inviteInput.value = ''
      loadMembers()
    }
  },
  { immediate: true },
)

async function onInvite() {
  const id = props.sessionId
  const uid = inviteInput.value.trim()
  if (!id || !uid) return
  inviteError.value = ''
  inviting.value = true
  try {
    const ok = await props.invite(id, uid)
    if (ok) {
      inviteInput.value = ''
      await loadMembers()
    } else {
      inviteError.value = '邀请失败，请检查 Matrix ID 或权限'
    }
  } finally {
    inviting.value = false
  }
}

async function onCancelInvite(userId: string) {
  if (!props.sessionId) return
  actionTarget.value = userId
  try {
    const ok = await props.kick(props.sessionId, userId)
    if (ok) await loadMembers()
  } finally {
    actionTarget.value = null
  }
}

async function onKick(userId: string) {
  if (!props.sessionId) return
  actionTarget.value = userId
  try {
    const ok = await props.kick(props.sessionId, userId)
    if (ok) await loadMembers()
  } finally {
    actionTarget.value = null
  }
}

async function onBan(userId: string) {
  if (!props.sessionId) return
  actionTarget.value = userId
  try {
    const ok = await props.ban(props.sessionId, userId)
    if (ok) await loadMembers()
  } finally {
    actionTarget.value = null
  }
}

async function onLeaveSession() {
  const id = props.sessionId
  const leave = props.leaveSession
  if (!id || !leave) return
  leaving.value = true
  try {
    const ok = await leave(id)
    if (ok) emit('close')
  } finally {
    leaving.value = false
  }
}
</script>
