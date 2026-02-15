'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '@/hooks/useTheme';
import { useTheme } from '@/hooks/useTheme';
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from '@/components/ui/menu';

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

function ThemeTriggerIcon({ mode }: { mode: ThemeMode }) {
  const Icon = OPTIONS.find((o) => o.value === mode)?.icon ?? Monitor;
  return <Icon className="size-4 shrink-0" />;
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <Menu>
      <MenuTrigger
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        aria-label="切换主题"
        title="主题"
      >
        <ThemeTriggerIcon mode={theme} />
      </MenuTrigger>
      <MenuPopup side="bottom" align="end" sideOffset={6}>
        {OPTIONS.map((opt) => {
          const isSelected = theme === opt.value;
          const Icon = opt.icon;
          return (
            <MenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className="gap-2"
            >
              <Icon className="size-4 opacity-80" />
              <span className="flex-1">{opt.label}</span>
              {isSelected && (
                <Check className="size-4 text-primary" aria-hidden />
              )}
            </MenuItem>
          );
        })}
      </MenuPopup>
    </Menu>
  );
}
