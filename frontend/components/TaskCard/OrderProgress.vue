<template>
  <div class="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4">
    <h4 class="text-sm font-medium text-zinc-300 mb-2">订单进度</h4>
    <p class="text-zinc-400 text-sm">{{ summary || '暂无数据' }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ summary?: string }>()
</script>
