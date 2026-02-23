'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseMessageBodyToSegments, ASSOC_OPEN } from '@/types/messageSegments';
import type { MessageSegment } from '@/types/messageSegments';

/** 方案 B 单条关联段块（用户/助手消息共用）；点击可打开对应应用；独立气泡时使用专用样式 */
export function AssociationSegmentBlock({
  payload,
  onOpenApp,
  variant = 'inline',
}: {
  payload: { app_id: string; entity_id: string; title: string; summary?: string };
  onOpenApp?: (appId: string, entityId: string) => void;
  /** inline = 混在段落中；bubble = 单独占一条消息气泡，使用关联专用样式 */
  variant?: 'inline' | 'bubble';
}) {
  const handleClick = () => {
    onOpenApp?.(payload.app_id, payload.entity_id);
  };
  const isBubble = variant === 'bubble';
  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        isBubble
          ? 'flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary/10 dark:hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer border-0 shadow-none'
          : 'flex w-full items-start gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left transition-colors hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer'
      }
      title={`打开：${payload.app_id} · ${payload.entity_id}`}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md',
          isBubble ? 'h-8 w-8 bg-primary/15 dark:bg-primary/20 text-primary' : 'mt-0.5'
        )}
      >
        <Link2 className={isBubble ? 'h-4 w-4' : 'h-3 w-3 text-muted-foreground'} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {isBubble && (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">关联应用</span>
        )}
        <span className={cn('font-medium text-foreground', isBubble ? 'block text-sm mt-0.5' : '')}>{payload.title}</span>
        {payload.summary && (
          <p className={cn('text-muted-foreground mt-0.5 line-clamp-2', isBubble ? 'text-[11px]' : 'text-[10px]')}>
            {payload.summary}
          </p>
        )}
      </div>
    </button>
  );
}

/** 仅渲染单条线段（用于拆成多条消息时每条只显示一段）；association 时可传 variant=bubble 使用关联气泡样式 */
export function SingleSegmentContent({
  segment,
  onOpenApp,
  associationVariant = 'inline',
}: {
  segment: MessageSegment;
  onOpenApp?: (appId: string, entityId: string) => void;
  associationVariant?: 'inline' | 'bubble';
}) {
  if (segment.type === 'text') {
    if (!segment.content.trim()) return null;
    return (
      <div className="chat-session-content-text chat-markdown text-xs break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment.content}</ReactMarkdown>
      </div>
    );
  }
  return <AssociationSegmentBlock payload={segment.payload} onOpenApp={onOpenApp} variant={associationVariant} />;
}

/**
 * 按方案 B 解析 content，若有 [ASSOC]...[/ASSOC] 则渲染线段（文本 + 关联块）；
 * 无关联段时返回 null，由调用方回退到原文/Markdown。用户与助手历史消息共用。
 * onOpenApp：点击关联块时打开对应应用（appId + entityId）
 */
export function SegmentedMessageBody({
  content,
  onOpenApp,
}: {
  content: string;
  onOpenApp?: (appId: string, entityId: string) => void;
}) {
  const segments = parseMessageBodyToSegments(content ?? '');
  const hasAssoc = segments.some((s) => s.type === 'association');
  if (!hasAssoc && !content?.includes(ASSOC_OPEN)) return null;
  return (
    <div className="chat-session-content-text text-xs break-words space-y-1.5">
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          if (!seg.content.trim()) return null;
          return (
            <div key={i} className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.content}</ReactMarkdown>
            </div>
          );
        }
        return (
          <AssociationSegmentBlock
            key={i}
            payload={seg.payload}
            onOpenApp={onOpenApp}
          />
        );
      })}
    </div>
  );
}
