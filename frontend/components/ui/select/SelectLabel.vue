<script setup lang="ts">
import type { SelectLabelProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { SelectLabel } from "reka-ui"
import { cn } from '~/lib/utils'

const props = defineProps<SelectLabelProps & { class?: HTMLAttributes["class"] }>()
</script>

<template>
  <SelectLabel
    data-slot="select-label"
    :class="cn('text-zinc-500 px-2 py-1.5 text-xs dark:text-zinc-400', props.class)"
  >
    <slot />
  </SelectLabel>
</template>
