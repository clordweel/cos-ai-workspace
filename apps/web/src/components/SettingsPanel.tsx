import React, { useCallback, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

type ThemeValue = 'light' | 'dark' | 'system';

export function SettingsPanel() {
  const { preferences, updatePreferences } = useAuth();
  const { setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'ok' | 'error' | null>(null);

  const prefTheme = (preferences?.theme as ThemeValue) || 'system';
  const prefFontStep = typeof preferences?.uiFontSizeStep === 'number' ? preferences.uiFontSizeStep : 0;
  const prefNotifications = Boolean(preferences?.notificationsEnabled);

  const applyTheme = useCallback(
    (value: ThemeValue) => {
      if (value === 'light' || value === 'dark') {
        setTheme(value);
      } else {
        setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
    },
    [setTheme]
  );

  const handleThemeChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as ThemeValue;
      setSaving(true);
      setMessage(null);
      const res = await updatePreferences({ theme: value });
      setSaving(false);
      if (res.ok) {
        setMessage('ok');
        applyTheme(value);
      } else {
        setMessage('error');
      }
    },
    [updatePreferences, applyTheme]
  );

  const handleFontStepChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = Number(e.target.value);
      setSaving(true);
      setMessage(null);
      const res = await updatePreferences({ uiFontSizeStep: value });
      setSaving(false);
      setMessage(res.ok ? 'ok' : 'error');
    },
    [updatePreferences]
  );

  const handleNotificationsChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setSaving(true);
      setMessage(null);
      const res = await updatePreferences({ notificationsEnabled: checked });
      setSaving(false);
      setMessage(res.ok ? 'ok' : 'error');
    },
    [updatePreferences]
  );

  return (
    <div className="space-y-6 text-zinc-700 dark:text-zinc-300">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">偏好设置</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium">主题</label>
        <select
          value={prefTheme}
          onChange={handleThemeChange}
          disabled={saving}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="system">跟随系统</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">字体档位</label>
        <select
          value={prefFontStep}
          onChange={handleFontStepChange}
          disabled={saving}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value={-1}>较小</option>
          <option value={0}>默认</option>
          <option value={1}>较大</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="notifications"
          checked={prefNotifications}
          onChange={handleNotificationsChange}
          disabled={saving}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <label htmlFor="notifications" className="text-sm font-medium">
          启用通知
        </label>
      </div>

      {message === 'ok' && (
        <p className="text-sm text-green-600 dark:text-green-400">已保存</p>
      )}
      {message === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">保存失败，请重试</p>
      )}
    </div>
  );
}
