<script setup lang="ts">
import type { AccordionTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AccordionHeader, AccordionTrigger as RekaAccordionTrigger, useForwardProps } from 'reka-ui'
import { ChevronDownIcon } from '@radix-icons/vue'
import { cn } from '~/lib/utils'

const props = defineProps<AccordionTriggerProps & { class?: HTMLAttributes['class'] }>()
const delegated = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegated)
</script>

<template>
  <AccordionHeader class="flex">
    <RekaAccordionTrigger
      data-slot="accordion-trigger"
      :class="cn(
        'flex flex-1 items-center justify-between py-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
        props.class
      )"
      v-bind="forwarded"
    >
      <slot />
      <ChevronDownIcon class="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform duration-200" />
    </RekaAccordionTrigger>
  </AccordionHeader>
</template>
