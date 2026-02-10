/**
 * 界面设置：字体档位等，已统一由 useUserPreferences 提供（Logto customData 或本地）
 * 本 composable 仅做兼容导出，便于现有组件继续使用相同 API
 */
export function useUISettings() {
  const prefs = useUserPreferences()
  return {
    uiFontSizeStep: prefs.uiFontSizeStep,
    sessionAreaFontScale: prefs.sessionAreaFontScale,
    setUIFontSizeStep: prefs.setUIFontSizeStep,
    FONT_STEP_MIN: prefs.FONT_STEP_MIN,
    FONT_STEP_MAX: prefs.FONT_STEP_MAX,
  }
}
