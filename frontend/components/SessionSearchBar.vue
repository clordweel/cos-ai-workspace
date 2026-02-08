<template>
  <!-- 灰底容器：输入区自右向左展开，搜索按钮始终可见；收缩完成后再改为透明 -->
  <div
    class="flex shrink-0 items-center justify-end overflow-hidden rounded-full pr-0 transition-colors duration-200"
    :class="showGrayBg ? 'bg-zinc-100 dark:bg-zinc-700' : 'bg-transparent'"
  >
    <div
      class="flex min-w-0 shrink-0 justify-end overflow-hidden transition-[max-width] duration-200 ease-out"
      :class="open ? 'max-w-[12rem]' : 'max-w-0'"
    >
      <input
        ref="inputRef"
        type="text"
        :value="modelValue"
        placeholder="搜索会话"
        class="min-w-0 flex-1 rounded-full border-0 bg-zinc-100 dark:bg-zinc-700 py-2 pl-4 pr-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0"
        aria-label="搜索会话"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <button
      type="button"
      class="flex shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-[color,width,height] duration-200 ml-[2px] mr-[2px]"
      :class="open ? 'h-7 w-7' : 'h-8 w-8'"
      :title="open ? '收起搜索' : '搜索'"
      aria-label="搜索"
      @click="$emit('toggle')"
    >
      <Search :class="open ? 'h-3.5 w-3.5' : 'h-4 w-4'" class="shrink-0 transition-[width,height] duration-200" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { watch, ref, onUnmounted } from 'vue'

const COLLAPSE_DURATION_MS = 200

const props = defineProps<{
  open?: boolean
  modelValue?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
  toggle: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const showGrayBg = ref(props.open ?? false)
let collapseTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      showGrayBg.value = true
      if (collapseTimer) {
        clearTimeout(collapseTimer)
        collapseTimer = null
      }
      setTimeout(() => inputRef.value?.focus(), 220)
    } else {
      collapseTimer = setTimeout(() => {
        showGrayBg.value = false
        collapseTimer = null
      }, COLLAPSE_DURATION_MS)
    }
  }
)

onUnmounted(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
})
</script>
