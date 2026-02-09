<script setup lang="ts">
import type { AccordionItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AccordionItem as RekaAccordionItem, useForwardProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<AccordionItemProps & { class?: HTMLAttributes['class'] }>()
const delegated = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegated)
</script>

<template>
  <RekaAccordionItem
    data-slot="accordion-item"
    :class="cn('border-b border-zinc-200 dark:border-zinc-700', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </RekaAccordionItem>
</template>
