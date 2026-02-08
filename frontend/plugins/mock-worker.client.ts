/**
 * 开发环境下启动 MSW Worker，拦截 /api/mock/* 并返回 mock 数据库数据。
 * 仅 client 端、且仅在启用 mock 时执行。
 */

import { setupWorker } from 'msw/browser'
import { mockHandlers } from '~/mock/handlers'

const worker = setupWorker(...mockHandlers)

export default defineNuxtPlugin(async () => {
  const enabled = import.meta.dev
  if (!enabled) return
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
})
