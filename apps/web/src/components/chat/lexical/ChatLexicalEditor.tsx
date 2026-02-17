'use client';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { $getRoot, $createParagraphNode } from 'lexical';
import { KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import type { ReactNode } from 'react';
import { useRef, useEffect, useCallback } from 'react';
import { ChatMentionsPlugin } from './ChatMentionsPlugin';
import { ChatInputToolbar } from './ChatInputToolbar';
import { SlashCommandsPlugin } from './SlashCommandsPlugin';
import { MentionNode } from './MentionNode';
import { getPlainTextWithMentions } from './lexicalSerialization';
import type { MentionItem } from '@/hooks/useContactsAndBots';
import { cn } from '@/lib/utils';

/** Lexical theme：text 须为 TextNodeThemeClasses 对象；bold/italic/code 与 frontend/Element 格式化一致 */
const theme = {
  paragraph: 'mb-0 leading-tight',
  text: {
    base: 'text-xs leading-tight text-foreground',
    bold: 'font-bold',
    italic: 'italic',
    code: 'rounded bg-muted px-1 font-mono text-xs',
  },
};

export interface ChatLexicalEditorProps {
  /** 受控：父组件传入的纯文本，仅用于清空时同步（value === '' 时清空编辑器） */
  value: string;
  onChange: (plainText: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** true = Enter 发送 / Shift+Enter 换行，false = Enter 换行 / Ctrl+Enter 发送，默认 true */
  enterToSend?: boolean;
  mentionItems: MentionItem[];
  /** 工具栏右侧插槽（如发送按钮），与工具按钮同一栏 */
  toolbarExtra?: ReactNode;
  className?: string;
}

function onError(error: Error) {
  console.error('[ChatLexicalEditor]', error);
}

export function ChatLexicalEditor({
  value,
  onChange,
  onSubmit,
  placeholder = '说点什么？输入 @ 可提及联系人或机器人',
  disabled = false,
  enterToSend = true,
  mentionItems,
  toolbarExtra,
  className,
}: ChatLexicalEditorProps) {
  const initialConfig = useRef({
    namespace: 'ChatLexicalEditor',
    theme,
    onError,
    nodes: [MentionNode],
    editable: !disabled,
  }).current;

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn('relative flex min-h-0 flex-1 min-w-0 flex-col', className)}>
        {/* 编辑器区：占满剩余高度，超出显示滚动条；工具栏始终在底部 */}
        <div className="chat-input-editor-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          <RichTextPlugin
            contentEditable={
              <div className="min-h-0 flex-1 min-w-0 overflow-y-auto" style={{ display: 'block' }}>
                <ContentEditable
                  className="min-h-[2.5rem] w-full resize-none rounded-lg border-0 bg-transparent px-[2px] py-0 outline-none placeholder:text-muted-foreground disabled:opacity-50 [&_.lexical-editor]:outline-none"
                  aria-placeholder={placeholder}
                  aria-disabled={disabled}
                />
              </div>
            }
            placeholder={
              <span className="pointer-events-none absolute left-[2px] right-[2px] top-0 text-xs text-muted-foreground leading-[24px]">
                {placeholder}
              </span>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border/60 pt-2">
          <ChatInputToolbar disabled={disabled} />
          {toolbarExtra != null && (
            <div className="ml-auto shrink-0">{toolbarExtra}</div>
          )}
        </div>
        <HistoryPlugin />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(_, editor) => {
            const plain = getPlainTextWithMentions(editor);
            onChange(plain);
          }}
        />
        <EnterSubmitPlugin onSubmit={onSubmit} disabled={disabled} enterToSend={enterToSend} />
        <EditablePlugin disabled={disabled} />
        <SyncClearPlugin value={value} />
        {mentionItems.length > 0 && <ChatMentionsPlugin mentionItems={mentionItems} />}
        <SlashCommandsPlugin onSubmit={onSubmit} />
      </div>
    </LexicalComposer>
  );
}

function EnterSubmitPlugin({
  onSubmit,
  disabled,
  enterToSend,
}: {
  onSubmit?: () => void;
  disabled: boolean;
  enterToSend: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand<KeyboardEvent | null>(
      KEY_ENTER_COMMAND,
      (event) => {
        if (disabled) return false;
        const plain = getPlainTextWithMentions(editor);
        if (!plain.trim()) return false;
        if (enterToSend) {
          if (event?.shiftKey) return false;
          onSubmit?.();
          return true;
        }
        if (!event?.ctrlKey) return false;
        onSubmit?.();
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onSubmit, disabled, enterToSend]);
  return null;
}

function EditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  return null;
}

function SyncClearPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value !== '' || prevValueRef.current === '') return;
    prevValueRef.current = value;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const p = $createParagraphNode();
      root.append(p);
    });
  }, [value, editor]);
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);
  return null;
}
