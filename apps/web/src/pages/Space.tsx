import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEffectiveWorkspaceId, setLastWorkspaceId } from '@/lib/workspaceStorage';

/**
 * 工作区页：/space 进入上次工作空间（无则默认公开工作区）并重定向到 /space/:id；/space/:id 为工作区内容（占位）。
 */
export default function Space() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id != null && id.length > 0) {
      setLastWorkspaceId(id);
      return;
    }
    const targetId = getEffectiveWorkspaceId();
    navigate(`/space/${targetId}`, { replace: true });
  }, [id, navigate]);

  if (id == null || id.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center p-4 text-muted-foreground">
      <p>工作区「{id}」页面开发中</p>
    </div>
  );
}
