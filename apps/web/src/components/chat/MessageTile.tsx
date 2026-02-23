'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMessageTime } from '@/lib/time';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AiAssistantAvatarIcon } from '@/components/icons/AiAssistantAvatarIcon';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  ChatMessageItem,
  MessageSource,
  MessageReaction,
  MessageReceiptStatus,
} from './chatMessageTypes';
import { AssistantMessageContent } from '@/components/chat/AssistantMessageContent';
import { AI_ASSISTANT_LABEL } from '@/components/chat/assistantConstants';
import { Check, CheckCheck, AlertCircle, Loader2, Reply, Copy, Trash2, Pencil, RefreshCw, Undo2, ThumbsUp, ThumbsDown, MoreVertical, Sparkle, User, Cog } from 'lucide-react';

/** Element 风格系统消息：居中、无头像、背景色跟随聊天区 */
function SystemMessageTile({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-center py-1" role="listitem">
      <span className="rounded-md bg-[var(--session-frame-panel-bg)] px-2 py-1 text-[11px] text-muted-foreground">
        {content}
      </span>
    </div>
  );
}

function ReceiptStatusIcon({ status }: { status: MessageReceiptStatus }) {
  if (status === 'sending')
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />;
  if (status === 'sent')
    return <Check className="h-3 w-3 text-muted-foreground" aria-hidden />;
  if (status === 'delivered' || status === 'read')
    return <CheckCheck className="h-3 w-3 text-muted-foreground" aria-hidden />;
  if (status === 'failed')
    return <AlertCircle className="h-3 w-3 text-destructive" aria-hidden />;
  return null;
}

