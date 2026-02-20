'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $getSelection, $isRangeSelection } from 'lexical';
import { useCallback, useMemo, useState } from 'react';
import { getPlainTextWithMentions } from './lexicalSerialization';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const TRIGGER = '/';

export type SlashCommandItem = {
  key: string;
  label: string;
  onSelect?: (editor: import('lexical').LexicalEditor) => void;
};

const DEFAULT_COMMANDS: SlashCommandItem[] = [
  { key: 'send', label: '发送消息' },
  { key: 'newline', label: '换行' },
];

class SlashMenuOption extends MenuOption {
  item: SlashCommandItem;
  constructor(item: SlashCommandItem) {
    super(item.key);
    this.item = item;
  }
}

export function SlashCommandsPlugin({
  commands = DEFAULT_COMMANDS,
  onSubmit,
}: {
  commands?: SlashCommandItem[];
  onSubmit?: (currentPlainText?: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const checkForSlash = useBasicTypeaheadTriggerMatch(TRIGGER, { minLength: 0, maxLength: 20 });

  const options = useMemo(() => {
    if (!queryString || queryString === '') return commands.map((c) => new SlashMenuOption(c));
    const q = queryString.toLowerCase();
    return commands
      .filter((c) => c.label.toLowerCase().includes(q))
      .map((c) => new SlashMenuOption(c));
  }, [commands, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: SlashMenuOption,
      nodeToReplace: import('lexical').TextNode | null,
      closeMenu: () => void,
      matchingString: string
    ) => {
      const replaceable = TRIGGER + (matchingString || '');
      editor.update(() => {
        if (nodeToReplace) {
          const text = nodeToReplace.getTextContent();
          const newText = text.replace(replaceable, '');
          nodeToReplace.setTextContent(newText);
          if (selectedOption.item.key === 'newline') {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) sel.insertText('\n');
          }
        }
      });
      if (selectedOption.item.key === 'send' && onSubmit) onSubmit(getPlainTextWithMentions(editor));
      else selectedOption.item.onSelect?.(editor);
      closeMenu();
    },
    [editor, onSubmit]
  );

  const triggerFn = useCallback(
    (text: string) => checkForSlash(text, editor),
    [checkForSlash, editor]
  );

  const menuRenderFn = useCallback(
    (
      anchorElementRef: React.RefObject<HTMLElement>,
      itemProps: {
        selectedIndex: number | null;
        selectOptionAndCleanUp: (option: SlashMenuOption) => void;
        setHighlightedIndex: (index: number) => void;
        options: SlashMenuOption[];
      }
    ) => {
      const { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex, options: opts } = itemProps;
      if (anchorElementRef.current == null || opts.length === 0) return null;
      return createPortal(
        <ul
          className="chat-lexical-slash-menu absolute z-50 min-w-[10rem] max-h-[12rem] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-md"
          role="listbox"
          aria-label="命令"
        >
          {opts.map((option, i) => (
            <li
              key={option.key}
              role="option"
              aria-selected={selectedIndex === i}
              className={cn(
                'cursor-pointer px-2 py-1.5 text-sm',
                selectedIndex === i ? 'bg-accent text-accent-foreground' : ''
              )}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                setHighlightedIndex(i);
                selectOptionAndCleanUp(option);
              }}
            >
              {option.item.label}
            </li>
          ))}
        </ul>,
        anchorElementRef.current
      );
    },
    []
  );

  return (
    <LexicalTypeaheadMenuPlugin<SlashMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={menuRenderFn}
      anchorClassName="chat-lexical-slash-anchor"
    />
  );
}
