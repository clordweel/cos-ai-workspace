<template>
  <div
    class="flex shrink-0 items-center justify-end overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700 transition-colors duration-200"
  >
    <div class="flex min-w-0 max-w-[12rem] shrink-0 justify-end overflow-hidden">
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
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
</script>
