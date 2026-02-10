// https://nuxt.com/docs/api/configuration/nuxt-config
/// <reference types="node" />
import path from 'path'
import { fileURLToPath } from 'url'
import { defineNuxtConfig } from 'nuxt/config'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'

const dir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(dir, '..', '.env') })

export default defineNuxtConfig({
  devtools: { enabled: true },
  // 规避 Nuxt 3.15+ 开发时 Vite 无法解析 #app-manifest 的 pre-transform 错误（见 nuxt/nuxt#30461、#33606）
  experimental: { appManifest: false },
  // 若仍出现 500 (reading 'ce'/'isCE')，可临时开启下一行关闭 SSR 以规避 Nuxt 3.11+ addComponent 已知问题
  // ssr: false,
  modules: ['shadcn-nuxt', '@nuxtjs/color-mode', '@logto/nuxt'],
  colorMode: {
    classSuffix: '',
  },
  css: ['~/assets/css/tailwind.css'],
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
  compatibilityDate: '2025-02-01',
  devServer: { port: 3001, host: '0.0.0.0' },
  build: {
    transpile: ['radix-vue', 'reka-ui', 'matrix-js-sdk'],
  },
  app: {
    head: {
      title: 'AI COS 工作台',
      meta: [{ name: 'theme-color', content: '#0a0a0a' }],
    },
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? '',
      logtoEndpoint: process.env.NUXT_PUBLIC_LOGTO_ENDPOINT ?? '',
      logtoAppId: process.env.NUXT_PUBLIC_LOGTO_APP_ID ?? '',
      /** Matrix homeserver URL，用于 Matrix 客户端（如 matrix-js-sdk） */
      matrixBaseUrl: process.env.NUXT_PUBLIC_MATRIX_BASE_URL ?? '',
      /** 与中间层 CHAT_PROVIDER 一致时关闭前端 mock 会话列表，仅展示真实会话（如 matrix） */
      chatProvider: process.env.NUXT_PUBLIC_CHAT_PROVIDER ?? '',
    },
    /** @logto/nuxt：提供 useLogtoUser / useLogtoClient；登录入口仍为 /logto（跳 Logto）→ /logto-callback → 中间层写 Cookie */
    logto: {
      endpoint: process.env.NUXT_LOGTO_ENDPOINT || process.env.NUXT_PUBLIC_LOGTO_ENDPOINT || '',
      appId: process.env.NUXT_LOGTO_APP_ID || process.env.NUXT_PUBLIC_LOGTO_APP_ID || '',
      appSecret: process.env.LOGTO_APP_SECRET || '',
      cookieEncryptionKey: process.env.NUXT_LOGTO_COOKIE_ENCRYPTION_KEY || process.env.LOGTO_COOKIE_ENCRYPTION_KEY || 'logto-nuxt-default-key-change-in-production',
      fetchUserInfo: true,
      pathnames: {
        signIn: '/sign-in',
        signOut: '/sign-out',
        callback: '/callback',
      },
      postCallbackRedirectUri: '/',
      postLogoutRedirectUri: '/',
    },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['vue', 'reka-ui'],
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  },
})
