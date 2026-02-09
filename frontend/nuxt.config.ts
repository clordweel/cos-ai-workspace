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
  // 若仍出现 500 (reading 'ce'/'isCE')，可临时开启下一行关闭 SSR 以规避 Nuxt 3.11+ addComponent 已知问题
  // ssr: false,
  modules: ['shadcn-nuxt', '@nuxtjs/color-mode'],
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
    transpile: ['radix-vue', 'reka-ui'],
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
