'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { FORMAT_TEXT_COMMAND } from 'lexical';
import { useCallback } from 'react';
import { AtSign, Bold, Code, Hash, Italic, Slash } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 与 frontend ChatInputPanel 一致：插入 @ / # / 与 粗体/斜体/代码 格式化 */
export function ChatInputToolbar({ disabled }: { disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();

  const insertAtCursor = useCallback(
    (char: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText(char);
      });
      editor.focus();
    },
    [editor]
  );

  const format = useCallback(
    (format: 'bold' | 'italic' | 'code') => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
      editor.focus();
    },
    [editor]
  );

  const chipClass =
    'input-toolbar-chip relative flex h-6 items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-zinc-600/80 bg-white/90 dark:bg-zinc-700/60 px-1 py-1 transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] dark:hover:border-zinc-500 dark:hover:bg-zinc-600/80';
  const iconWrapClass =
    'flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-600/80 text-black dark:text-white';
  const iconOnlyClass = cn(chipClass, 'w-6 justify-center');

  if (disabled) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={chipClass}
        title="@ 提及"
        aria-label="@ 提及"
        onClick={() => insertAtCursor('@')}
      >
        <span className={iconWrapClass}>
          <AtSign className="h-2 w-2" aria-hidden />
        </span>
        <span className="text-[10px] font-medium text-black dark:text-white">提及</span>
      </button>
      <button
        type="button"
        className={chipClass}
        title="# 来源"
        aria-label="# 来源"
        onClick={() => insertAtCursor('#')}
      >
        <span className={iconWrapClass}>
          <Hash className="h-2 w-2" aria-hidden />
        </span>
        <span className="text-[10px] font-medium text-black dark:text-white">来源</span>
      </button>
      <button
        type="button"
        className={chipClass}
        title="/ 命令"
        aria-label="/ 命令"
        onClick={() => insertAtCursor('/')}
      >
        <span className={iconWrapClass}>
          <Slash className="h-2 w-2" aria-hidden />
        </span>
        <span className="text-[10px] font-medium text-black dark:text-white">命令</span>
      </button>
      <button
        type="button"
        className={iconOnlyClass}
        title="粗体"
        aria-label="粗体"
        onClick={() => format('bold')}
      >
        <Bold className="h-3 w-3 text-black dark:text-white" aria-hidden />
      </button>
      <button
        type="button"
        className={iconOnlyClass}
        title="斜体"
        aria-label="斜体"
        onClick={() => format('italic')}
      >
        <Italic className="h-3 w-3 text-black dark:text-white" aria-hidden />
      </button>
      <button
        type="button"
        className={iconOnlyClass}
        title="行内代码"
        aria-label="行内代码"
        onClick={() => format('code')}
      >
        <Code className="h-3 w-3 text-black dark:text-white" aria-hidden />
      </button>
    </div>
  );
}
