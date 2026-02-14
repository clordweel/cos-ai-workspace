<template>
  <span
    class="logo-wrap inline-block"
    :class="{
      'logo-animated': animated && !loading,
      'logo-loading': loading,
    }"
  >
    <svg
      :viewBox="viewBox"
      xmlns="http://www.w3.org/2000/svg"
      :width="size"
      :height="size"
      :class="[$attrs.class]"
      fill="none"
      aria-hidden="true"
    >
      <g class="logo-group">
        <path
          id="curve"
          class="logo-path logo-path--curve"
          fill-rule="evenodd"
          :fill="color"
          :stroke="color"
          pathLength="1"
          d="M50.7529 53.8421C53.8795 56.1579 58.5693 54.6141 54.2703 50.3684C41.3734 38.0175 44.109 0 28.0857 0C12.0622 0 14.7979 38.0175 1.901 50.3684C-2.78877 55 2.2918 56.1579 5.41834 53.8421C17.5337 45.7368 16.752 24.5088 28.0857 24.5088C39.4193 24.5088 38.6377 45.7368 50.7529 53.8421Z"
          transform="matrix(-1,0,0,-1,78,80)"
        />
        <path
          id="line"
          class="logo-path logo-path--line"
          fill-rule="evenodd"
          :fill="color"
          :stroke="color"
          pathLength="1"
          d="M68.2452 54C68.5851 52.6725 68.9253 51.3363 69.2706 50L90 50C91.1046 50 92 50.8954 92 52C92 53.1046 91.1046 54 90 54L68.2452 54ZM30.5215 50C30.8667 51.3363 31.2069 52.6725 31.5468 54L10 54C8.89543 54 8 53.1046 8 52C8 50.8954 8.89543 50 10 50L30.5215 50ZM49.9235 53.1649C52.4965 53.1649 54.3701 51.9422 55.9115 50L43.9356 50C45.477 51.9422 47.3506 53.1649 49.9235 53.1649Z"
        />
      </g>
    </svg>
  </span>
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
    /** 是否开放入场动画（错落显现 + 轻微缩放），与 loading 互斥 */
    animated?: boolean
    /** 是否作为 loading 显示：启用类似 Nuxt 的循环呼吸动画 */
    loading?: boolean
  }>(),
  {
    color: 'currentColor',
    size: 32,
    viewBox: '0 0 100 100',
    animated: true,
    loading: false,
  }
)
</script>

<style scoped>
.logo-wrap {
  display: inline-block;
  transform-origin: center center;
  margin-top: -1px;
  margin-right: -5px;
}

/* 根因：inline SVG 参与基线对齐，浏览器会在下方预留 descender 空间，导致在 flex 中无法真正垂直居中。设为 block 后不再参与基线，行高等于 SVG 高度，居中即正确。 */
.logo-wrap svg {
  display: block;
}

/* 入场/循环：细描边路径绘制，无限循环；动画结束阶段描边淡出仅留填充 */
.logo-animated .logo-group {
  transform-origin: 50% 50%;
}

.logo-animated .logo-path {
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1; /* 与 keyframes 0% 一致，避免首帧前出现“整条描边”定格 */
  fill-opacity: 0;
}

.logo-animated .logo-path--curve {
  animation: logo-path-draw-curve 3.2s ease-in-out infinite;
}

.logo-animated .logo-path--line {
  animation: logo-path-draw-line 3.2s ease-in-out 0.45s infinite;
}

/* Loading：类似 Nuxt 的循环呼吸动画，平滑无限循环 */
.logo-loading .logo-group {
  transform-origin: 50% 50%;
  animation: logo-pulse 1.4s ease-in-out infinite;
}

.logo-loading .logo-path--curve,
.logo-loading .logo-path--line {
  opacity: 1;
  stroke: none;
  fill-opacity: 1;
  stroke-dashoffset: 0;
}

/* 曲线：绘制 → 填充 → 较长保持 → 缓慢反向描边与淡出，与 0% 柔和衔接 */
@keyframes logo-path-draw-curve {
  0%, 100% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  22% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  35% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  45% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  55% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 1;
  }
  65% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 1;
  }
  75% {
    stroke-dashoffset: 0.5;
    fill-opacity: 0.85;
    stroke-opacity: 1;
  }
  85% {
    stroke-dashoffset: 1;
    fill-opacity: 0.35;
    stroke-opacity: 1;
  }
  94% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
}

/* 横线：同周期错峰，中间停留更久，消失阶段更缓 */
@keyframes logo-path-draw-line {
  0%, 100% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  26% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  39% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  49% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  59% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 1;
  }
  69% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 1;
  }
  79% {
    stroke-dashoffset: 0.5;
    fill-opacity: 0.85;
    stroke-opacity: 1;
  }
  89% {
    stroke-dashoffset: 1;
    fill-opacity: 0.35;
    stroke-opacity: 1;
  }
  98% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
}

@keyframes logo-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.72;
    transform: scale(0.96);
  }
}
</style>
