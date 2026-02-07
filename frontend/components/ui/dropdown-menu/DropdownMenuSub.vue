<template>
  <DropdownMenuSub v-bind="$attrs">
    <slot />
  </DropdownMenuSub>
</template>

<script setup lang="ts">
import { DropdownMenuSub as DropdownMenuSubPrimitive } from 'radix-vue'
defineOptions({ name: 'DropdownMenuSub' })
const DropdownMenuSub = DropdownMenuSubPrimitive
</script>
