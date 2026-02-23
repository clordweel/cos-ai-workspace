/**
 * 关联应用契约：候选、已选、线段 payload（与方案 B 及扩展预览/摘要对齐）
 */

/** 关联段 payload（方案 B 定界符内 JSON；与 API/Matrix 存贮一致用 snake_case） */
export interface AssociationPayload {
  app_id: string;
  entity_type: string;
  entity_id: string;
  /** 展示用标题，必填 */
  title: string;
  /** 摘要/描述，无预览时展示 */
  summary?: string;
  /** 可嵌入预览页 URL */
  preview_url?: string;
}

/** 扩展提供的可关联候选（前端用 camelCase） */
export interface AssociationCandidate {
  appId: string;
  entityType: string;
  entityId: string;
  title: string;
  summary?: string;
  previewUrl?: string;
}

/** 已选关联项（输入框 chip、待发列表） */
export type AssociationItem = AssociationCandidate;

/** 转为 API/定界符内使用的 payload */
export function toAssociationPayload(item: AssociationItem): AssociationPayload {
  return {
    app_id: item.appId,
    entity_type: item.entityType,
    entity_id: item.entityId,
    title: item.title,
    summary: item.summary,
    preview_url: item.previewUrl,
  };
}

/** 从 payload 转为前端项 */
export function fromAssociationPayload(p: AssociationPayload): AssociationItem {
  return {
    appId: p.app_id,
    entityType: p.entity_type,
    entityId: p.entity_id,
    title: p.title,
    summary: p.summary,
    previewUrl: p.preview_url,
  };
}
