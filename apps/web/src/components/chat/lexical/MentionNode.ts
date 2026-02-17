/**
 * Lexical 提及节点：存储显示名与 id（contact-xxx / bot-xxx），序列化为纯文本时输出 @displayName。
 * 参考 Lexical playground MentionNode，与 frontend getMentionedBotIdsFromText 约定一致。
 */
import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from 'lexical';

export type SerializedMentionNode = Spread<
  { mentionName: string; mentionId?: string },
  SerializedTextNode
>;

function $convertMentionElement(domNode: HTMLElement): DOMConversionOutput | null {
  const textContent = domNode.textContent;
  const mentionName = domNode.getAttribute('data-lexical-mention-name');
  if (textContent != null) {
    const node = $createMentionNode(
      typeof mentionName === 'string' ? mentionName : textContent,
      textContent
    );
    return { node };
  }
  return null;
}

export class MentionNode extends TextNode {
  __mentionName: string;
  __mentionId?: string;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    const n = new MentionNode(node.__mentionName, node.__text, node.__key);
    n.__mentionId = node.__mentionId;
    return n;
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    const node = $createMentionNode(serialized.mentionName, serialized.text);
    if (serialized.mentionId) node.__mentionId = serialized.mentionId;
    return node.updateFromJSON(serialized) as MentionNode;
  }

  constructor(mentionName: string, text?: string, key?: NodeKey) {
    super(text ?? mentionName, key);
    this.__mentionName = mentionName;
  }

  setMentionId(id: string): this {
    const self = this.getWritable();
    self.__mentionId = id;
    return self;
  }

  exportJSON(): SerializedMentionNode {
    const json = super.exportJSON() as SerializedMentionNode;
    json.mentionName = this.__mentionName;
    if (this.__mentionId) json.mentionId = this.__mentionId;
    return json;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.setAttribute('data-lexical-mention', 'true');
    dom.setAttribute('data-lexical-mention-name', this.__mentionName);
    dom.classList.add('chat-lexical-mention');
    dom.spellcheck = false;
    return dom;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('data-lexical-mention', 'true');
    element.setAttribute('data-lexical-mention-name', this.__mentionName);
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-mention')) return null;
        return { conversion: $convertMentionElement, priority: 1 };
      },
    };
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createMentionNode(
  mentionName: string,
  textContent?: string,
  mentionId?: string
): MentionNode {
  const node = new MentionNode(mentionName, textContent ?? mentionName);
  if (mentionId) node.setMentionId(mentionId);
  node.setMode('segmented').toggleDirectionless();
  return $applyNodeReplacement(node);
}

export function $isMentionNode(
  node: LexicalNode | null | undefined
): node is MentionNode {
  return node instanceof MentionNode;
}
