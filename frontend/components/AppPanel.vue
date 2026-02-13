<template>
  <div class="h-full min-w-[480px] flex flex-col overflow-hidden bg-white dark:bg-zinc-800 rounded-[inherit]">
    <div class="app-panel-scroll flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 min-w-0 flex flex-col items-stretch">
      <div class="app-panel-content w-full min-w-0 max-w-2xl mx-auto">
          <template v-if="currentView === 'home'">
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="app in homeAppList"
                :key="app.id"
                role="button"
                tabindex="0"
                class="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-700/50 p-4 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-600/50 hover:shadow-sm transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 flex items-start justify-between gap-2"
                @click="openApp(app)"
                @keydown.enter.prevent="openApp(app)"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 dark:bg-primary-900/50 text-black dark:text-white">
                    <component :is="app.icon" class="h-4 w-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ app.name }}</p>
                    <p v-if="app.description" class="text-xs text-zinc-600 dark:text-zinc-400 truncate">{{ app.description }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  class="shrink-0 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-600/80 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                  :title="isFavorite(app.id) ? '从抽屉移除' : '加入抽屉'"
                  aria-label="收藏到抽屉"
                  @click.stop="toggleFavorite(app.id)"
                >
                  <Star v-if="isFavorite(app.id)" class="h-4 w-4 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                  <Star v-else class="h-4 w-4" />
                </button>
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
          <template v-else-if="currentView === 'profile'">
            <div class="profile-panel space-y-6">
              <section>
                <h3 class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">个人信息</h3>
                <div
                  v-if="isAuthenticated"
                  class="space-y-6"
                >
                  <!-- 用户信息卡：现代化设计 -->
                  <div
                    class="profile-hero relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-50 via-white to-zinc-100/80 dark:from-zinc-800/90 dark:via-zinc-800 dark:to-zinc-900/80 p-6 shadow-sm ring-1 ring-zinc-200/60 dark:ring-zinc-600/40"
                  >
                    <div class="flex items-center gap-5">
                      <div
                        class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-600 dark:to-zinc-700 text-zinc-600 dark:text-zinc-200 text-3xl font-semibold shadow-inner"
                      >
                        <img
                          v-if="authUserAvatar"
                          :src="authUserAvatar"
                          alt=""
                          class="h-full w-full object-cover"
                        >
                        <span v-else class="select-none">{{ authProfileInitial }}</span>
                        <div
                          class="absolute inset-0 rounded-2xl ring-1 ring-white/40 dark:ring-white/10 pointer-events-none"
                          aria-hidden
                        />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                          {{ authProfileName || '未设置姓名' }}
                        </p>
                        <p
                          v-if="authProfileEmail"
                          class="text-sm text-zinc-600 dark:text-zinc-400 truncate mt-0.5"
                        >
                          {{ authProfileEmail }}
                        </p>
                        <p
                          v-if="authProfilePhone"
                          class="text-sm text-zinc-600 dark:text-zinc-400 truncate mt-0.5"
                        >
                          {{ authProfilePhone }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 联系信息：邮箱、手机号（可编辑） -->
                  <div class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800/80 p-5">
                    <h4 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">联系信息</h4>
                    <form class="space-y-4" @submit.prevent="submitProfileUpdate">
                      <div class="grid w-full gap-1.5">
                        <label for="profile-email" class="text-xs font-medium text-zinc-500 dark:text-zinc-400">邮箱</label>
                        <Input
                          id="profile-email"
                          v-model="profileEditEmail"
                          type="email"
                          placeholder="name@example.com"
                          autocomplete="email"
                          class="w-full"
                        />
                      </div>
                      <div class="grid w-full gap-1.5">
                        <label for="profile-phone" class="text-xs font-medium text-zinc-500 dark:text-zinc-400">手机号</label>
                        <Input
                          id="profile-phone"
                          v-model="profileEditPhone"
                          type="tel"
                          placeholder="+86 138 0013 8000"
                          autocomplete="tel"
                          class="w-full"
                        />
                        <p class="text-[11px] text-zinc-400 dark:text-zinc-500">支持 +86 等区号，输入数字或带空格的格式均可</p>
                      </div>
                      <p v-if="profileEditError" class="text-xs text-red-600 dark:text-red-400">{{ profileEditError }}</p>
                      <p v-if="profileEditSuccess" class="text-xs text-emerald-600 dark:text-emerald-500">已保存</p>
                      <Button
                        type="submit"
                        variant="default"
                        size="default"
                        :disabled="profileEditLoading"
                      >
                        {{ profileEditLoading ? '保存中…' : '保存' }}
                      </Button>
                    </form>
                  </div>

                  <!-- 账号与安全 -->
                  <div class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800/80 p-5">
                    <h4 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">账号与安全</h4>
                    <div class="space-y-5">
                      <div class="flex flex-wrap items-center gap-2">
                        <a
                          href="/logto?refresh=1"
                          class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          重新授权以更新资料
                        </a>
                        <span class="text-zinc-300 dark:text-zinc-600">|</span>
                        <button
                          type="button"
                          class="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                          @click="logout"
                        >
                          退出登录
                        </button>
                      </div>

                      <div class="border-t border-zinc-200 dark:border-zinc-600 pt-4">
                        <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">修改 Logto 密码</p>
                        <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">无需当前密码，填写新密码即可。</p>
                        <form class="space-y-2" @submit.prevent="submitLogtoChangePassword">
                          <Input
                            v-model="logtoPasswordNew"
                            type="password"
                            placeholder="新密码"
                            autocomplete="new-password"
                            class="w-full"
                          />
                          <Input
                            v-model="logtoPasswordConfirm"
                            type="password"
                            placeholder="确认新密码"
                            autocomplete="new-password"
                            class="w-full"
                          />
                          <p v-if="logtoPasswordError" class="text-xs text-red-600 dark:text-red-400">{{ logtoPasswordError }}</p>
                          <p v-if="logtoPasswordSuccess" class="text-xs text-emerald-600 dark:text-emerald-500">Logto 密码已修改</p>
                          <Button
                            type="submit"
                            variant="default"
                            size="sm"
                            :disabled="logtoPasswordLoading"
                          >
                            {{ logtoPasswordLoading ? '提交中…' : '修改' }}
                          </Button>
                        </form>
                      </div>

                      <div class="border-t border-zinc-200 dark:border-zinc-600 pt-4">
                        <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">设置 Matrix 密码</p>
                        <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">用于 Element 等 Matrix 客户端登录同一账号。</p>
                        <form class="space-y-2" @submit.prevent="submitMatrixSetPassword">
                          <Input
                            v-model="matrixSetPasswordNew"
                            type="password"
                            placeholder="新密码（至少 8 位）"
                            autocomplete="new-password"
                            class="w-full"
                          />
                          <Input
                            v-model="matrixSetPasswordConfirm"
                            type="password"
                            placeholder="确认新密码"
                            autocomplete="new-password"
                            class="w-full"
                          />
                          <p v-if="matrixSetPasswordError" class="text-xs text-red-600 dark:text-red-400">{{ matrixSetPasswordError }}</p>
                          <p v-if="matrixSetPasswordSuccess" class="text-xs text-emerald-600 dark:text-emerald-500">已设置，可用于 Element 登录</p>
                          <Button
                            type="submit"
                            variant="default"
                            size="sm"
                            :disabled="matrixSetPasswordLoading"
                          >
                            {{ matrixSetPasswordLoading ? '提交中…' : '设置' }}
                          </Button>
                        </form>
                        <div class="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                          <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">Synapse Admin 中的删除实为禁用，此处可彻底注销 Matrix 账号</p>
                          <button
                            type="button"
                            class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                            :disabled="matrixDeactivateLoading"
                            @click="confirmMatrixDeactivate"
                          >
                            {{ matrixDeactivateLoading ? '注销中…' : '彻底注销 Matrix 账号' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- 未登录：骨架占位 + 去认证登录 -->
                <div
                  v-else
                  class="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800/80 p-5"
                >
                  <div class="flex items-center gap-4 mb-6">
                    <div class="h-16 w-16 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-600 animate-pulse" aria-hidden />
                    <div class="flex-1 space-y-2">
                      <div class="h-5 w-36 rounded bg-zinc-200 dark:bg-zinc-600 animate-pulse" />
                      <div class="h-3 w-48 rounded bg-zinc-200/80 dark:bg-zinc-600/80 animate-pulse" />
                    </div>
                  </div>
                  <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-4">登录后查看与编辑个人信息</p>
                  <button
                    type="button"
                    class="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 px-3"
                    @click="goToAuth"
                  >
                    去认证登录
                  </button>
                </div>
              </section>
            </div>
          </template>
          <template v-else-if="currentView === 'auth'">
            <div class="auth-panel space-y-4">
              <div v-if="isAuthenticated" class="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 p-4">
                <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200">已登录</p>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{{ authUserDisplay }}</p>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href="/logto?refresh=1"
                    class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    重新授权以更新姓名与邮箱
                  </a>
                  <button
                    type="button"
                    class="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    @click="logout"
                  >
                    退出登录
                  </button>
                </div>
              </div>
              <template v-else>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
                  使用单点登录进入工作空间，认证由中间层与 Logto 保持。
                </p>
                <p v-if="logtoQueryError" class="text-xs text-red-600 dark:text-red-400 text-center">{{ logtoQueryError }}</p>
                <button
                  type="button"
                  class="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 px-3"
                  @click="login"
                >
                  Logto 登录
                </button>
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
                    <Select v-model="themeMode">
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
                    <Checkbox id="settings-notify" :checked="notificationsEnabled" @update:checked="setNotificationsEnabled($event)" />
                  </label>
                </div>
              </section>
              <section class="space-y-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">关于</h3>
                <div class="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50 p-4 space-y-3">
                  <h4 class="text-base font-semibold text-zinc-800 dark:text-zinc-100">COS&AI 工作空间</h4>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    基于对话流的智能协作工作空间，支持物料、订单、BOM 等业务查询与操作，并与 Dify 等 AI 能力打通。
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
import { Input } from '~/components/ui/input'
import { Bot, Star } from 'lucide-vue-next'

const router = useRouter()
const apiBase = useApiBase()
const config = useRuntimeConfig()

const { currentView, activeTab, addTab, openAuthTab } = useAppView()
const { list: appExtensionsList, get: getAppExtension } = useAppExtensions()
const { isFavorite, toggle: toggleFavorite } = useAppFavorites()

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
const { login, logout, isAuthenticated, user, userId } = useAuth()
const authUserDisplay = computed(() => {
  const u = user.value
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && 'name' in u) {
    const name = (u as { name?: string; email?: string }).name ?? ''
    const email = (u as { email?: string }).email
    return email ? `${name} · ${email}` : name
  }
  return ''
})
const authProfileName = computed(() => {
  const u = user.value
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && 'name' in u) return (u as { name?: string }).name ?? ''
  return ''
})
const authProfileEmail = computed(() => {
  const u = user.value
  if (u && typeof u === 'object' && 'email' in u) return (u as { email?: string }).email ?? ''
  return ''
})
const authProfilePhone = computed(() => {
  const u = user.value
  if (u && typeof u === 'object' && 'phone' in u) {
    const raw = (u as { phone?: string }).phone ?? ''
    return raw ? formatPhoneDisplay(raw) : ''
  }
  return ''
})
const authUserAvatar = computed(() => {
  const u = user.value
  if (u && typeof u === 'object' && 'avatar' in u) return (u as { avatar?: string }).avatar ?? ''
  return ''
})
const authProfileInitial = computed(() => {
  const name = authProfileName.value || authProfileEmail.value
  return name ? name.charAt(0).toUpperCase() : '?'
})
const route = useRoute()
const logtoQueryError = computed(() => (route.query?.auth_error ? decodeURIComponent(String(route.query.auth_error)) : ''))

const { notificationsEnabled, setNotificationsEnabled } = useUserPreferences()
const { fetchUser } = useAuth()
const { formatPhoneDisplay } = usePhoneFormat()

/** 编辑邮箱与手机号 */
const profileEditEmail = ref('')
const profileEditPhone = ref('')
const profileEditError = ref('')
const profileEditSuccess = ref(false)
const profileEditLoading = ref(false)
watch([user], () => {
  const u = user.value
  if (u && typeof u === 'object') {
    profileEditEmail.value = (u as { email?: string }).email ?? ''
    const rawPhone = (u as { phone?: string }).phone ?? ''
    profileEditPhone.value = rawPhone ? formatPhoneDisplay(rawPhone) : ''
  } else {
    profileEditEmail.value = ''
    profileEditPhone.value = ''
  }
}, { immediate: true })
async function submitProfileUpdate() {
  profileEditError.value = ''
  profileEditSuccess.value = false
  profileEditLoading.value = true
  try {
    const res = await fetch(`${apiBase}/api/auth/me/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: profileEditEmail.value.trim(),
        phone: profileEditPhone.value.trim(),
      }),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (res.ok && data.ok) {
      profileEditSuccess.value = true
      await fetchUser()
    } else {
      profileEditError.value = (data as { error?: string }).error || '保存失败'
    }
  } catch (e) {
    profileEditError.value = e instanceof Error ? e.message : '网络错误'
  } finally {
    profileEditLoading.value = false
  }
}

/** Matrix 设置密码（用于 Element 等客户端登录同一账号，无需当前密码） */
const matrixSetPasswordNew = ref('')
const matrixSetPasswordConfirm = ref('')
const matrixSetPasswordError = ref('')
const matrixSetPasswordSuccess = ref(false)
const matrixSetPasswordLoading = ref(false)
const matrixDeactivateLoading = ref(false)
async function submitMatrixSetPassword() {
  matrixSetPasswordError.value = ''
  matrixSetPasswordSuccess.value = false
  const newPwd = matrixSetPasswordNew.value
  const confirm = matrixSetPasswordConfirm.value
  if (!newPwd || newPwd.length < 8) {
    matrixSetPasswordError.value = '新密码至少 8 位'
    return
  }
  if (newPwd !== confirm) {
    matrixSetPasswordError.value = '两次输入不一致'
    return
  }
  matrixSetPasswordLoading.value = true
  try {
    const res = await fetch(`${apiBase}/api/auth/matrix/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ new_password: newPwd }),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (res.ok && data.ok) {
      matrixSetPasswordSuccess.value = true
      matrixSetPasswordNew.value = ''
      matrixSetPasswordConfirm.value = ''
    } else {
      matrixSetPasswordError.value = data.error || '设置失败'
    }
  } catch (e) {
    matrixSetPasswordError.value = e instanceof Error ? e.message : '网络错误'
  } finally {
    matrixSetPasswordLoading.value = false
  }
}
function confirmMatrixDeactivate() {
  if (!confirm('确定要彻底注销 Matrix 账号吗？此操作不可恢复，将删除账号及关联数据。')) return
  matrixDeactivateLoading.value = true
  fetch(`${apiBase}/api/auth/matrix/deactivate`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.json().catch(() => ({})) as { ok?: boolean; error?: string })
    .then((data) => {
      if (data.ok) {
        fetchUser()
      } else {
        alert(data.error || '注销失败')
      }
    })
    .catch(() => alert('网络错误'))
    .finally(() => { matrixDeactivateLoading.value = false })
}

/** 修改 Logto 密码（无需当前密码） */
const logtoPasswordNew = ref('')
const logtoPasswordConfirm = ref('')
const logtoPasswordError = ref('')
const logtoPasswordSuccess = ref(false)
const logtoPasswordLoading = ref(false)
async function submitLogtoChangePassword() {
  logtoPasswordError.value = ''
  logtoPasswordSuccess.value = false
  if (!logtoPasswordNew.value || logtoPasswordNew.value !== logtoPasswordConfirm.value) {
    logtoPasswordError.value = '请确认新密码与确认框一致'
    return
  }
  if (logtoPasswordNew.value.length < 8) {
    logtoPasswordError.value = '新密码至少 8 位'
    return
  }
  logtoPasswordLoading.value = true
  try {
    const res = await fetch(`${apiBase}/api/auth/logto/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ new_password: logtoPasswordNew.value }),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (res.ok && data.ok) {
      logtoPasswordSuccess.value = true
      logtoPasswordNew.value = ''
      logtoPasswordConfirm.value = ''
    } else {
      logtoPasswordError.value = data.error || '修改失败'
    }
  } catch (e) {
    logtoPasswordError.value = e instanceof Error ? e.message : '网络错误'
  } finally {
    logtoPasswordLoading.value = false
  }
}

function openChat(type: 'contact' | 'bot', id: string, name: string) {
  const chatId = type === 'contact' ? `contact-${id}` : `bot-${id}`
  ensureChat(chatId, name)
  router.push(`/space/${chatId}`)
}

/** 未登录时从个人信息页跳转到认证登录标签 */
function goToAuth() {
  openAuthTab()
}

</script>

<style scoped>
/* 应用内容区：极细滚动条 */
.app-panel-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 216) transparent;
}
.dark .app-panel-scroll {
  scrollbar-color: rgb(82 82 91) transparent;
}
.app-panel-scroll::-webkit-scrollbar {
  width: 2px;
}
.app-panel-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.app-panel-scroll::-webkit-scrollbar-thumb {
  background-color: rgb(212 212 216);
  border-radius: 2px;
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
