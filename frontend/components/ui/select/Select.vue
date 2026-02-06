<template>
  <RadixSelectRoot v-bind="$attrs">
    <slot />
  </RadixSelectRoot>
</template>

<script setup lang="ts">
import { SelectRoot as RadixSelectRoot } from 'radix-vue'
</script>
