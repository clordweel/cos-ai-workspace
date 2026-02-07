<template>
  <DropdownMenuTrigger
    class="inline-flex h-8 min-w-0 max-w-full items-center justify-between gap-1.5 rounded-lg bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50 [&>span]:min-w-0 [&>span]:truncate"
    v-bind="$attrs"
  >
    <slot />
    <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
  </DropdownMenuTrigger>
</template>

<script setup lang="ts">
import { DropdownMenuTrigger as DropdownMenuTriggerPrimitive } from 'radix-vue'
import { ChevronDown } from 'lucide-vue-next'
defineOptions({ name: 'DropdownMenuTrigger' })
const DropdownMenuTrigger = DropdownMenuTriggerPrimitive
</script>
