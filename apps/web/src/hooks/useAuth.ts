/**
 * 认证状态与操作：从 AuthContext 消费，保证全局唯一状态。
 * 实现见 contexts/AuthContext.tsx；App 根节点需包裹 AuthProvider。
 */
export {
  useAuth,
  type AuthUser,
  type AuthUserRole,
  type AuthMePayload,
} from '@/contexts/AuthContext';
