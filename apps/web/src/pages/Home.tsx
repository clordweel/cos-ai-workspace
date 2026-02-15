import WorkspaceLayout from '../components/WorkspaceLayout';

export default function Home() {
  return (
    <WorkspaceLayout>
      <div className="p-4 flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          COS&AI 工作空间
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          重构版前端（apps/web）。阶段 2：认证与布局已就绪。
        </p>
        <nav className="flex items-center gap-3 text-sm">
          <a
            href="/space"
            className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            会话
          </a>
          <span className="text-zinc-400 dark:text-zinc-500">·</span>
          <a
            href="/logto"
            className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            登录
          </a>
        </nav>
      </div>
    </WorkspaceLayout>
  );
}
