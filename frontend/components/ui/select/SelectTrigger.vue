<template>
  <RadixSelectTrigger
    class="flex h-9 w-full items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 shadow-sm ring-offset-white dark:ring-offset-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
    v-bind="$attrs"
  >
    <slot />
    <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
  </RadixSelectTrigger>
</template>

<script setup lang="ts">
import { SelectTrigger as RadixSelectTrigger } from 'radix-vue'
import { ChevronDown } from 'lucide-vue-next'
</script>