/** 已读头像组（Element 风格：气泡外小头像） */
function ReadReceiptAvatars({ readBy }: { readBy: MessageSource[] }) {
  if (!readBy?.length) return null;
  return (
    <div className="flex -space-x-1.5" aria-label={`已读：${readBy.map((r) => r.label).join('、')}`}>
      {readBy.slice(0, 3).map((r, i) => (
        <Avatar
          key={i}
          className="h-4 w-4 border-2 border-zinc-200 dark:border-zinc-600"
        >
          <AvatarFallback className="text-[8px] bg-muted">
            {r.label?.slice(0, 1) ?? '?'}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

/** 来源标签（bot/用户/系统） */
function SourceLabels({ sources }: { sources: MessageSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {sources.map((s, i) => (
        <span
          key={i}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px]',
            s.type === 'bot' && 'bg-primary/10 text-primary',
            s.type === 'other_user' && 'bg-muted text-muted-foreground',
            s.type === 'system' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
          )}
        >
          {s.label ?? s.type}
        </span>
      ))}
    </div>
  );
}

/** 反应（Element 风格：气泡下方 emoji/文字） */
function ReactionPills({ reactions }: { reactions: MessageReaction[] }) {
  if (!reactions?.length) return null;
  const likeCount = reactions.filter((r) => r.type === 'like').length;
  const dislikeCount = reactions.filter((r) => r.type === 'dislike').length;
  const labels: string[] = [];
  if (likeCount > 0) labels.push(`👍 ${likeCount > 1 ? likeCount : ''}`.trim());
  if (dislikeCount > 0) labels.push(`👎 ${dislikeCount > 1 ? dislikeCount : ''}`.trim());
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {labels.map((l, i) => (
        <span
          key={i}
          className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** 消息气泡右键菜单回调（与 frontend ChatMessageBubble 对齐） */
export interface MessageTileContextMenuHandlers {
  onReply?: (message: ChatMessageItem) => void;
  onCopy?: (message: ChatMessageItem) => void;
  onDelete?: (message: ChatMessageItem) => void;
  onEdit?: (message: ChatMessageItem) => void;
  onRetry?: (message: ChatMessageItem) => void;
  onRecall?: (message: ChatMessageItem) => void;
  /** 赞同/反对（与 frontend 消息底栏工具条一致） */
  onReaction?: (message: ChatMessageItem, type: 'like' | 'dislike') => void;
}

/** Element 风格气泡消息：用户右对齐、助手/他人左对齐，含头像/发送者/时间/状态/已读/反应/编辑 */
function BubbleMessageTile({
  message,
  currentUserAvatar,
  currentUserName,
  contextMenuHandlers,
}: {
  message: ChatMessageItem;
  currentUserAvatar?: string | null;
  currentUserName?: string | null;
  contextMenuHandlers?: MessageTileContextMenuHandlers;
}) {
  const isUser = message.role === 'user';
  const ts = message.createdAt ?? Date.now();
  const h = contextMenuHandlers;
  return (
    <ContextMenu>
      <div
        className={cn(
          'flex w-full gap-2 relative',
          isUser ? 'flex-row-reverse pt-2 pb-3' : 'flex-row items-start pt-2 pb-1'
        )}
        role="listitem"
      >
      {/* 左侧（他人/助手）：头像；用户消息不显示“我”头像 */}
      {!isUser && (
        <div className="flex h-8 shrink-0 flex-col items-center justify-center">
          {message.sources?.[0]?.type === 'bot' ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
              <AiAssistantAvatarIcon className="size-full" />
            </span>
          ) : (
            <Avatar className="h-8 w-8 border-2 border-zinc-200 dark:border-zinc-600">
              <AvatarFallback className="text-xs bg-muted">
                {message.sources?.[0]?.label?.slice(0, 1) ?? (message.role === 'assistant' ? AI_ASSISTANT_LABEL.slice(0, 1) : '?')}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn('flex min-w-0 max-w-[85%] flex-col', isUser ? 'items-end' : 'items-start')}>
        {/* 对侧：名称行；仅当 sources 标明为 bot 且无 label 时兜底助手名，其余用 sources[0].label */}
        {!isUser && (
          <div className="flex min-h-8 w-full items-center">
            <span className="text-[11px] font-medium text-foreground">
              {message.sources?.[0]?.label ?? (message.sources?.[0]?.type === 'bot' ? AI_ASSISTANT_LABEL : '')}
            </span>
          </div>
        )}
        {!isUser && (
          <>
            <span
              className="absolute -right-3 top-6 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700"
              aria-hidden
            />
            <time
              className="absolute right-0 top-6 -translate-y-1/2 text-[10px] text-zinc-500 dark:text-zinc-400"
              dateTime={new Date(ts).toISOString()}
            >
              {formatMessageTime(ts)}
            </time>
          </>
        )}

        {/* “我”的消息：已读头像在气泡顶部 */}
        {isUser && message.readBy && message.readBy.length > 0 && (
          <div className="flex justify-end pb-0.5">
            <ReadReceiptAvatars readBy={message.readBy} />
          </div>
        )}

        {/* 气泡 + 状态 */}
        <div className={cn('flex items-end gap-1', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'rounded-xl text-xs',
                isUser
                  ? 'chat-bubble-own rounded-tr-none bg-primary text-primary-foreground px-3 py-2'
                  : 'rounded-tl-none bg-[var(--session-frame-panel-bg)] text-foreground px-0 py-0'
              )}
            >
              {message.replyToId && (
                <div className="mb-1 border-l-2 border-muted-foreground/30 pl-2 text-[10px] text-muted-foreground">
                  引用消息
                </div>
              )}
              {!isUser ? (
                <AssistantMessageContent message={message} />
              ) : message.formattedContent ? (
                <div
                  className="chat-session-content-text chat-formatted-html text-xs break-words"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.formattedContent, { ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'] }) }}
                />
              ) : (
                <div className="chat-session-content-text chat-markdown text-xs break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
                </div>
              )}
              {message.editedAt != null && message.editedBy?.label && (
                <p className="mt-0.5 text-[10px] opacity-80">
                  已编辑 · {message.editedBy.label}
                </p>
              )}
            </div>
          </ContextMenuTrigger>
          {isUser && message.receiptStatus && (
            <ReceiptStatusIcon status={message.receiptStatus} />
          )}
        </div>

        {/* 己方：时间与时间轴点放在 listitem 右侧底部，贴近气泡 */}
        {isUser && (
          <>
            <span
              className="absolute -right-3 bottom-0 h-[5px] w-[5px] translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700"
              aria-hidden
            />
            <time
              className="absolute right-0 bottom-0 translate-y-1/2 text-[10px] text-zinc-500 dark:text-zinc-400"
              dateTime={new Date(ts).toISOString()}
            >
              {formatMessageTime(ts)}
            </time>
          </>
        )}

        {/* 对侧不展示来源等提示信息，仅保留底边工具条；反应照常展示 */}
        {message.reactions && message.reactions.length > 0 && (
          <ReactionPills reactions={message.reactions} />
        )}

        {/* 消息底边工具栏（与 frontend 左侧消息底栏工具条一致）：赞同/反对/复制/更多 + 右侧堆叠来源头像 */}
        {!isUser && (
          <div className="-ml-[7px] mt-1.5 flex items-center justify-between gap-0.5 text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label="赞同"
                onClick={() => h?.onReaction?.(message, 'like')}
              >
                <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label="反对"
                onClick={() => h?.onReaction?.(message, 'dislike')}
              >
                <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label="复制"
                onClick={() => {
                  h?.onCopy?.(message);
                  if (!h?.onCopy && typeof navigator?.clipboard?.writeText === 'function') {
                    navigator.clipboard.writeText(message.content);
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors outline-none"
                    aria-label="更多"
                  >
                    <MoreVertical className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={4} className="min-w-[140px]">
                  {message.sources?.some((s) => s.type === 'bot') && (
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => h?.onRetry?.(message)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      重试
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => h?.onReply?.(message)}
                  >
                    <Reply className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    回复
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                    onSelect={() => h?.onDelete?.(message)}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex shrink-0 -space-x-2">
              {((message.sources?.length ?? 0) > 0 ? message.sources! : [{ type: 'bot' as const }]).map((src, idx) => (
                <span
                  key={idx}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
                  title={src.label ?? (src.type === 'bot' ? '机器人' : src.type === 'other_user' ? '用户' : '系统')}
                >
                  {src.type === 'other_user' ? (
                    <User className="h-3 w-3" />
                  ) : src.type === 'bot' ? (
                    <Sparkle className="h-3 w-3" />
                  ) : (
                    <Cog className="h-3 w-3" />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      </div>
      <ContextMenuPortal>
        <ContextMenuContent className="min-w-[140px]" sideOffset={4}>
          <ContextMenuItem
            className="gap-2"
            onSelect={() => h?.onReply?.(message)}
          >
            <Reply className="h-3.5 w-3.5 shrink-0 opacity-70" />
            回复
          </ContextMenuItem>
          <ContextMenuItem
            className="gap-2"
            onSelect={() => {
              h?.onCopy?.(message);
              if (!h?.onCopy && typeof navigator?.clipboard?.writeText === 'function') {
                navigator.clipboard.writeText(message.content);
              }
            }}
          >
            <Copy className="h-3.5 w-3.5 shrink-0 opacity-70" />
            复制
          </ContextMenuItem>
          {isUser && (
            <>
              <ContextMenuItem className="gap-2" onSelect={() => h?.onEdit?.(message)}>
                <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" />
                编辑
              </ContextMenuItem>
              {message.receiptStatus === 'failed' && (
                <ContextMenuItem className="gap-2" onSelect={() => h?.onRetry?.(message)}>
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  重试
                </ContextMenuItem>
              )}
              <ContextMenuItem className="gap-2" onSelect={() => h?.onRecall?.(message)}>
                <Undo2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                撤回
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem
            className="gap-2 text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
            onSelect={() => h?.onDelete?.(message)}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenu>
  );
}

/** Element 风格单条消息：系统 / 气泡（用户/助手） */
export function MessageTile({
  message,
  currentUserAvatar,
  currentUserName,
  contextMenuHandlers,
}: {
  message: ChatMessageItem;
  currentUserAvatar?: string | null;
  currentUserName?: string | null;
  contextMenuHandlers?: MessageTileContextMenuHandlers;
}) {
  if (message.role === 'system') {
    return <SystemMessageTile content={message.content} />;
  }
  return (
    <BubbleMessageTile
      message={message}
      currentUserAvatar={currentUserAvatar}
      currentUserName={currentUserName}
      contextMenuHandlers={contextMenuHandlers}
    />
  );
}
