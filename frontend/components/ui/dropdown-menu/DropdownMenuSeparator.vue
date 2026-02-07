<template>
  <DropdownMenuSeparator class="my-1 h-px bg-zinc-200 dark:bg-zinc-600" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { DropdownMenuSeparator as DropdownMenuSeparatorPrimitive } from 'radix-vue'
defineOptions({ name: 'DropdownMenuSeparator' })
const DropdownMenuSeparator = DropdownMenuSeparatorPrimitive
</script>
