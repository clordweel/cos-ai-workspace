// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-02-01',
  devServer: { port: 3001 },
  app: {
    head: {
      title: 'AI 工作台',
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
