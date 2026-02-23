/**
 * 可关联候选数据（测试应用与关联选择器共用）
 * 扩展应用提供后，可由此处或 API 获取候选列表
 */
import type { AssociationItem } from '@/types/associations';

export const MOCK_MEMOS: AssociationItem[] = [
  { appId: 'memo-test', entityType: 'memo', entityId: '1', title: '周会要点', summary: '1. 进度同步 2. 下周目标 3. 风险项' },
  { appId: 'memo-test', entityType: 'memo', entityId: '2', title: '产品需求草稿', summary: '新功能：关联到会话后由 AI 总结与拆任务' },
  { appId: 'memo-test', entityType: 'memo', entityId: '3', title: '待办清单', summary: '完成关联测试应用、验证方案 B 消息展示' },
];

export const MOCK_TASKS: AssociationItem[] = [
  { appId: 'task-test', entityType: 'task', entityId: 't1', title: '完成关联功能联调', summary: '前端 + API + MessageTile 方案 B 全链路' },
  { appId: 'task-test', entityType: 'task', entityId: 't2', title: '编写扩展契约文档', summary: '预览/摘要与 getAssociationCandidates 约定' },
  { appId: 'task-test', entityType: 'task', entityId: 't3', title: '添加关联选择 Typeahead', summary: '输入 # 触发可选关联列表（后续迭代）' },
];

/** 关联选择器中展示的候选列表（按应用分组：备忘录、任务） */
export const ASSOCIATION_CANDIDATES: AssociationItem[] = [...MOCK_MEMOS, ...MOCK_TASKS];
