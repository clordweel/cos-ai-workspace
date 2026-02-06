<template>
  <RadixSelectPortal>
    <RadixSelectContent
      class="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-md"
      position="popper"
      :side-offset="4"
      v-bind="$attrs"
    >
      <RadixSelectViewport class="p-1">
        <slot />
      </RadixSelectViewport>
    </RadixSelectContent>
  </RadixSelectPortal>
</template>

<script setup lang="ts">
import { SelectContent as RadixSelectContent, SelectPortal as RadixSelectPortal, SelectViewport as RadixSelectViewport } from 'radix-vue'
</script>
