/**
 * Matrix 客户端封装（matrix-js-sdk）
 * 仅在浏览器环境创建/同步客户端；服务端返回空状态。
 */

import type { MatrixClient } from 'matrix-js-sdk'
import type { SyncState } from 'matrix-js-sdk'
import type { LoginResponse } from 'matrix-js-sdk'

const MATRIX_STORAGE_KEY = 'matrix_client_credentials'

/** 持久化的 Matrix 登录信息（仅 access_token / user_id / device_id，不存密码） */
interface StoredMatrixCreds {
  baseUrl: string
  accessToken: string
  userId: string
  deviceId: string
}

function getStoredCreds(): StoredMatrixCreds | null {
  if (import.meta.server || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(MATRIX_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredMatrixCreds
    if (data?.baseUrl && data?.accessToken && data?.userId && data?.deviceId) return data
  } catch {
    // ignore
  }
  return null
}

function setStoredCreds(creds: StoredMatrixCreds | null): void {
  if (import.meta.server || typeof window === 'undefined') return
  try {
    if (creds) sessionStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(creds))
    else sessionStorage.removeItem(MATRIX_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function useMatrixClient() {
  const config = useRuntimeConfig()
  const matrixBaseUrl = (config.public?.matrixBaseUrl as string) || ''

  const client = ref<MatrixClient | null>(null)
  const syncState = ref<SyncState | null>(null)
  const error = ref<Error | null>(null)

  const isLoggedIn = computed(() => !!client.value)
  /** 是否已完成首次同步（SyncState.Prepared） */
  const isReady = computed(() => syncState.value === ('PREPARED' as SyncState))

  /** 仅客户端：用已有凭证创建并启动客户端 */
  async function createAndStartClient(
    baseUrl: string,
    accessToken: string,
    userId: string,
    deviceId: string,
    persist = true
  ): Promise<MatrixClient> {
    if (import.meta.server) throw new Error('Matrix client is only available on the client')
    const sdk = await import('matrix-js-sdk')
    const c = sdk.createClient({
      baseUrl,
      accessToken,
      userId,
      deviceId,
    })
    client.value = c
    error.value = null
    syncState.value = null

    c.on(sdk.ClientEvent.Sync, (state: SyncState) => {
      syncState.value = state
    })

    await c.startClient({ initialSyncLimit: 20 })
    if (persist) setStoredCreds({ baseUrl, accessToken, userId, deviceId })
    return c
  }

  /** 密码登录：先临时客户端登录，再创建正式客户端并 startClient */
  async function loginWithPassword(
    user: string,
    password: string,
    baseUrl = matrixBaseUrl,
    persist = true
  ): Promise<MatrixClient> {
    if (import.meta.server) throw new Error('Matrix client is only available on the client')
    if (!baseUrl) throw new Error('Matrix baseUrl is required (env: NUXT_PUBLIC_MATRIX_BASE_URL)')
    const sdk = await import('matrix-js-sdk')
    const temp = sdk.createClient({ baseUrl })
    const res: LoginResponse = await temp.loginWithPassword(user, password)
    temp.stopClient?.()
    return createAndStartClient(
      baseUrl,
      res.access_token,
      res.user_id,
      res.device_id,
      persist
    )
  }

  /** Token 登录（如已有 access_token / device_id） */
  async function loginWithToken(
    accessToken: string,
    userId: string,
    deviceId: string,
    baseUrl = matrixBaseUrl,
    persist = true
  ): Promise<MatrixClient> {
    if (import.meta.server) throw new Error('Matrix client is only available on the client')
    if (!baseUrl) throw new Error('Matrix baseUrl is required')
    return createAndStartClient(baseUrl, accessToken, userId, deviceId, persist)
  }

  /** 登出：停止同步并清除客户端与本地存储 */
  function logout(): void {
    if (client.value) {
      try {
        client.value.stopClient?.()
      } catch {
        // ignore
      }
      client.value = null
    }
    syncState.value = null
    error.value = null
    setStoredCreds(null)
  }

  /** 若 sessionStorage 中有凭证则恢复登录（仅客户端、在 onMounted 或用户主动调用） */
  async function restoreSession(): Promise<MatrixClient | null> {
    if (import.meta.server) return null
    const creds = getStoredCreds()
    if (!creds) return null
    try {
      return await createAndStartClient(
        creds.baseUrl,
        creds.accessToken,
        creds.userId,
        creds.deviceId,
        true
      )
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      setStoredCreds(null)
      return null
    }
  }

  return {
    client: readonly(client),
    syncState: readonly(syncState),
    error: readonly(error),
    matrixBaseUrl,
    isLoggedIn,
    isReady,
    loginWithPassword,
    loginWithToken,
    logout,
    restoreSession,
  }
}
