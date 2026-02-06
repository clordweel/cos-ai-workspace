<template>
  <RadixSelectValue v-bind="$attrs">
    <slot />
  </RadixSelectValue>
</template>

<script setup lang="ts">
import { SelectValue as RadixSelectValue } from 'radix-vue'
</script>
