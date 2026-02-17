import type { LexicalEditor } from 'lexical';
import { $getRoot } from 'lexical';
import type { ElementNode, LexicalNode, TextNode } from 'lexical';
import { $isElementNode, $isLineBreakNode, $isTextNode } from 'lexical';
import { $isMentionNode } from './MentionNode';

/**
 * 将 Lexical 编辑器内容序列化为纯文本，提及节点输出为 @显示名，与 getMentionedBotIdsFromText 约定一致。
 * 必须在 editor.getEditorState().read() 外调用，内部会执行 read。
 */
export function getPlainTextWithMentions(editor: LexicalEditor): string {
  let result = '';
  editor.getEditorState().read(() => {
    result = $getPlainTextWithMentionsFromRoot($getRoot());
  });
  return result;
}

/**
 * 在 editorState.read() 内调用，从 root 递归收集纯文本（含 @显示名）。
 */
export function $getPlainTextWithMentionsFromRoot(root: ElementNode): string {
  return root.getChildren().map(collectTextFromNode).join('');
}

function collectTextFromNode(node: LexicalNode): string {
  if ($isMentionNode(node)) return '@' + (node as { __mentionName: string }).__mentionName;
  if ($isTextNode(node)) return (node as TextNode).getTextContent();
  if ($isLineBreakNode(node)) return '\n';
  if ($isElementNode(node)) return (node as ElementNode).getChildren().map(collectTextFromNode).join('');
  return '';
}
