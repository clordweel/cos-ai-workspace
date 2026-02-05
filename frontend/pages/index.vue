<template />
<script setup lang="ts">
definePageMeta({ layout: 'workspace' })
// 首页即会话区：重定向到 /space，由会话区内部做列表/单聊局部切换
const router = useRouter()
const route = useRoute()

onMounted(() => {
  const withId = route.query.with as string | undefined
  if (withId) {
    router.replace({ path: '/space/' + withId, query: {} })
    return
  }
  const app = route.query.app as string | undefined
  if (app) {
    router.replace({ path: '/space', query: { app } })
    return
  }
  router.replace('/space')
})
</script>
