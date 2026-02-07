<template>
  <DropdownMenuPortal to="body">
    <DropdownMenuContent
      class="z-[100] min-w-[200px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 p-1 shadow-lg"
      :side-offset="4"
      v-bind="$attrs"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import { DropdownMenuContent as DropdownMenuContentPrimitive, DropdownMenuPortal } from 'radix-vue'
defineOptions({ name: 'DropdownMenuContent' })
const DropdownMenuContent = DropdownMenuContentPrimitive
</script>
