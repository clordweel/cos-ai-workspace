<template>
  <span
    class="icon-cos-wrap inline-block"
    :class="[
      { 'icon-cos-animated': animated },
      { 'icon-cos-once': animated && !loop },
    ]"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="viewBox"
      :width="svgWidth"
      :height="svgHeight"
      fill="none"
      aria-hidden="true"
      :class="$attrs.class"
    >
      <g class="icon-cos-group">
        <path
          id="curve"
          class="icon-cos-path icon-cos-path--curve"
          fill-rule="evenodd"
          :fill="color"
          :stroke="color"
          pathLength="1"
          d="M50.7529 53.8421C53.8795 56.1579 58.5693 54.6141 54.2703 50.3684C41.3734 38.0175 44.109 0 28.0857 0C12.0622 0 14.7979 38.0175 1.901 50.3684C-2.78877 55 2.2918 56.1579 5.41834 53.8421C17.5337 45.7368 16.752 24.5088 28.0857 24.5088C39.4193 24.5088 38.6377 45.7368 50.7529 53.8421Z"
          transform="matrix(-1,0,0,-1,70,55)"
        />
        <path
          id="line"
          class="icon-cos-path icon-cos-path--line"
          fill-rule="evenodd"
          :fill="color"
          :stroke="color"
          pathLength="1"
          d="M60.2452 29C60.5851 27.6725 60.9253 26.3363 61.2706 25L82 25C83.1046 25 84 25.8954 84 27C84 28.1046 83.1046 29 82 29L60.2452 29ZM22.5215 25C22.8667 26.3363 23.2069 27.6725 23.5468 29L2 29C0.895432 29 0 28.1046 0 27C0 25.8954 0.895432 25 2 25L22.5215 25ZM41.9235 28.1649C44.4965 28.1649 46.3701 26.9422 47.9115 25L35.9356 25C37.477 26.9422 39.3506 28.1649 41.9235 28.1649Z"
        />
      </g>
    </svg>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** 图形填充/描边色 */
    color?: string
    /** 尺寸，数字为 px，字符串如 '2rem' 亦可；未指定 width/height 时同时作为宽高 */
    size?: number | string
    /** 可选：单独指定宽度（字标等场景） */
    width?: number | string
    /** 可选：单独指定高度 */
    height?: number | string
    viewBox?: string
    /** 是否启用路径绘制动画 */
    animated?: boolean
    /** 动画是否循环；false 时只播放一次（如 loading 屏） */
    loop?: boolean
  }>(),
  {
    color: 'currentColor',
    size: 84,
    viewBox: '0 0 84 55',
    animated: false,
    loop: true,
  }
)
const svgWidth = computed(() => props.width ?? props.size)
const svgHeight = computed(() => props.height ?? props.size)
defineOptions({ inheritAttrs: false })
</script>

<style scoped>
.icon-cos-wrap {
  display: inline-block;
}
.icon-cos-wrap svg {
  display: block;
  vertical-align: middle;
}

.icon-cos-animated .icon-cos-path {
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  fill-opacity: 0;
}

.icon-cos-animated .icon-cos-path--curve {
  animation: icon-cos-draw-curve 2.4s ease-in-out infinite;
}

.icon-cos-animated .icon-cos-path--line {
  animation: icon-cos-draw-line 2.4s ease-in-out 0.35s infinite;
}

/* 只播一次：描边绘制 → 填充显现，结束停在完整图形（填充可见） */
.icon-cos-once .icon-cos-path--curve {
  animation: icon-cos-draw-curve-once 2.4s ease-in-out 0s 1 forwards;
}
.icon-cos-once .icon-cos-path--line {
  animation: icon-cos-draw-line-once 2.4s ease-in-out 0.35s 1 forwards;
}

@keyframes icon-cos-draw-curve {
  0%,
  100% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  25% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  40% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  60% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  75% {
    stroke-dashoffset: 0.5;
    fill-opacity: 0.9;
    stroke-opacity: 1;
  }
  90% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
}

@keyframes icon-cos-draw-line {
  0%,
  100% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  28% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  42% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  62% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
  78% {
    stroke-dashoffset: 0.5;
    fill-opacity: 0.9;
    stroke-opacity: 1;
  }
  95% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
}

/* 只播一次用：结束帧为完整填充，保持可见 */
@keyframes icon-cos-draw-curve-once {
  0% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  25% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  40%, 100% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
}

@keyframes icon-cos-draw-line-once {
  0% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  28% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-opacity: 1;
  }
  42%, 100% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-opacity: 0;
  }
}
</style>
