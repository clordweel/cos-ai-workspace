<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="w-[calc(100%-2rem)] max-w-sm rounded-xl border-zinc-200 p-0 gap-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      :show-close-button="true"
    >
      <DialogHeader class="border-b border-zinc-200 dark:border-zinc-600 px-5 py-4 pr-10">
        <DialogTitle class="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          重命名会话
        </DialogTitle>
        <DialogDescription class="sr-only">
          输入新名称并确认
        </DialogDescription>
      </DialogHeader>
      <div class="px-5 py-5">
        <label
          for="rename-session-input"
          class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          会话名称
        </label>
        <Input
          id="rename-session-input"
          ref="inputRef"
          :model-value="inputValue"
          placeholder="输入会话名称"
          class="mt-1.5 w-full rounded-lg border-zinc-200 dark:border-zinc-600"
          @update:model-value="inputValue = $event"
          @keydown.enter.prevent="onSubmit"
        />
      </div>
      <DialogFooter class="border-t border-zinc-200 dark:border-zinc-600 px-5 py-4 gap-3 sm:justify-end">
        <Button variant="outline" type="button" class="min-w-[4.5rem]" @click="onClose">
          取消
        </Button>
        <Button type="button" class="min-w-[4.5rem]" :disabled="!canSubmit" @click="onSubmit">
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { watch, ref, nextTick, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  open: boolean
  currentTitle: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [title: string]
}>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)
const inputValue = ref('')

const canSubmit = computed(() => inputValue.value.trim() !== '')

watch(
  () => [props.open, props.currentTitle] as const,
  ([open, title]) => {
    if (open) {
      inputValue.value = title
      nextTick(() => {
        const comp = inputRef.value
        const el = comp?.$el as HTMLInputElement | undefined
        if (el?.focus) el.focus()
      })
    }
  },
  { immediate: true }
)

function onOpenChange(open: boolean) {
  if (!open) onClose()
}

function onClose() {
  emit('close')
}

function onSubmit() {
  const t = inputValue.value.trim()
  if (!t) return
  emit('confirm', t)
}
</script>
