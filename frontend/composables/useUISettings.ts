import { ref, computed, onMounted } from 'vue'

const STORAGE_KEY = 'app-ui-font-size'

/** 界面字体大小档位：1=最小(约10px), 5=最大，步进 1（仅作用于聊天对话与输入框文字） */
const FONT_STEP_MIN = 1
const FONT_STEP_MAX = 5
const FONT_STEP_DEFAULT = 3

/** 档位 → 相对 16px 的倍数，1≈10px 2≈12px 3≈14px 4=16px 5≈18px */
const scaleMap: Record<number, number> = {
  1: 10 / 16,
  2: 12 / 16,
  3: 14 / 16,
  4: 1,
  5: 18 / 16,
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

/** 聊天/输入框字体缩放倍数（相对 1rem） */
const sessionAreaFontScale = computed(() => scaleMap[uiFontSizeStep.value] ?? 14 / 16)

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
    /** 当前字体档位 1–5 */
    uiFontSizeStep,
    /** 会话区字体缩放倍数，用于会话区容器 style.fontSize */
    sessionAreaFontScale,
    setUIFontSizeStep,
    FONT_STEP_MIN,
    FONT_STEP_MAX,
  }
}
