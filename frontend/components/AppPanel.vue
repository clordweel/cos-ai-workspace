<template>
  <div class="h-full flex flex-col overflow-hidden bg-white dark:bg-zinc-800 rounded-[inherit]">
    <div class="app-panel-scroll flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 min-w-0 flex flex-col items-stretch">
      <div class="app-panel-content w-full min-w-0 max-w-2xl mx-auto">
          <template v-if="currentView === 'home'">
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="app in homeAppList"
                :key="app.id"
                role="button"
                tabindex="0"
                class="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-700/50 p-4 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-600/50 hover:shadow-sm transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2"
                @click="openApp(app)"
                @keydown.enter.prevent="openApp(app)"
              >
                <div class="flex items-center gap-2.5">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white">
                    <component :is="app.icon" class="h-4 w-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ app.name }}</p>
                    <p v-if="app.description" class="text-xs text-zinc-600 dark:text-zinc-400 truncate">{{ app.description }}</p>
                  </div>
                </div>
              </div>
            </div>
            <p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              更多扩展应用将在此展示，支持物料、订单、BOM 等操作
            </p>
          </template>
          <template v-else-if="currentView === 'app' && currentAppExt">
            <component :is="currentAppExt.component" />
          </template>
          <template v-else-if="currentView === 'app'">
            <div class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50 p-6 text-center">
              <p class="text-sm text-zinc-600 dark:text-zinc-400">未找到该应用或扩展已卸载</p>
            </div>
          </template>
          <template v-else-if="currentView === 'contacts'">
            <ul class="divide-y divide-zinc-100 dark:divide-zinc-700">
              <li
                v-for="c in contacts"
                :key="c.id"
                class="flex items-center gap-2.5 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-md transition-colors -mx-0.5 px-0.5"
                @click="openChat('contact', c.id, c.name)"
              >
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-black dark:text-white text-xs font-medium">
                  {{ c.name.charAt(0) }}
                </span>
                <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200">{{ c.name }}</span>
              </li>
            </ul>
          </template>
          <template v-else-if="currentView === 'bots'">
            <ul class="divide-y divide-zinc-100 dark:divide-zinc-700">
              <li
                v-for="b in bots"
                :key="b.id"
                class="flex items-center gap-2.5 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-md transition-colors -mx-0.5 px-0.5"
                @click="openChat('bot', b.id, b.name)"
              >
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white">
                  <Bot class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">{{ b.name }}</p>
                  <p v-if="b.description" class="text-xs text-zinc-500 dark:text-zinc-400 truncate">{{ b.description }}</p>
                </div>
              </li>
            </ul>
          </template>
          <template v-else-if="currentView === 'auth'">
            <div class="auth-panel space-y-4">
              <div v-if="isAuthenticated" class="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 p-4">
                <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200">已登录</p>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{{ user }}</p>
                <button
                  type="button"
                  class="mt-3 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  @click="logout"
                >
                  退出登录
                </button>
              </div>
              <template v-else>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
                请选择一种方式登录，认证信息由 Cookie 保持。
              </p>
              <div class="flex gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-700/80">
                <button
                  type="button"
                  class="flex-1 rounded-md py-2 text-xs font-medium transition-colors"
                  :class="authMode === 'password' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white'"
                  @click="authMode = 'password'"
                >
                  账号密码
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-md py-2 text-xs font-medium transition-colors"
                  :class="authMode === 'token' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white'"
                  @click="authMode = 'token'"
                >
                  Token
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-md py-2 text-xs font-medium transition-colors"
                  :class="authMode === 'logto' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white'"
                  @click="authMode = 'logto'"
                >
                  单点登录
                </button>
              </div>
              <div class="min-h-[220px]">
              <div v-if="authMode === 'password'" class="space-y-3 p-4">
                <div>
                  <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">用户名</label>
                  <input
                    v-model="authUsername"
                    type="text"
                    class="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    placeholder="例如 Administrator"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">密码</label>
                  <input
                    v-model="authPassword"
                    type="password"
                    class="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    placeholder="密码"
                  />
                </div>
                <p v-if="authError" class="text-xs text-red-600 dark:text-red-400">{{ authError }}</p>
                <button
                  type="button"
                  class="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 px-3 disabled:opacity-50"
                  :disabled="authSubmitting || !authUsername || !authPassword"
                  @click="submitPasswordAuth"
                >
                  <span v-if="authSubmitting">登录中…</span>
                  <span v-else>登录</span>
                </button>
              </div>
              <div v-else-if="authMode === 'token'" class="space-y-3 p-4">
                <div>
                  <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">API Token</label>
                  <input
                    v-model="authToken"
                    type="password"
                    class="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 font-mono"
                    placeholder="api_key:api_secret 或 Bearer token"
                  />
                  <p class="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">在 ERPNext 用户设置中生成 API 密钥，格式为 api_key:api_secret</p>
                </div>
                <p v-if="authError" class="text-xs text-red-600 dark:text-red-400">{{ authError }}</p>
                <button
                  type="button"
                  class="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 px-3 disabled:opacity-50"
                  :disabled="authSubmitting || !authToken"
                  @click="submitTokenAuth"
                >
                  <span v-if="authSubmitting">验证中…</span>
                  <span v-else>使用 Token 登录</span>
                </button>
              </div>
              <div v-else-if="authMode === 'logto'" class="space-y-3 p-4">
                <p class="text-xs text-zinc-500 dark:text-zinc-400">通过 Logto 单点登录，将跳转至登录页，完成后返回本工作台。</p>
                <p v-if="authError || logtoQueryError" class="text-xs text-red-600 dark:text-red-400">{{ authError || logtoQueryError }}</p>
                <button
                  type="button"
                  class="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 px-3"
                  @click="submitLogtoAuth"
                >
                  使用 Logto 登录
                </button>
              </div>
              </div>
              </template>
            </div>
          </template>
          <template v-else-if="currentView === 'settings'">
            <div class="space-y-4">
              <section>
                <h3 class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">外观</h3>
                <div class="rounded-md border border-zinc-200 dark:border-zinc-600 divide-y divide-zinc-100 dark:divide-zinc-600">
                  <div class="px-3 py-2.5">
                    <p class="text-sm text-zinc-800 dark:text-zinc-200 mb-2">主题</p>
                    <Select
                      :model-value="themeMode"
                      @update:model-value="(v: string) => setTheme(v as ThemeMode)"
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="选择主题" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">浅色</SelectItem>
                        <SelectItem value="dark">深色</SelectItem>
                        <SelectItem value="system">跟随系统</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
              <section>
                <h3 class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">通用</h3>
                <div class="rounded-md border border-zinc-200 dark:border-zinc-600 divide-y divide-zinc-100 dark:divide-zinc-600">
                  <label class="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                    <span class="text-sm text-zinc-800 dark:text-zinc-200">通知</span>
                    <Checkbox id="settings-notify" :checked="notificationsEnabled" @update:checked="notificationsEnabled = $event" />
                  </label>
                </div>
              </section>
              <section>
                <h3 class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">系统诊断</h3>
                <div class="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50 p-4 space-y-3">
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    通过 Frappe SDK 检测 ERPNext 连接与基础信息，无需业务权限。
                  </p>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                    :disabled="diagnosticsLoading"
                    @click="runDiagnostics"
                  >
                    <component :is="diagnosticsLoading ? Loader2 : Stethoscope" class="h-3.5 w-3.5 shrink-0" :class="diagnosticsLoading ? 'animate-spin' : ''" />
                    {{ diagnosticsLoading ? '检测中…' : '运行诊断' }}
                  </button>
                  <div v-if="diagnosticsResult" class="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-600">
                    <div
                      v-for="c in diagnosticsResult.checks"
                      :key="c.id"
                      class="flex items-start gap-2 text-xs"
                    >
                      <span
                        class="shrink-0 mt-0.5 rounded-full p-0.5"
                        :class="c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
                        :title="c.ok ? '通过' : '未通过'"
                      >
                        <CheckCircle2 v-if="c.ok" class="h-3.5 w-3.5" />
                        <AlertCircle v-else class="h-3.5 w-3.5" />
                      </span>
                      <div class="min-w-0 flex-1">
                        <span class="font-medium text-zinc-700 dark:text-zinc-300">{{ c.name }}</span>
                        <template v-if="c.value != null && c.value !== ''">
                          <span class="text-zinc-500 dark:text-zinc-400"> — </span>
                          <span class="text-zinc-600 dark:text-zinc-300 break-all">{{ c.value }}</span>
                        </template>
                        <p v-if="c.error" class="mt-0.5 text-amber-600 dark:text-amber-400">{{ c.error }}</p>
                      </div>
                    </div>
                    <p v-if="diagnosticsResult.error" class="text-xs text-red-600 dark:text-red-400">
                      {{ diagnosticsResult.error }}
                    </p>
                  </div>
                </div>
              </section>
              <section class="space-y-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">关于</h3>
                <div class="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50 p-4 space-y-3">
                  <h4 class="text-base font-semibold text-zinc-800 dark:text-zinc-100">AI COS 工作台</h4>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    基于对话流的智能协作工作台，支持物料、订单、BOM 等业务查询与操作，并与 Dify 等 AI 能力打通。
                  </p>
                  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt class="text-zinc-500 dark:text-zinc-400">版本</dt>
                    <dd class="text-zinc-700 dark:text-zinc-300">1.0.0</dd>
                    <dt class="text-zinc-500 dark:text-zinc-400">环境</dt>
                    <dd class="text-zinc-700 dark:text-zinc-300">开发 / 测试</dd>
                  </dl>
                  <p class="text-xs text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-200 dark:border-zinc-600">
                    更多说明与更新日志请参见项目文档。
                  </p>
                </div>
              </section>
            </div>
          </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ThemeMode } from '~/composables/useTheme'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/components/ui/select'
