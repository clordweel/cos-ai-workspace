<template>
  <div class="min-h-full flex flex-col overflow-y-auto" :style="{ paddingTop: paddingTop }">
    <div class="px-3 py-3">
      <h2 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-1">
        本地界面设置
      </h2>
      <Accordion type="single" collapsible :default-value="'font-size'">
        <AccordionItem value="font-size">
          <AccordionTrigger>界面字体大小</AccordionTrigger>
          <AccordionContent>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">
              仅调节聊天与输入框的字号。
            </p>
            <div class="flex items-center justify-between gap-3 mb-2">
              <span class="text-[11px] text-zinc-600 dark:text-zinc-300">当前档位</span>
              <span class="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">
                {{ uiFontSizeStep }}
              </span>
            </div>
            <Slider
              :model-value="[uiFontSizeStep]"
              :min="FONT_STEP_MIN"
              :max="FONT_STEP_MAX"
              :step="1"
              class="w-full max-w-[12rem] mx-auto"
              @update:model-value="setUIFontSizeStep(($event as number[])[0])"
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Slider } from '~/components/ui/slider'
import { useUISettings } from '~/composables/useUISettings'

defineProps<{
  paddingTop?: string
}>()

const { uiFontSizeStep, setUIFontSizeStep, FONT_STEP_MIN, FONT_STEP_MAX } = useUISettings()
</script>
