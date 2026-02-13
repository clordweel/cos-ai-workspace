<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 130 28"
    :width="width"
    :height="effectiveHeight ?? 28"
    fill="currentColor"
    class="inline-block shrink-0"
    aria-hidden="true"
    :class="$attrs.class"
  >
    <text
      x="65"
      y="20"
      text-anchor="middle"
      font-size="20"
      font-weight="700"
      letter-spacing="0.02em"
      font-family="system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    >
      COS&amp;AI
    </text>
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** 显示宽度（高度不传时按 viewBox 比例） */
    width?: number | string
    /** 显示高度，不传则按 viewBox 28/130 比例 */
    height?: number | string
  }>(),
  {
    width: 120,
    height: undefined,
  }
)

const effectiveHeight = computed(() => {
  if (props.height != null && props.height !== '') return props.height
  const w = typeof props.width === 'number' ? props.width : parseFloat(String(props.width)) || 120
  return (28 / 130) * w
})

defineOptions({
  inheritAttrs: false,
})
</script>
