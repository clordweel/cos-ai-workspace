'use client';

import { GripHorizontal, SendHorizontal } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { MentionItem } from '@/hooks/useContactsAndBots';
import { ChatLexicalEditor } from '@/components/chat/lexical/ChatLexicalEditor';

/** 最小高度 150px（抬高一倍后再调低 1/4），需容纳容器 padding、编辑器、底部工具栏 */
const MIN_EDIT_HEIGHT_PX = 150;
const MAX_EDIT_HEIGHT_PX = 420;
const DEFAULT_EDIT_HEIGHT_PX = 150;

export interface ChatInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  /** 提交时可选传入当前内容（编辑器 Enter 会传；表单提交时用 value） */
  onSubmit?: (currentText?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** true = Enter 发送 / Shift+Enter 换行，false = Enter 换行 / Ctrl+Enter 发送，默认 true */
  enterToSend?: boolean;
  /** @ 提及菜单项（联系人 + AI 助手），与 frontend UEditorMentionMenu 一致；Lexical 始终启用，无项时仅无候选 */
  mentionItems?: MentionItem[];
  /** 输入区高度变化时上报（px），用于聊天区底部留白 */
  onHeightChange?: (heightPx: number) => void;
  /** AI 助手思考/流式输出时隐藏底部工具条（格式提示 + 发送按钮） */
  hideToolbarWhenThinking?: boolean;
  className?: string;
}

const DEFAULT_PLACEHOLDER = '说点什么？';
const MENTION_PLACEHOLDER = '说点什么？输入 @ 可提及联系人或机器人';

export function ChatInputPanel({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  enterToSend = true,
  mentionItems = [],
  onHeightChange,
  hideToolbarWhenThinking = false,
  className,
}: ChatInputPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const getEditorTextRef = useRef<(() => string) | null>(null);
  const getEditorMarkdownRef = useRef<(() => string) | null>(null);
  const [editHeightPx, setEditHeightPx] = useState(DEFAULT_EDIT_HEIGHT_PX);
  const resolvedPlaceholder =
    placeholder ?? (mentionItems.length > 0 ? MENTION_PLACEHOLDER : DEFAULT_PLACEHOLDER);

  useEffect(() => {
    onHeightChange?.(editHeightPx);
  }, [editHeightPx, onHeightChange]);

  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

  const onResizeMoveRef = useRef((e: MouseEvent) => {
    const delta = resizeStartYRef.current - e.clientY;
    const next = Math.min(
      MAX_EDIT_HEIGHT_PX,
      Math.max(MIN_EDIT_HEIGHT_PX, resizeStartHeightRef.current + delta)
    );
    setEditHeightPx(next);
  });

  const onResizeEndRef = useRef(() => {
    window.removeEventListener('mousemove', onResizeMoveRef.current);
    window.removeEventListener('mouseup', onResizeEndRef.current);
  });

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = editHeightPx;
    window.addEventListener('mousemove', onResizeMoveRef.current);
    window.addEventListener('mouseup', onResizeEndRef.current);
  }, [editHeightPx]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const toSend = (getEditorMarkdownRef.current?.() ?? getEditorTextRef.current?.() ?? value).trim();
    if (!disabled && toSend) onSubmit?.(toSend);
  };

  return (
    <div
      ref={rootRef}
      className={cn('absolute bottom-0 left-0 right-0 z-20 flex flex-col pointer-events-none', className)}
    >
      <button
        type="button"
        className="chat-input-resize-handle absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-full cursor-n-resize items-center justify-center rounded-t-md rounded-b-none bg-border py-px px-3 text-zinc-600 dark:text-zinc-200 transition-colors pointer-events-auto"
        aria-label="拖拽调整输入框高度"
        onMouseDown={onResizeStart}
      >
        <GripHorizontal className="h-2 w-2" aria-hidden />
      </button>
      <div
        className="flex shrink-0 flex-col px-2.5 pointer-events-auto overflow-hidden"
        style={{ height: editHeightPx, minHeight: editHeightPx }}
      >
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex flex-1 min-h-0 flex-col rounded-xl border-2 border-border bg-white/70 px-2 py-2 overflow-hidden backdrop-blur-md dark:bg-zinc-900/70">
            <ChatLexicalEditor
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              onRegisterGetText={(getText) => {
                getEditorTextRef.current = getText;
              }}
              onRegisterGetMarkdown={(getMarkdown) => {
                getEditorMarkdownRef.current = getMarkdown;
              }}
              placeholder={resolvedPlaceholder}
              disabled={disabled}
              enterToSend={enterToSend}
              mentionItems={mentionItems}
              hideToolbar={hideToolbarWhenThinking}
              toolbarExtra={
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap" aria-hidden>
                    {enterToSend ? 'Shift + Enter 换行' : 'Ctrl + Enter 发送'}
                  </span>
                  <div
                    className={cn(
                      'send-btn-wrap rounded-lg p-0.5 transition-colors duration-300',
                      !disabled && value.trim() && 'send-btn-ready'
                    )}
                  >
                    <button
                      type="submit"
                      className={cn(
                        'send-btn-inner group relative flex h-6 min-w-8 items-center justify-center gap-0.5 rounded-[calc(0.5rem-1px)] pl-1 pr-1.5 transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50',
                        !disabled && value.trim()
                          ? 'bg-white text-black shadow-md ring-1 ring-primary-200/50 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:ring-primary-400/25 dark:hover:bg-zinc-700'
                          : 'bg-white text-black hover:bg-zinc-50 hover:text-black dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:hover:text-white'
                      )}
                      disabled={disabled || !value.trim()}
                      aria-label="发送"
                    >
                      <span className="flex shrink-0 pl-0.5 transition-transform duration-200 group-hover:-rotate-90">
                        <SendHorizontal className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="text-[10px] font-medium">发送</span>
                    </button>
                  </div>
                </div>
              }
              className="min-w-0"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
