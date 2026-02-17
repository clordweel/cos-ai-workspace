/**
 * 界面设置：字体档位等（仅存本地 localStorage，与 frontend useUserPreferences 档位一致）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'app-ui-font-size';

export const FONT_STEP_MIN = 1;
export const FONT_STEP_MAX = 5;
export const FONT_STEP_DEFAULT = 3;

const scaleMap: Record<number, number> = {
  1: 10 / 16,
  2: 12 / 16,
  3: 14 / 16,
  4: 1,
  5: 18 / 16,
};

function getStoredFontStep(): number {
  if (typeof window === 'undefined') return FONT_STEP_DEFAULT;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    const n = v != null ? parseInt(v, 10) : NaN;
    if (!Number.isNaN(n) && n >= FONT_STEP_MIN && n <= FONT_STEP_MAX) return Math.round(n);
  } catch {}
  return FONT_STEP_DEFAULT;
}

export function useUISettings() {
  const [uiFontSizeStep, setUiFontSizeStepState] = useState(FONT_STEP_DEFAULT);

  useEffect(() => {
    setUiFontSizeStepState(getStoredFontStep());
  }, []);

  const setUIFontSizeStep = useCallback((step: number) => {
    const clamped = Math.max(FONT_STEP_MIN, Math.min(FONT_STEP_MAX, Math.round(step)));
    setUiFontSizeStepState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {}
  }, []);

  const sessionAreaFontScale = useMemo(
    () => scaleMap[uiFontSizeStep] ?? 14 / 16,
    [uiFontSizeStep]
  );

  return {
    uiFontSizeStep,
    sessionAreaFontScale,
    setUIFontSizeStep,
    FONT_STEP_MIN,
    FONT_STEP_MAX,
  };
}
