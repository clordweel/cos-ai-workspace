// Nuxt 在构建时注入 import.meta.server，为 TypeScript 提供类型
declare global {
  interface ImportMeta {
    server?: boolean
  }
}

export {}
