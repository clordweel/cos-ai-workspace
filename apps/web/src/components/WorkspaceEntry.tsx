import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExpandableCard, type ExpandableCardItem } from '@/components/ui/expandable-card';
import { Building2, LayoutDashboard, Globe, Plus, Settings2 } from 'lucide-react';
import { setLastWorkspaceId, DEFAULT_PUBLIC_WORKSPACE_ID } from '@/lib/workspaceStorage';

/**
 * 工作区入口：选择组织、个人工作区或公开工作区。
 * 列表顶部为管理操作；详情卡片内统一为「打开」按钮。
 */
export default function WorkspaceEntry() {
  const navigate = useNavigate();

  const enterWorkspace = (id: string) => {
    setLastWorkspaceId(id);
    navigate(`/space/${id}`);
  };

  const items: ExpandableCardItem[] = [
    {
      id: DEFAULT_PUBLIC_WORKSPACE_ID,
      title: '公开工作区',
      description: '无需登录即可浏览的公共空间',
      media: <Globe className="size-8 md:size-6" aria-hidden />,
      separatorAfter: true,
      deletable: false,
      actions: (
        <Button
          variant="default"
          size="sm"
          className="shrink-0"
          onClick={() => enterWorkspace(DEFAULT_PUBLIC_WORKSPACE_ID)}
        >
          打开
        </Button>
      ),
      content: () => (
        <p className="text-sm">
          公开工作区面向所有访客开放，可浏览公共会话与内容，无需登录。登录后可使用更多能力。
        </p>
      ),
    },
    {
      id: 'org',
      title: '组织',
      description: '选择或管理你加入的组织',
      media: <Building2 className="size-8 md:size-6" aria-hidden />,
      actions: (
        <Button
          variant="default"
          size="sm"
          className="shrink-0"
          onClick={() => enterWorkspace('org')}
        >
          打开
        </Button>
      ),
      content: () => (
        <p className="text-sm">
          在组织工作区中，你可以查看并管理已加入的组织，或创建、加入新组织。组织内成员可共享会话与资源。
        </p>
      ),
    },
    {
      id: 'me',
      title: '个人工作区',
      description: '创建或进入自己的工作区',
      media: <LayoutDashboard className="size-8 md:size-6" aria-hidden />,
      actions: (
        <Button
          variant="default"
          size="sm"
          className="shrink-0"
          onClick={() => enterWorkspace('me')}
        >
          打开
        </Button>
      ),
      content: () => (
        <p className="text-sm">
          个人工作区仅属于你，可在此创建会话、管理对话与任务。支持多设备同步。
        </p>
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-auto p-5 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex shrink-0 justify-end gap-8 md:mb-8">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
            创建
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            <Settings2 className="size-4" aria-hidden />
            管理
          </button>
        </div>
      </div>
      <ExpandableCard
        items={items}
        listClassName="flex flex-col gap-1"
        onEnterClick={(item) => enterWorkspace(item.id)}
      />
    </div>
  );
}
