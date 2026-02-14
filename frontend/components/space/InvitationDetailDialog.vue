<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="w-[calc(100%-2rem)] max-w-sm rounded-xl border-zinc-200 p-0 gap-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      :show-close-button="true"
    >
      <DialogHeader class="border-b border-zinc-200 dark:border-zinc-600 px-5 py-4 pr-10">
        <DialogTitle class="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          会话邀请
        </DialogTitle>
        <DialogDescription class="sr-only">
          查看邀请详情并选择接受或拒绝
        </DialogDescription>
      </DialogHeader>
      <div class="px-5 py-5">
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">会话名称</p>
        <p class="text-sm text-zinc-800 dark:text-zinc-200">{{ invitation?.title ?? '—' }}</p>
        <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          接受后将加入该会话，拒绝则不再显示此邀请。
        </p>
      </div>
      <DialogFooter class="border-t border-zinc-200 dark:border-zinc-600 px-5 py-4 gap-3 sm:justify-end">
        <Button
          variant="outline"
          type="button"
          class="min-w-[4.5rem]"
          :disabled="busy"
          @click="onDecline"
        >
          拒绝
        </Button>
        <Button
          type="button"
          class="min-w-[4.5rem] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          :disabled="busy"
          @click="onAccept"
        >
          {{ busy ? '处理中…' : '接受' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  open: boolean
  invitation: { id: string; title: string } | null
  busy?: boolean
}>()

const emit = defineEmits<{
  close: []
  accept: [id: string, title: string]
  decline: [id: string]
}>()

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}

function onAccept() {
  if (!props.invitation || props.busy) return
  emit('accept', props.invitation.id, props.invitation.title)
}

function onDecline() {
  if (!props.invitation || props.busy) return
  emit('decline', props.invitation.id)
}
</script>
