'use client';

import { Send } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ChatInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** 输入区高度变化时上报（px），用于聊天区底部留白 */
  onHeightChange?: (heightPx: number) => void;
  className?: string;
}

export function ChatInputPanel({
  value,
  onChange,
  onSubmit,
  placeholder = '说点什么？',
  disabled = false,
  onHeightChange,
  className,
}: ChatInputPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !onHeightChange) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      onHeightChange(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && value.trim()) onSubmit?.();
  };

  return (
    <div
      ref={rootRef}
      className={cn('absolute bottom-0 left-0 right-0 z-20 flex flex-col pointer-events-none', className)}
      aria-hidden
    >
      {/* 输入区内容层：无白底无边框，渐变遮罩由 ChatPane 单独层提供 */}
      <div className="shrink-0 p-3 pt-0 pointer-events-auto bg-transparent">
        <form
          onSubmit={handleSubmit}
          className="overflow-visible"
        >
          <div className="flex flex-col">
            <div className="flex min-h-[3rem] w-full items-end gap-2 px-2 pt-2 pb-2">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className="min-h-[2.5rem] flex-1 resize-none rounded-lg border-0 bg-transparent px-0 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (value.trim()) onSubmit?.();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg"
                disabled={disabled || !value.trim()}
                aria-label="发送"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
