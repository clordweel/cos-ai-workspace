<script setup lang="ts">
import type { AccordionContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AccordionContent as RekaAccordionContent, useForwardProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<AccordionContentProps & { class?: HTMLAttributes['class'] }>()
const delegated = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegated)
</script>

<template>
  <RekaAccordionContent
    data-slot="accordion-content"
    :class="cn('overflow-hidden text-xs', props.class)"
    v-bind="forwarded"
  >
    <div class="pb-3 pt-0">
      <slot />
    </div>
  </RekaAccordionContent>
</template>
