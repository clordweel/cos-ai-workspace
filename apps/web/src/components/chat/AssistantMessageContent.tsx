'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessageItem } from '@/components/chat/chatMessageTypes';
import {
  ASSISTANT_WAITING_ID,
  ASSISTANT_STREAMING_ID,
  isStreamingContentIncomplete,
} from '@/components/chat/assistantConstants';

const ALLOWED_HTML_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'hr',
] as const;

export interface AssistantMessageContentProps {
  message: ChatMessageItem;
  className?: string;
}

/** 助手消息气泡内容：思考区（可折叠）+ 正文（等待/流式/HTML/Markdown） */
export function AssistantMessageContent({ message, className }: AssistantMessageContentProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const hasThinking = message.thinking != null && message.thinking.trim() !== '';
  const isWaiting = message.role === 'assistant' && message.id === ASSISTANT_WAITING_ID;
  const isStreaming = message.role === 'assistant' && message.id === ASSISTANT_STREAMING_ID;
  const streamingIncomplete = isStreaming && isStreamingContentIncomplete(message.content);

  return (
    <div className={cn('', className)}>
      {hasThinking && (
        <div className="mb-3">
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setThinkingOpen((o) => !o)}
            aria-expanded={thinkingOpen}
          >
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', thinkingOpen && 'rotate-90')}
              aria-hidden
            />
            <span>思考过程</span>
          </button>
          {thinkingOpen && (
            <div className="mt-1.5 rounded-lg border border-border bg-muted/50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {message.thinking}
            </div>
          )}
        </div>
      )}

      {isWaiting ? (
        <p className="chat-session-content-text flex items-center gap-2 py-2 px-3 text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          <span>正在思考…</span>
        </p>
      ) : message.formattedContent ? (
        <div
          className="chat-session-content-text chat-formatted-html text-xs break-words"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(message.formattedContent, { ALLOWED_TAGS: [...ALLOWED_HTML_TAGS] }),
          }}
        />
      ) : isStreaming ? (
        streamingIncomplete ? (
          <p className="chat-session-content-text flex items-center gap-2 py-2 px-0 text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            <span>正在输出…</span>
          </p>
        ) : (
          <p className="chat-session-content-text whitespace-pre-wrap break-words">
            {message.content}
            <span
              className="inline-block h-4 w-0.5 align-middle bg-current ml-0.5 animate-[streaming-cursor_1s_ease-in-out_infinite]"
              aria-hidden
            />
          </p>
        )
      ) : (
        <div className="chat-session-content-text chat-markdown text-xs break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
