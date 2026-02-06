<template>
  <RadixSelectItem
    class="relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-zinc-100 dark:focus:bg-zinc-700 data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    v-bind="$attrs"
  >
    <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixSelectItemIndicator class="flex items-center justify-center">
        <Check class="h-4 w-4" />
      </RadixSelectItemIndicator>
    </span>
    <RadixSelectItemText>
      <slot />
    </RadixSelectItemText>
  </RadixSelectItem>
</template>

<script setup lang="ts">
import { SelectItem as RadixSelectItem, SelectItemIndicator as RadixSelectItemIndicator, SelectItemText as RadixSelectItemText } from 'radix-vue'
import { Check } from 'lucide-vue-next'
</script>
