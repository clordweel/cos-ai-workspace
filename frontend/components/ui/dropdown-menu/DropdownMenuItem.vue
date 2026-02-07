<template>
  <DropdownMenuItem
    class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
    v-bind="$attrs"
  >
    <slot />
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import { DropdownMenuItem as DropdownMenuItemPrimitive } from 'radix-vue'
defineOptions({ name: 'DropdownMenuItem' })
const DropdownMenuItem = DropdownMenuItemPrimitive
</script>
