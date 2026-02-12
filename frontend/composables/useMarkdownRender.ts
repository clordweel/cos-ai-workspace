/**
 * 消息 Markdown 渲染：解析 + 净化，供气泡内安全展示。
 * 流程：原始文本 → markdown-it → HTML → DOMPurify.sanitize → 安全 HTML。
 * @see docs/MESSAGE_MARKDOWN_RENDERING.md
 */

import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'

let md: MarkdownIt | null = null

function getMarkdownIt(): MarkdownIt {
  if (!md) {
    md = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
      typographer: true,
    })
  }
  return md
}

/** DOMPurify 配置：允许的链接属性（如 target），禁止脚本与事件 */
const SANITIZE_OPTIONS = {
  ADD_ATTR: ['target', 'rel'],
  ALLOWED_TAGS: [
    'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr',
  ],
  ALLOW_DATA_ATTR: false,
} as const

/**
 * 仅净化 HTML（如 Matrix formatted_body），不解析 Markdown。
 * SSR 与客户端均可用（isomorphic-dompurify）。
 */
function sanitizeHtml(html: string): string {
  if (!html.trim()) return ''
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS)
}

/**
 * 将纯文本转为安全 HTML：先 Markdown 解析，再 DOMPurify 净化。
 * 仅在非流式、完整内容上使用；SSR 与客户端均可用（isomorphic-dompurify）。
 */
export function useMarkdownRender() {
  const render = (content: string): string => {
    if (!content.trim()) return ''
    const rawHtml = getMarkdownIt().render(content)
    return DOMPurify.sanitize(rawHtml, SANITIZE_OPTIONS)
  }

  /** 有 formattedBody 时调用：仅净化 HTML，不解析 Markdown */
  const renderFormattedBody = (html: string): string => sanitizeHtml(html)

  return { render, renderFormattedBody }
}
