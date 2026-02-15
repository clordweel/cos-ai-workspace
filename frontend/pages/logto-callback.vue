<template>
  <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
    <p v-if="!resolved" class="text-sm text-zinc-500 dark:text-zinc-400">登录处理中…</p>
    <template v-else>
      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-else class="text-xs text-zinc-500 dark:text-zinc-400">若已登录成功，请直接打开工作台。</p>
      <a
        href="/logto"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        重新登录
      </a>
      <a
        href="/space"
        class="text-sm text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-700"
      >
        返回工作台
      </a>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Logto 回调：收到 code 后交给中间层换 token 并写 Cookie，再重定向到工作台
 */
definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const apiBase = (config.public?.apiBase as string) || (typeof window !== 'undefined' ? '' : '')
const error = ref('')
const resolved = ref(false)

onMounted(() => {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const code = (q?.get('code') || (route.query?.code as string | undefined))?.trim()
  const err = q?.get('error') || (route.query?.error as string | undefined)
  const errDesc = q?.get('error_description') || (route.query?.error_description as string | undefined)

  if (err) {
    error.value = errDesc || err || '登录被拒绝或已取消'
    resolved.value = true
    return
  }

  if (!code) {
    error.value = '未收到授权码，请从「重新登录」再次发起登录；若刚从 Logto 跳回，请确认该应用已配置 Redirect URI：当前页地址。'
    resolved.value = true
    return
  }

  // 优先使用配置的对外地址，与 logto.vue 一致，避免 426 Upgrade Required（代理要求 HTTPS 时）
  const appOrigin = (config.public?.appOrigin as string) || ''
  const origin = typeof window !== 'undefined' ? (appOrigin || window.location.origin) : appOrigin || ''
  const redirectUri = `${origin}/logto-callback`
  // 必须跳转到「当前页同源」的 /api/...，Cookie 才会落在前端域名；若用 apiBase（如 127.0.0.1:3000）则 Cookie 在中间层域名，回到前端后无 Cookie
  const base = (typeof window !== 'undefined' ? origin : apiBase) || apiBase
  const url = `${base}/api/auth/logto/callback?${new URLSearchParams({
    code,
    redirect_uri: redirectUri,
  }).toString()}`
  window.location.href = url
})
</script>
