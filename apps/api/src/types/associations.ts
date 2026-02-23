/**
 * 关联应用契约：方案 B 定界符内 JSON payload（与 apps/web 同构，snake_case）
 */

export interface AssociationPayload {
  app_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  summary?: string;
  preview_url?: string;
}
