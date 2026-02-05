<template>
  <div class="flex flex-col h-full">
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const scrollRef = ref<HTMLElement | null>(null)
defineExpose({ scrollRef })
</script>
