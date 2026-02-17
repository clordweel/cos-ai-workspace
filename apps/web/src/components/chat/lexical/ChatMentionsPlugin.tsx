'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { TextNode } from 'lexical';
import { useCallback, useMemo, useState } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { $createMentionNode } from './MentionNode';
import type { MentionItem } from '@/hooks/useContactsAndBots';

const TRIGGER = '@';
const SUGGESTION_LIST_LENGTH_LIMIT = 8;

class MentionMenuOption extends MenuOption {
  id: string;
  display: string;
  constructor(id: string, display: string) {
    super(display);
    this.id = id;
    this.display = display;
  }
}

export function ChatMentionsPlugin({ mentionItems }: { mentionItems: MentionItem[] }) {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const checkForAtMatch = useBasicTypeaheadTriggerMatch(TRIGGER, { minLength: 0, maxLength: 50 });

  const triggerFn = useCallback(
    (text: string) => checkForAtMatch(text, editor),
    [checkForAtMatch, editor]
  );

  const options = useMemo(() => {
    if (queryString == null || queryString === '') {
      return mentionItems.slice(0, SUGGESTION_LIST_LENGTH_LIMIT).map((m) => new MentionMenuOption(m.id, m.display));
    }
    const q = queryString.toLowerCase();
    return mentionItems
      .filter((m) => m.display.toLowerCase().includes(q))
      .slice(0, SUGGESTION_LIST_LENGTH_LIMIT)
      .map((m) => new MentionMenuOption(m.id, m.display));
  }, [mentionItems, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: MentionMenuOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        const mentionNode = $createMentionNode(
          selectedOption.display,
          selectedOption.display,
          selectedOption.id
        );
        if (nodeToReplace) nodeToReplace.replace(mentionNode);
        mentionNode.select();
        closeMenu();
      });
    },
    [editor]
  );

  const menuRenderFn = useCallback(
    (
      anchorElementRef: React.RefObject<HTMLElement>,
      itemProps: {
        selectedIndex: number | null;
        selectOptionAndCleanUp: (option: MentionMenuOption) => void;
        setHighlightedIndex: (index: number) => void;
        options: MentionMenuOption[];
      }
    ) => {
      const { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex, options: opts } = itemProps;
      if (anchorElementRef.current == null || opts.length === 0) return null;
      return createPortal(
        <ul
          className="chat-lexical-mentions-menu absolute z-50 min-w-[10rem] max-h-[12rem] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-md"
          role="listbox"
          aria-label="提及联系人或 AI 助手"
        >
          {opts.map((option, i) => (
            <li
              key={option.key}
              role="option"
              aria-selected={selectedIndex === i}
              className={`cursor-pointer px-2 py-1.5 text-sm ${selectedIndex === i ? 'bg-accent text-accent-foreground' : ''}`}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                setHighlightedIndex(i);
                selectOptionAndCleanUp(option);
              }}
            >
              {option.display}
            </li>
          ))}
        </ul>,
        anchorElementRef.current
      );
    },
    []
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={menuRenderFn}
      anchorClassName="chat-lexical-mentions-anchor"
    />
  );
}
