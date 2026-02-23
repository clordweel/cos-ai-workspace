/**
 * 方案 B：消息线段类型与定界符解析
 * body = 可读文本 + [ASSOC]{...}[/ASSOC] 内 JSON
 */

import type { AssociationPayload } from '@/types/associations';

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'association'; payload: AssociationPayload };

/** 定界符：方案 B 约定 */
export const ASSOC_OPEN = '[ASSOC]';
export const ASSOC_CLOSE = '[/ASSOC]';

/** 将解析出的 JSON 规范为 AssociationPayload，兼容 snake_case / camelCase / 全小写（如 API 返回的 entityid） */
function normalizeAssociationPayload(raw: Record<string, unknown>): AssociationPayload | null {
  const appId = (raw.app_id ?? raw.appid) as string | undefined;
  const entityType = (raw.entity_type ?? raw.entitytype) as string | undefined;
  const entityId = (raw.entity_id ?? raw.entityId ?? raw.entityid) as string | undefined;
  const title = (raw.title ?? raw.Title) as string | undefined;
  if (typeof appId !== 'string' || typeof entityId !== 'string') return null;
  return {
    app_id: appId,
    entity_type: typeof entityType === 'string' ? entityType : 'unknown',
    entity_id: entityId,
    title: typeof title === 'string' ? title : entityId,
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    preview_url: typeof raw.preview_url === 'string' ? raw.preview_url : undefined,
  };
}

/** 从 body 解析出线段数组（支持端用）；解析失败时返回单段 text */
export function parseMessageBodyToSegments(body: string): MessageSegment[] {
  if (typeof body !== 'string' || !body.length) {
    return [];
  }
  const segments: MessageSegment[] = [];
  let rest = body;
  while (rest.length > 0) {
    const openIdx = rest.indexOf(ASSOC_OPEN);
    if (openIdx === -1) {
      segments.push({ type: 'text', content: rest });
      break;
    }
    if (openIdx > 0) {
      segments.push({ type: 'text', content: rest.slice(0, openIdx) });
    }
    rest = rest.slice(openIdx + ASSOC_OPEN.length);
    const closeIdx = rest.indexOf(ASSOC_CLOSE);
    if (closeIdx === -1) {
      // 未闭合，剩余全部当文本
      segments.push({ type: 'text', content: ASSOC_OPEN + rest });
      break;
    }
    const raw = rest.slice(0, closeIdx).trim();
    rest = rest.slice(closeIdx + ASSOC_CLOSE.length);
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const payload = normalizeAssociationPayload(parsed);
      if (payload) {
        segments.push({ type: 'association', payload });
      } else {
        segments.push({ type: 'text', content: ASSOC_OPEN + raw + ASSOC_CLOSE });
      }
    } catch {
      segments.push({ type: 'text', content: ASSOC_OPEN + raw + ASSOC_CLOSE });
    }
  }
  return segments;
}

/** 将线段序列序列化为方案 B 的 body 字符串 */
export function serializeSegmentsToMessageBody(segments: MessageSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'text') return s.content;
      return ASSOC_OPEN + JSON.stringify(s.payload) + ASSOC_CLOSE;
    })
    .join('');
}
