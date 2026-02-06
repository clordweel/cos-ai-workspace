<template>
  <div class="h-full flex flex-col overflow-hidden bg-white dark:bg-zinc-800 rounded-[inherit]">
    <div class="flex-1 overflow-y-auto p-3 min-h-0">
          <template v-if="currentView === 'home'">
            <div class="grid gap-2 sm:grid-cols-2">
              <div
                v-for="app in placeholderApps"
                :key="app.id"
                class="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-700/50 p-3 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-600/50 transition-colors cursor-pointer"
                @click="app.action"
              >
                <div class="flex items-center gap-2.5">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                    <component :is="app.icon" class="h-4 w-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ app.title }}</p>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">{{ app.desc }}</p>
                  </div>
                </div>
              </div>
            </div>
            <p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              更多扩展应用将在此展示，支持物料、订单、BOM 等操作
            </p>
          </template>
          <template v-else-if="currentView === 'contacts'">
            <ul class="divide-y divide-zinc-100 dark:divide-zinc-700">
              <li
                v-for="c in contacts"
                :key="c.id"
                class="flex items-center gap-2.5 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-md transition-colors -mx-0.5 px-0.5"
                @click="openChat('contact', c.id, c.name)"
              >
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-medium">
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
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                  <Bot class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">{{ b.name }}</p>
                  <p v-if="b.description" class="text-xs text-zinc-500 dark:text-zinc-400 truncate">{{ b.description }}</p>
                </div>
              </li>
            </ul>
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
                  <label class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                    <span class="text-sm text-zinc-800 dark:text-zinc-200">通知</span>
                    <input type="checkbox" class="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" checked />
                  </label>
                </div>
              </section>
              <section>
                <h3 class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">关于</h3>
                <p class="text-sm text-zinc-500 dark:text-zinc-400">AI COS 工作台</p>
              </section>
            </div>
          </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ThemeMode } from '~/composables/useTheme'
import Select from '~/components/ui/select/Select.vue'
import SelectTrigger from '~/components/ui/select/SelectTrigger.vue'
import SelectValue from '~/components/ui/select/SelectValue.vue'
import SelectContent from '~/components/ui/select/SelectContent.vue'
import SelectItem from '~/components/ui/select/SelectItem.vue'
import { Bot, Package, ClipboardList, Layers, PackageOpen } from 'lucide-vue-next'

const router = useRouter()
const { currentView } = useAppView()
const { contacts, bots } = useContactsAndBots()
const { themeMode, setTheme } = useTheme()
const { ensureChat } = useChatSessions()

function openChat(type: 'contact' | 'bot', id: string, name: string) {
  const chatId = type === 'contact' ? `contact-${id}` : `bot-${id}`
  ensureChat(chatId, name)
  router.push(`/space/${chatId}`)
}

const placeholderApps = [
  { id: 'material', title: '物料助手', desc: '参数化创建球磨机零件', icon: Package, action: () => {} },
  { id: 'order', title: '订单进度', desc: '查询生产与交货状态', icon: ClipboardList, action: () => {} },
  { id: 'bom', title: 'BOM 状态', desc: '查看物料清单与齐套', icon: Layers, action: () => {} },
  { id: 'inventory', title: '库存概览', desc: '球磨机零件库存', icon: PackageOpen, action: () => {} },
]
</script>
