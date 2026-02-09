<template>
  <div
    class="flex flex-col items-center justify-center gap-6 p-8 text-center"
    :class="compact ? 'py-12 gap-4' : ''"
  >
    <div class="flex flex-col items-center gap-3">
      <div
        class="rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center"
        :class="compact ? 'p-4' : 'p-5'"
      >
        <slot name="icon">
          <component :is="icon" v-if="icon" :class="compact ? 'h-10 w-10' : 'h-12 w-12'" stroke-width="1.5" />
        </slot>
      </div>
      <div class="space-y-1">
        <p class="text-base font-medium text-zinc-700 dark:text-zinc-300" :class="compact ? 'text-sm' : ''">
          {{ title }}
        </p>
        <p v-if="description" class="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px]">
          {{ description }}
        </p>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  /** 标题 */
  title: string
  /** 补充说明，可选 */
  description?: string
  /** 图标组件（无 slot#icon 时使用） */
  icon?: Component
  /** 紧凑样式（图标与内边距略小，用于列表内占位） */
  compact?: boolean
}>()
</script>
