<template>
  <DropdownMenuPortal to="body">
    <DropdownMenuSubContent
      class="z-[100] min-w-[180px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
      :side-offset="4"
      v-bind="$attrs"
    >
      <slot />
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import { DropdownMenuSubContent as DropdownMenuSubContentPrimitive, DropdownMenuPortal } from 'radix-vue'
defineOptions({ name: 'DropdownMenuSubContent' })
const DropdownMenuSubContent = DropdownMenuSubContentPrimitive
</script>
