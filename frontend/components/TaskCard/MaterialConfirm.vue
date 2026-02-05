<template>
  <div class="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4">
    <h4 class="text-sm font-medium text-amber-200 mb-2">待确认物料</h4>
    <p class="text-zinc-400 text-sm mb-3">{{ itemName || '—' }}</p>
    <button
      type="button"
      class="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
      :disabled="loading"
      @click="confirm"
    >
      {{ loading ? '提交中…' : '确认创建' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ draftId: string; itemName?: string }>()
const emit = defineEmits<{ (e: 'confirmed'): void }>()
const loading = ref(false)
const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

async function confirm() {
  if (loading.value || !props.draftId) return
  loading.value = true
  try {
    const res = await fetch(`${apiBase}/api/material/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: props.draftId, confirmed_by: 'current-user' }),
    })
    if (res.ok) emit('confirmed')
  } finally {
    loading.value = false
  }
}
</script>
