import { ref, computed, onMounted } from 'vue'

const STORAGE_KEY = 'app-ui-font-size'

/** 界面字体大小档位：0=最小, 4=最大，步进 1（仅作用于会话区） */
const FONT_STEP_MIN = 0
const FONT_STEP_MAX = 4
const FONT_STEP_DEFAULT = 2

const scaleMap: Record<number, number> = {
  0: 0.875,
  1: 1,
  2: 1.125,
  3: 1.25,
  4: 1.375,
}

function getStoredStep(): number {
  if (typeof window === 'undefined') return FONT_STEP_DEFAULT
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    const n = v != null ? parseInt(v, 10) : NaN
    if (!Number.isNaN(n) && n >= FONT_STEP_MIN && n <= FONT_STEP_MAX) return n
  } catch {}
  return FONT_STEP_DEFAULT
}

const uiFontSizeStep = ref(getStoredStep())

/** 会话区字体缩放倍数（仅用于会话区容器 font-size） */
const sessionAreaFontScale = computed(() => scaleMap[uiFontSizeStep.value] ?? 1)

export function useUISettings() {
  function setUIFontSizeStep(step: number) {
    const clamped = Math.max(FONT_STEP_MIN, Math.min(FONT_STEP_MAX, Math.round(step)))
    uiFontSizeStep.value = clamped
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped))
    } catch {}
  }

  onMounted(() => {
    uiFontSizeStep.value = getStoredStep()
  })

  return {
    /** 当前字体档位 0–4 */
    uiFontSizeStep,
    /** 会话区字体缩放倍数，用于会话区容器 style.fontSize */
    sessionAreaFontScale,
    setUIFontSizeStep,
    FONT_STEP_MIN,
    FONT_STEP_MAX,
  }
}
