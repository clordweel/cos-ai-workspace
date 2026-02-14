<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="w-[calc(100%-2rem)] max-w-sm rounded-xl border-zinc-200 p-0 gap-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      :show-close-button="true"
    >
      <DialogHeader class="border-b border-zinc-200 dark:border-zinc-600 px-5 py-4 pr-10">
        <DialogTitle class="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          {{ isOwner ? '删除会话' : '退出会话并删除' }}
        </DialogTitle>
        <DialogDescription class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {{ isOwner ? '确定删除该会话？删除后无法恢复。' : '确定退出并移出该会话？你将从会话列表中移出该会话。' }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="border-t border-zinc-200 dark:border-zinc-600 px-5 py-4 gap-3 sm:justify-end">
        <Button variant="outline" type="button" class="min-w-[4.5rem]" @click="onClose">
          取消
        </Button>
        <Button
          type="button"
          variant="destructive"
          class="min-w-[4.5rem]"
          @click="onConfirm"
        >
          确定
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
  /** 当前用户是否为会话拥有者；非拥有者时展示「退出会话并删除」 */
  isOwner: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}

function onClose() {
  emit('close')
}

function onConfirm() {
  emit('confirm')
}
</script>
