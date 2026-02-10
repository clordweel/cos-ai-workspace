<template>
  <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
    <p class="text-sm text-zinc-500 dark:text-zinc-400">正在跳转到登录…</p>
    <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Logto 登录入口：由 Nuxt 承载，跳转到 Logto 授权页；回调地址为前端 /logto-callback
 */
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const error = ref('')

onMounted(() => {
  const endpoint = (config.public?.logtoEndpoint as string) || ''
  const appId = (config.public?.logtoAppId as string) || ''
  if (!endpoint || !appId) {
    error.value = '未配置单点登录（NUXT_PUBLIC_LOGTO_ENDPOINT / NUXT_PUBLIC_LOGTO_APP_ID）'
    return
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const redirectUri = `${origin}/logto-callback`
  const state = `nuxt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid',
    state,
  })
  window.location.href = `${endpoint.replace(/\/$/, '')}/oidc/auth?${params.toString()}`
})
</script>
