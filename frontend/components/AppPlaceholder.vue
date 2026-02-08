<template>
  <div class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50 p-6 text-center">
    <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">{{ ext?.name ?? '应用' }}</p>
    <p v-if="ext?.description" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ ext.description }}</p>
    <p class="mt-4 text-xs text-zinc-400 dark:text-zinc-500">敬请期待</p>
  </div>
</template>

<script setup lang="ts">
const { activeTab } = useAppView()
const { get: getAppExtension } = useAppExtensions()
const ext = computed(() => {
  const tab = activeTab.value
  if (!tab?.appId) return null
  return getAppExtension(tab.appId) ?? null
})
</script>
