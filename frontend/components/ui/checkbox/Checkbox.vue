<template>
  <CheckboxRoot
    :id="id"
    :checked="checked"
    :disabled="disabled"
    class="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 ring-offset-white dark:ring-offset-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-50 dark:data-[state=checked]:bg-emerald-900/30 data-[state=checked]:text-emerald-600 dark:data-[state=checked]:text-emerald-400"
    v-bind="$attrs"
    @update:checked="(v: boolean) => $emit('update:checked', v)"
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <Check class="h-3.5 w-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<script setup lang="ts">
import { CheckboxRoot, CheckboxIndicator } from 'radix-vue'
import { Check } from 'lucide-vue-next'

defineProps<{
  id?: string
  checked?: boolean
  disabled?: boolean
}>()

defineEmits<{
  'update:checked': [value: boolean]
}>()
</script>
