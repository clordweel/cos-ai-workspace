import { Link } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';

/**
 * 首页：界面已清空待重写
 */
export default function Home() {
  return (
    <WorkspaceLayout>
      <div className="h-full flex items-center justify-center p-4">
        <Link to="/space" className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
          进入 Space
        </Link>
      </div>
    </WorkspaceLayout>
  );
}
