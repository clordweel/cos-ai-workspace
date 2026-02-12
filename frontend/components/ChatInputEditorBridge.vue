<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { watch } from 'vue'

const props = defineProps<{ editor: Editor | undefined | null }>()
const emit = defineEmits<{ (e: 'register', editor: Editor | undefined | null): void }>()

watch(
  () => props.editor,
  (e) => emit('register', e ?? null),
  { immediate: true }
)
</script>

<template>
  <!-- 仅用于在 slot 内同步 editor 到父组件，不渲染可见内容 -->
  <span v-if="editor" class="sr-only" aria-hidden="true" />
</template>
