import type { LexicalEditor } from 'lexical';
import { $getRoot } from 'lexical';
import type { ElementNode, LexicalNode, TextNode } from 'lexical';
import { $isElementNode, $isLineBreakNode, $isTextNode } from 'lexical';
import { $isMentionNode } from './MentionNode';

/** Lexical TextNode 格式位（与 FORMAT_TEXT_COMMAND 一致） */
const FMT_BOLD = 1;
const FMT_ITALIC = 2;
const FMT_CODE = 16;

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
 * 将 Lexical 编辑器内容序列化为 Markdown（粗体 **、斜体 *、行内代码 `），提及仍为 @显示名。
 * 用于发送到 API，再由服务端转为 HTML 写入 Matrix formatted_body，便于 Element 等客户端正确显示格式。
 */
export function getMarkdownWithMentions(editor: LexicalEditor): string {
  let result = '';
  editor.getEditorState().read(() => {
    result = $getMarkdownWithMentionsFromRoot($getRoot());
  });
  return result;
}

/**
 * 在 editorState.read() 内调用，从 root 递归收集纯文本（含 @显示名）。
 */
export function $getPlainTextWithMentionsFromRoot(root: ElementNode): string {
  return root.getChildren().map(collectTextFromNode).join('');
}

/**
 * 在 editorState.read() 内调用，从 root 递归收集 Markdown（含格式与 @显示名）。
 */
function $getMarkdownWithMentionsFromRoot(root: ElementNode): string {
  return root.getChildren().map(collectMarkdownFromNode).join('');
}

function collectTextFromNode(node: LexicalNode): string {
  if ($isMentionNode(node)) return '@' + (node as { __mentionName: string }).__mentionName;
  if ($isTextNode(node)) return (node as TextNode).getTextContent();
  if ($isLineBreakNode(node)) return '\n';
  if ($isElementNode(node)) return (node as ElementNode).getChildren().map(collectTextFromNode).join('');
  return '';
}

function collectMarkdownFromNode(node: LexicalNode): string {
  if ($isMentionNode(node)) return '@' + (node as { __mentionName: string }).__mentionName;
  if ($isTextNode(node)) {
    const text = (node as TextNode).getTextContent();
    const format = typeof (node as TextNode).getFormat === 'function' ? (node as TextNode).getFormat() : 0;
    if (!text) return '';
    let out = escapeMarkdownInline(text);
    if (format & FMT_CODE) out = '`' + out + '`';
    if (format & FMT_BOLD) out = '**' + out + '**';
    if (format & FMT_ITALIC) out = '*' + out + '*';
    return out;
  }
  if ($isLineBreakNode(node)) return '\n';
  if ($isElementNode(node)) {
    const children = (node as ElementNode).getChildren().map(collectMarkdownFromNode).join('');
    const tag = (node as ElementNode).getType?.();
    if (tag === 'paragraph') return children + '\n';
    return children;
  }
  return '';
}

/** 避免内容中的 * ` 破坏 Markdown 边界（仅对可能闭合格式的字符转义） */
function escapeMarkdownInline(s: string): string {
  return s.replace(/\*/g, '\\*').replace(/`/g, '\\`');
}
