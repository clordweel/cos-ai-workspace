import WorkspaceLayout from '../components/WorkspaceLayout';
import WorkspaceEntry from '../components/WorkspaceEntry';

/**
 * 首页：工作区入口，选择组织或个人工作区后进入 /space/:id。
 */
export default function Home() {
  return (
    <WorkspaceLayout>
      <WorkspaceEntry />
    </WorkspaceLayout>
  );
}
