<template>
  <div class="flex-1 flex min-h-0 items-center justify-center p-4">
    <p class="text-sm text-zinc-500">正在跳转到应用…</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

onMounted(() => {
  const tab = (route.query.tab as string) || 'contacts'
  const app = tab === 'bots' ? 'bots' : 'contacts'
  router.replace({ path: '/space', query: { app } })
})
</script>
