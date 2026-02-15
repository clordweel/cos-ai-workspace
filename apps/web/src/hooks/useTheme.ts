import { useCallback, useEffect, useState } from 'react';

/** 用户选择：浅色、深色、跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 实际应用的主题（仅 light | dark，system 会解析为二者之一） */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'cosai-theme';

function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 根据 mode 得到实际要应用的主题 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return getSystemPrefersDark() ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredMode())
  );

  // 应用当前解析后的主题，并同步到 meta theme-color
  useEffect(() => {
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#fafafa');
    }
  }, [mode]);

  // 当 mode 为 system 时，监听系统主题变化
  useEffect(() => {
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = media.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [mode]);

  const setTheme = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((m) => {
      if (m === 'system') return getSystemPrefersDark() ? 'light' : 'dark';
      return m === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return {
    /** 用户选择：light | dark | system */
    theme: mode,
    /** 实际应用的主题：light | dark（system 已解析） */
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  };
}
