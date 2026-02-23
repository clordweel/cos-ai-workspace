'use client';

import { GripHorizontal, SendHorizontal, X, Link2 } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { MentionItem } from '@/hooks/useContactsAndBots';
import { ChatLexicalEditor } from '@/components/chat/lexical/ChatLexicalEditor';
import { useAssociationOptional } from '@/contexts/AssociationContext';
import { ASSOCIATION_CANDIDATES } from '@/data/associationCandidates';
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover';

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
  const [associationPickerOpen, setAssociationPickerOpen] = useState(false);
  const associationAnchorRef = useRef<HTMLDivElement>(null);
  const association = useAssociationOptional();

  useEffect(() => {
    if (!association) return;
    return association.registerOpenAssociationPicker(() => setAssociationPickerOpen(true));
  }, [association]);

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
          <div className="relative flex flex-1 min-h-0 flex-col rounded-xl border-2 border-border bg-white/70 px-2 py-2 overflow-hidden backdrop-blur-md dark:bg-zinc-900/70">
            {association && association.pendingAssociations.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2 shrink-0">
                {association.pendingAssociations.map((item) => (
                  <span
                    key={`${item.appId}:${item.entityId}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground"
                  >
                    <span className="max-w-[120px] truncate" title={item.title}>
                      {item.title}
                    </span>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label={`移除关联 ${item.title}`}
                      onClick={() => association.removePendingAssociation(item.entityId, item.appId)}
                    >
                      <X className="h-2.5 w-2.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Popover open={associationPickerOpen} onOpenChange={setAssociationPickerOpen}>
              <div
                ref={associationAnchorRef}
                className="absolute left-0 top-0 h-0 w-0"
                aria-hidden
              />
              <PopoverPopup anchor={associationAnchorRef} side="top" align="start" className="w-72 max-h-[min(20rem,60vh)] flex flex-col">
                <PopoverTitle className="text-sm">关联到当前会话</PopoverTitle>
                <PopoverDescription className="mt-1 mb-2">
                  选择一项即可添加到输入框上方，发送时随消息一起提交。
                </PopoverDescription>
                <ul className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0" role="list">
                  {ASSOCIATION_CANDIDATES.map((item) => {
                    const key = `${item.appId}:${item.entityId}`;
                    const alreadyAdded = association?.pendingAssociations.some(
                      (p) => p.appId === item.appId && p.entityId === item.entityId
                    );
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left transition-colors',
                            alreadyAdded
                              ? 'opacity-60 cursor-default'
                              : 'hover:bg-muted/60 hover:border-border cursor-pointer'
                          )}
                          onClick={() => {
                            if (alreadyAdded || !association) return;
                            association.addPendingAssociation(item);
                            setAssociationPickerOpen(false);
                          }}
                          disabled={alreadyAdded || !association}
                        >
                          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground">{item.title}</span>
                            {item.summary && (
                              <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{item.summary}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </PopoverPopup>
            </Popover>
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
