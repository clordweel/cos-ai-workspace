/**
 * 消息文本处理：独立能力，供发送/流式等流程复用。
 * - 解析指令：如 [@id="assistant" label="AI 助手"]
 * - Markdown → HTML（再净化），产出 body（纯文本）与 formattedBody（安全 HTML）
 * @see docs/MATRIX_MARKDOWN_AND_FORMATTED_BODY.md
 */

import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'

const INSTRUCTION_REGEX = /\[@\s*([^\]]+)\]/g

/** 单条指令的解析结果（至少包含 id / label 等键值） */
export type ParsedInstruction = Record<string, string>

/** 段：要么是普通文本，要么是指令 */
type Segment =
  | { type: 'text'; value: string }
  | { type: 'instruction'; attrs: ParsedInstruction }

/** 处理结果 */
export interface ProcessedMessageText {
  /** 纯文本，指令处用 label 或 id 替代，用于 body / 通知 / 搜索 */
  body: string
  /** 安全 HTML，用于 formatted_body；含 Markdown 与指令的 span 占位 */
  formattedBody: string
  /** 解析到的指令列表，便于路由/业务使用 */
  instructions: ParsedInstruction[]
}

/**
 * 解析一段指令内容，如：id="assistant" label="AI 助手"
 * 支持 key="value" 与 key='value'，返回键值对象。
 */
function parseInstructionAttrs(inner: string): ParsedInstruction {
  const attrs: ParsedInstruction = {}
  const pairRegex = /(\w+)\s*=\s*["']([^"']*)["']/g
  let m: RegExpExecArray | null
  while ((m = pairRegex.exec(inner)) !== null) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

/**
 * 将原始消息拆成「文本 | 指令」交替的段。
 */
function segmentize(raw: string): Segment[] {
  const segments: Segment[] = []
  let lastEnd = 0
  let m: RegExpExecArray | null
  INSTRUCTION_REGEX.lastIndex = 0
  while ((m = INSTRUCTION_REGEX.exec(raw)) !== null) {
    if (m.index > lastEnd) {
      segments.push({ type: 'text', value: raw.slice(lastEnd, m.index) })
    }
    const attrs = parseInstructionAttrs(m[1])
    segments.push({ type: 'instruction', attrs })
    lastEnd = m.index + m[0].length
  }
  if (lastEnd < raw.length) {
    segments.push({ type: 'text', value: raw.slice(lastEnd) })
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: raw }]
}

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

/** 净化 HTML 时的白名单（与前端一致，并允许指令 span 的 data-*） */
const SANITIZE_OPTIONS = {
  ADD_ATTR: ['target', 'rel', 'data-id', 'data-label'] as string[],
  ALLOWED_TAGS: [
    'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr',
  ] as string[],
  ALLOW_DATA_ATTR: true,
}

function sanitizeHtml(html: string): string {
  if (!html.trim()) return ''
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS)
}

function markdownToHtml(text: string): string {
  if (!text.trim()) return ''
  return getMarkdownIt().render(text)
}

/**
 * 处理一条可能含 Markdown 与指令的消息文本。
 * - body：纯文本，指令用 label 或 id 替代，便于通知/搜索。
 * - formattedBody：安全 HTML，指令渲染为带 data-id/data-label 的 span。
 * - instructions：解析到的指令列表。
 */
export function processMessageText(raw: string): ProcessedMessageText {
  const segments = segmentize(raw)
  const instructions: ParsedInstruction[] = []

  const bodyParts: string[] = []
  const formattedParts: string[] = []

  for (const seg of segments) {
    if (seg.type === 'text') {
      bodyParts.push(seg.value)
      const html = markdownToHtml(seg.value)
      formattedParts.push(html)
    } else {
      const { id = '', label = '' } = seg.attrs
      instructions.push(seg.attrs)
      const display = label || id || ''
      bodyParts.push(display)
      const span = `<span class="msg-instruction" data-id="${escapeHtml(id)}" data-label="${escapeHtml(label)}">${escapeHtml(display)}</span>`
      formattedParts.push(span)
    }
  }

  const body = bodyParts.join('').trim() || raw.trim()
  const rawFormatted = formattedParts.join('')
  const formattedBody = rawFormatted ? sanitizeHtml(rawFormatted) : ''

  return { body, formattedBody, instructions }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
