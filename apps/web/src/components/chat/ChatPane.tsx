'use client';

import { ArrowDown } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { ChatHeader, type ChatHeaderParticipant } from '@/components/chat/ChatHeader';
import { ChatInputPanel } from '@/components/chat/ChatInputPanel';
import { MessageTile, type MessageTileContextMenuHandlers } from '@/components/chat/MessageTile';
import type { ChatMessageItem } from '@/components/chat/chatMessageTypes';
import { cn } from '@/lib/utils';
import type { MentionItem } from '@/hooks/useContactsAndBots';

export type ChatDisplayItem =
  | { type: 'date'; label: string }
  | { type: 'message'; message: ChatMessageItem };

export interface ChatPaneProps {
  /** 会话标题 */
  chatTitle: string;
  /** 对方头像（顶栏展示） */
  chatUserAvatar?: string | null;
  /** 对方名称 */
  chatUserName?: string | null;
  /** 日期分隔与消息交错列表 */
  displayItems: ChatDisplayItem[];
  /** 输入框受控值 */
  input: string;
  /** 输入框变更 */
  onInputChange: (value: string) => void;
  /** 发送消息 */
  onSubmit?: () => void;
  /** @ 提及菜单项（联系人 + AI 助手），与 frontend UEditorMentionMenu 一致 */
  mentionItems?: MentionItem[];
  /** 关闭会话（顶栏菜单） */
  onClose?: () => void;
  /** 是否展示顶栏返回按钮 */
  showBack?: boolean;
  /** 当前用户头像（顶栏菜单左侧） */
  currentUserAvatar?: string | null;
  /** 当前用户名称（顶栏头像 fallback） */
  currentUserName?: string | null;
  /** 参与会话者（排除“我”），顶栏左侧堆叠头像 */
  participants?: ChatHeaderParticipant[];
  /** true = Enter 发送 / Shift+Enter 换行，false = Enter 换行 / Ctrl+Enter 发送，默认 true */
  enterToSend?: boolean;
  /** 输入区高度（px），未测前用 8.75rem 约 140px */
  inputAreaHeightPx?: number | null;
  /** 输入区高度变化回调 */
  onInputAreaHeightChange?: (heightPx: number) => void;
  /** 消息气泡右键菜单回调（回复/复制/删除/编辑/重试/撤回） */
  messageContextMenuHandlers?: MessageTileContextMenuHandlers;
  className?: string;
}

const SCROLL_THRESHOLD = 50;
const DEFAULT_INPUT_HEIGHT_PX = 140;

export function ChatPane({
  chatTitle,
  chatUserAvatar,
  chatUserName,
  displayItems,
  input,
  onInputChange,
  onSubmit,
  mentionItems,
  onClose,
  showBack = false,
  currentUserAvatar,
  currentUserName,
  participants,
  enterToSend = true,
  inputAreaHeightPx = null,
  onInputAreaHeightChange,
  messageContextMenuHandlers,
  className,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const inputHeight = inputAreaHeightPx ?? DEFAULT_INPUT_HEIGHT_PX;

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollToBottom(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollPosition, { passive: true });
    const ro = new ResizeObserver(() => checkScrollPosition());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScrollPosition);
      ro.disconnect();
    };
  }, [checkScrollPosition]);

  useEffect(() => {
    if (displayItems.length === 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom('auto'));
    });
  }, [displayItems.length, scrollToBottom]);

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      {/* 滚动区占满聊天区容器高度，内容用 padding 避开上/下栏 */}
      <div className="absolute inset-0">
        <div
          ref={scrollRef}
          className="chat-messages-scroll h-full overflow-x-hidden overflow-y-auto"
          style={{ paddingTop: '2.5rem', paddingBottom: `${inputHeight}px` }}
        >
          <div className="relative flex w-full min-w-0 flex-col gap-0.5 pl-4 pr-4">
              {/* 时间轴：右侧竖线，伪元素遮盖实现上下渐隐 */}
              <div
                className="absolute right-[6px] top-0 h-full min-h-full w-px overflow-visible before:pointer-events-none before:absolute before:left-0 before:right-0 before:top-0 before:h-8 before:content-[''] before:bg-gradient-to-b before:from-[var(--session-frame-panel-bg)] before:to-transparent after:pointer-events-none after:absolute after:left-0 after:right-0 after:bottom-0 after:h-8 after:content-[''] after:bg-gradient-to-t after:from-[var(--session-frame-panel-bg)] after:to-transparent"
                aria-hidden
              >
                <div className="h-full min-h-full w-px bg-zinc-200 dark:bg-zinc-700" />
              </div>
              {displayItems.map((item, idx) =>
                item.type === 'date' ? (
                  <div
                    key={`date-${idx}-${item.label}`}
                    className="date-separator-full relative my-3 w-full min-w-0 shrink-0 py-2 pl-2"
                    aria-hidden
                  >
                    <span className="block h-0 w-full overflow-hidden" aria-hidden />
                    <div
                      className="absolute inset-x-0 top-1/2 h-[0.5px] -translate-y-1/2 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-600"
                      aria-hidden
                    />
                    <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-[var(--session-frame-panel-bg)] px-2 text-[11px] text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <MessageTile
                    key={item.message.id}
                    message={item.message}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    contextMenuHandlers={messageContextMenuHandlers}
                  />
                )
              )}
          </div>
          {/* 底部空白区：滚动到底时最后一条消息可显示在中间区域 */}
          <div className="min-h-[25rem] shrink-0" aria-hidden />
        </div>
        {showScrollToBottom && (
          <button
            type="button"
            className="absolute left-1/2 top-14 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-md text-zinc-600 transition-opacity hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="回到底部"
            onClick={() => scrollToBottom()}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <ChatHeader
        title={chatTitle}
        userAvatar={chatUserAvatar}
        userName={chatUserName}
        participants={participants}
        currentUserAvatar={currentUserAvatar}
        currentUserName={currentUserName}
        showBack={showBack}
        onClose={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <ChatInputPanel
          value={input}
          onChange={onInputChange}
          onSubmit={onSubmit}
          enterToSend={enterToSend}
          mentionItems={mentionItems}
          onHeightChange={onInputAreaHeightChange}
        />
      </div>
    </div>
  );
}