import { Checkbox } from '~/components/ui/checkbox'
import { Bot, Stethoscope, Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const apiBase = useApiBase()

const diagnosticsLoading = ref(false)
const diagnosticsResult = ref<{
  ok: boolean
  checks: Array<{ id: string; name: string; ok: boolean; value?: string; error?: string }>
  error?: string
} | null>(null)

async function runDiagnostics() {
  diagnosticsLoading.value = true
  diagnosticsResult.value = null
  try {
    const res = await fetch(`${apiBase}/api/diagnostics`, { credentials: 'include' })
    if (res.status === 401) {
      useAuth().requireAuth()
      diagnosticsResult.value = { ok: false, checks: [], error: '请先登录' }
      return
    }
    const data = await res.json().catch(() => ({}))
    diagnosticsResult.value = data
  } catch (e) {
    diagnosticsResult.value = {
      ok: false,
      checks: [],
      error: e instanceof Error ? e.message : String(e),
    }
  } finally {
    diagnosticsLoading.value = false
  }
}
const { currentView, activeTab, addTab } = useAppView()
const { list: appExtensionsList, get: getAppExtension } = useAppExtensions()

/** 首页展示的扩展列表（需登录的未登录时隐藏） */
const homeAppList = computed(() =>
  appExtensionsList.value.filter((app) => !app.requireAuth || isAuthenticated.value)
)

function openApp(app: import('~/types/app-extensions').AppExtension) {
  if (app.requireAuth && !isAuthenticated.value) return
  addTab('app', app.id)
}

/** 当前标签为扩展应用时的扩展元数据 */
const currentAppExt = computed(() => {
  const tab = activeTab.value
  if (!tab || tab.view !== 'app' || !tab.appId) return null
  return getAppExtension(tab.appId) ?? null
})

const { contacts, bots } = useContactsAndBots()
const { themeMode, setTheme } = useTheme()
const { ensureChat } = useChatSessions()
const {
  loginWithPassword,
  loginWithToken,
  loginWithLogto,
  logout,
  isAuthenticated,
  user,
} = useAuth()
const route = useRoute()
const logtoQueryError = computed(() => (route.query?.auth_error ? decodeURIComponent(String(route.query.auth_error)) : ''))

const notificationsEnabled = ref(true)

// 认证登录面板状态
type AuthMode = 'password' | 'token' | 'logto'
const authMode = ref<AuthMode>('password')
const authUsername = ref('')
const authPassword = ref('')
const authToken = ref('')
const authError = ref('')
const authSubmitting = ref(false)

function clearAuthError() {
  authError.value = ''
}

async function submitPasswordAuth() {
  clearAuthError()
  authSubmitting.value = true
  try {
    const result = await loginWithPassword(authUsername.value, authPassword.value)
    if (result.ok) authPassword.value = ''
    else authError.value = result.error || '登录失败'
  } finally {
    authSubmitting.value = false
  }
}

async function submitTokenAuth() {
  clearAuthError()
  authSubmitting.value = true
  try {
    const result = await loginWithToken(authToken.value)
    if (result.ok) authToken.value = ''
    else authError.value = result.error || 'Token 无效'
  } finally {
    authSubmitting.value = false
  }
}

function submitLogtoAuth() {
  clearAuthError()
  loginWithLogto()
}

function openChat(type: 'contact' | 'bot', id: string, name: string) {
  const chatId = type === 'contact' ? `contact-${id}` : `bot-${id}`
  ensureChat(chatId, name)
  router.push(`/space/${chatId}`)
}

</script>

<style scoped>
/* 应用内容区：最细滚动条（与侧栏一致） */
.app-panel-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 216) transparent;
}
.dark .app-panel-scroll {
  scrollbar-color: rgb(82 82 91) transparent;
}
.app-panel-scroll::-webkit-scrollbar {
  width: 5px;
}
.app-panel-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.app-panel-scroll::-webkit-scrollbar-thumb {
  background-color: rgb(212 212 216);
  border-radius: 9999px;
}
.dark .app-panel-scroll::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
}
.app-panel-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgb(161 161 170);
}
.dark .app-panel-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgb(113 113 122);
}
.app-panel-scroll::-webkit-scrollbar-button {
  display: none;
}
</style>
