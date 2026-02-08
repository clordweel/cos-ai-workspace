<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    :class="$attrs.class"
  >
    <!-- 按参考图：机头在左指右上，上翼略长、下翼略短，右侧 V 形缺口，实心填充 -->
    <path
      d="M4 10 L20 5 L15 12 L18 17 Z"
    />
  </svg>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
