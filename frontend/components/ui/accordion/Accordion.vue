<script setup lang="ts">
import type { AccordionRootEmits, AccordionRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AccordionRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = withDefaults(
  defineProps<AccordionRootProps & { class?: HTMLAttributes['class'] }>(),
  { type: 'single', collapsible: true }
)
const emits = defineEmits<AccordionRootEmits>()
const delegated = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <AccordionRoot
    data-slot="accordion"
    :class="cn('w-full', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </AccordionRoot>
</template>
