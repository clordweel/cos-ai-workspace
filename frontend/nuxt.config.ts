// https://nuxt.com/docs/api/configuration/nuxt-config
/// <reference types="node" />
import path from 'path'
import { fileURLToPath } from 'url'
import { defineNuxtConfig } from 'nuxt/config'
import dotenv from 'dotenv'

const dir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(dir, '..', '.env') })

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-02-01',
  devServer: { port: 3001, host: '0.0.0.0' },
  app: {
    head: {
      title: 'AI COS 工作台',
      meta: [{ name: 'theme-color', content: '#0a0a0a' }],
    },
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
    },
  },
  vite: {
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
