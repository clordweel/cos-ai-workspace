<template>
  <svg
    :viewBox="viewBox"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    :class="[$attrs.class]"
    fill="none"
    aria-hidden="true"
  >
    <g>
      <path
        id="curve"
        fill-rule="evenodd"
        :fill="color"
        d="M50.7529 53.8421C53.8795 56.1579 58.5693 54.6141 54.2703 50.3684C41.3734 38.0175 44.109 0 28.0857 0C12.0622 0 14.7979 38.0175 1.901 50.3684C-2.78877 55 2.2918 56.1579 5.41834 53.8421C17.5337 45.7368 16.752 24.5088 28.0857 24.5088C39.4193 24.5088 38.6377 45.7368 50.7529 53.8421Z"
        transform="matrix(-1,0,0,-1,78,80)"
      />
      <path
        id="line"
        fill-rule="evenodd"
        :fill="color"
        d="M68.2452 54C68.5851 52.6725 68.9253 51.3363 69.2706 50L90 50C91.1046 50 92 50.8954 92 52C92 53.1046 91.1046 54 90 54L68.2452 54ZM30.5215 50C30.8667 51.3363 31.2069 52.6725 31.5468 54L10 54C8.89543 54 8 53.1046 8 52C8 50.8954 8.89543 50 10 50L30.5215 50ZM49.9235 53.1649C52.4965 53.1649 54.3701 51.9422 55.9115 50L43.9356 50C45.477 51.9422 47.3506 53.1649 49.9235 53.1649Z"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 图形填充色，支持 CSS 颜色值或 currentColor */
    color?: string
    /** 尺寸，数字为 px，字符串如 '2rem' 亦可 */
    size?: number | string
    /** SVG viewBox，一般无需改 */
    viewBox?: string
  }>(),
  {
    color: 'currentColor',
    size: 32,
    viewBox: '0 0 100 100',
  }
)
</script>
