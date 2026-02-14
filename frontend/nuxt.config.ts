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
  // Nuxt 4：保留当前目录结构（pages/components 等在项目根），不采用默认的 app/ 作为 srcDir
  srcDir: '.',
  dir: { app: '.' },
  // 规避开发时 Vite 与 app manifest 相关错误
  experimental: { appManifest: false },
  // 若仍出现 500 (reading 'ce'/'isCE')，可临时开启下一行关闭 SSR 以规避 Nuxt 3.11+ addComponent 已知问题
  // ssr: false,
  modules: ['@nuxt/ui', 'shadcn-nuxt', '@nuxtjs/color-mode', '@logto/nuxt'],
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
      title: 'COS&AI 工作空间',
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
      /** 临时样式调试：为 true 时强制显示 Mock 会话区块与列表，与 chatProvider 无关 */
      debugMockSessions: process.env.NUXT_PUBLIC_DEBUG_MOCK_SESSIONS === 'true',
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
    // matrix-js-sdk 及直接依赖中需 CJS 互操作的包纳入预构建（不含无 "." 入口的包如 @babel/runtime，详见 docs/MATRIX_SYNC_FRONTEND_APPROACH.md）
    // @matrix-org/matrix-sdk-crypto-wasm 排除预构建：包内通过 import('./pkg/xxx.wasm') 加载 WASM，预构建后 WASM 不会复制到 deps 导致 404
    optimizeDeps: {
      include: [
        '@nuxt/ui > prosemirror-state',
        '@nuxt/ui > prosemirror-transform',
        '@nuxt/ui > prosemirror-model',
        '@nuxt/ui > prosemirror-view',
        '@nuxt/ui > prosemirror-gapcursor',
        'matrix-js-sdk',
        'another-json',
        'bs58',
        'content-type',
        'events',
        'jwt-decode',
        'loglevel',
        'matrix-events-sdk',
        'matrix-widget-api',
        'oidc-client-ts',
        'p-retry',
        'sdp-transform',
        'unhomoglyph',
        'uuid',
      ],
      exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
          changeOrigin: true,
          // 避免 @nuxt/icon（Nuxt UI 图标）请求被转发到中间层导致 404；bypass 后由 Nuxt 本地 _nuxt_icon 路由处理
          bypass(req) {
            const url = req.url ?? ''
            if (url.includes('_nuxt_icon')) return url.replace(/^\/api/, '')
          },
          // 开发时：重写后端 Set-Cookie，使 cookie 落在前端 host，后续 DELETE/PATCH 等请求会带上
          configure(proxy) {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const setCookie = proxyRes.headers['set-cookie']
              if (!setCookie || !Array.isArray(setCookie)) return
              proxyRes.headers['set-cookie'] = setCookie.map((c: string) =>
                c
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*Domain=[^;]+/gi, '')
              )
            })
          },
        },
      },
    },
  },
})
