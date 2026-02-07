<template>
  <DropdownMenuSubTrigger
    class="flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-700 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-700"
    v-bind="$attrs"
  >
    <slot />
    <ChevronRight class="ml-auto h-3.5 w-3.5 opacity-60" />
  </DropdownMenuSubTrigger>
</template>

<script setup lang="ts">
import { DropdownMenuSubTrigger as DropdownMenuSubTriggerPrimitive } from 'radix-vue'
import { ChevronRight } from 'lucide-vue-next'
defineOptions({ name: 'DropdownMenuSubTrigger' })
const DropdownMenuSubTrigger = DropdownMenuSubTriggerPrimitive
</script>
