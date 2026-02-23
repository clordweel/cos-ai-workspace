/**
 * 方案 B：定界符常量与 body 解析（与 apps/web 一致）
 */
import type { AssociationPayload } from '../types/associations.js';

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'association'; payload: AssociationPayload };

export const ASSOC_OPEN = '[ASSOC]';
export const ASSOC_CLOSE = '[/ASSOC]';

/** 从 body 解析出线段数组；解析失败处保留为 text */
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
      segments.push({ type: 'text', content: ASSOC_OPEN + rest });
      break;
    }
    const raw = rest.slice(0, closeIdx).trim();
    rest = rest.slice(closeIdx + ASSOC_CLOSE.length);
    try {
      const payload = JSON.parse(raw) as AssociationPayload;
      if (payload && typeof payload.app_id === 'string' && typeof payload.entity_id === 'string') {
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
