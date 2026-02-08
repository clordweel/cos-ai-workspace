<template>
  <span
    class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-zinc-600 dark:text-zinc-300"
    :class="containerClass"
  >
    <!-- 一对一：单个头像或首字 -->
    <template v-if="type === 'private'">
      <img
        v-if="firstParticipant?.avatar"
        :src="firstParticipant.avatar"
        :alt="firstParticipant.name"
        class="h-full w-full object-cover"
      />
      <span v-else class="text-xs font-medium">
        {{ firstChar }}
      </span>
    </template>
    <!-- 一对多：四宫格，按排序前四个 -->
    <template v-else-if="type === 'group'">
      <span class="grid h-full w-full grid-cols-2 grid-rows-2 gap-px rounded-lg overflow-hidden bg-zinc-300 dark:bg-zinc-600">
        <span
          v-for="(p, i) in gridSlots"
          :key="i"
          class="flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 text-[10px] font-medium"
        >
          <template v-if="p">
            <img
              v-if="p.avatar"
              :src="p.avatar"
              :alt="p.name"
              class="h-full w-full object-cover"
            />
            <span v-else>{{ (p.name || '').trim().charAt(0) || '?' }}</span>
          </template>
        </span>
      </span>
    </template>
  </span>
</template>

<script setup lang="ts">
export type SessionParticipant = { name: string; avatar?: string }

const props = withDefaults(
  defineProps<{
    type: 'private' | 'group'
    participants?: SessionParticipant[]
  }>(),
  { participants: () => [] },
)

const firstParticipant = computed(() => props.participants?.[0])
const firstChar = computed(() => {
  const name = firstParticipant.value?.name ?? ''
  return (name.trim().charAt(0) || '?').toUpperCase()
})

/** 一对多时按排序取前 4 个，不足 4 个的格子留空 */
const gridSlots = computed(() => {
  const list = (props.participants ?? []).slice(0, 4)
  const slots: (SessionParticipant | null)[] = [...list]
  while (slots.length < 4) slots.push(null)
  return slots
})

const containerClass = computed(() =>
  props.type === 'group'
    ? 'bg-transparent p-0'
    : 'bg-zinc-200 dark:bg-zinc-600',
)
</script>
