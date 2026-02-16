import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCos } from '@/components/icons/IconCos';
import { IconCosAi } from '@/components/icons/IconCosAi';
import { BookOpen, Github, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/', label: '首页' },
  { to: '/space', label: '工作区' },
  { to: '#', label: '帮助' },
  { to: '#', label: '关于' },
  { to: '#', label: '隐私' },
  { to: '#', label: '条款' },
];

const SOCIAL_LINKS = [
  { href: 'https://weibo.com', icon: MessageCircle, label: '微博' },
  { href: 'https://www.zhihu.com', icon: BookOpen, label: '知乎' },
  { href: 'https://github.com', icon: Github, label: 'GitHub' },
];

/**
 * 页面 Footer：参考 DevStudio 风格，品牌 Logo（IconCos + IconCosAi）、导航链接、虚线分隔、版权与社交图标。
 */
export function PageFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  const [logoPlayTrigger, setLogoPlayTrigger] = useState(0);

  return (
    <footer
      role="contentinfo"
      aria-label="页脚"
      className={cn('shrink-0 bg-transparent py-5', className)}
    >
      <div className="flex w-full flex-col items-center px-4">
        {/* 品牌：Logo + 字标（点击播放路径描边动画） */}
        <button
          type="button"
          onClick={() => setLogoPlayTrigger((t) => t + 1)}
          className="flex cursor-pointer items-center gap-2 py-2 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="播放 Logo 动画"
        >
          <IconCos
            size={28}
            color="currentColor"
            className="shrink-0"
            playTrigger={logoPlayTrigger}
          />
          <IconCosAi
            width={70}
            height={12}
            color="currentColor"
            className="shrink-0 overflow-visible"
            playTrigger={logoPlayTrigger}
          />
        </button>
        {/* 导航链接 */}
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-1 text-sm text-muted-foreground"
          aria-label="页脚导航"
        >
          {NAV_LINKS.map(({ to, label }) =>
            to.startsWith('#') ? (
              <a
                key={label}
                href={to}
                className="transition-colors hover:text-foreground"
                onClick={(e) => e.preventDefault()}
              >
                {label}
              </a>
            ) : (
              <Link key={label} to={to} className="transition-colors hover:text-foreground">
                {label}
              </Link>
            )
          )}
        </nav>
        {/* 虚线分隔 */}
        <div
          className="my-3 w-full border-t border-dashed border-border"
          role="separator"
          aria-hidden
        />
        {/* 版权（左） + 备案（居中） + 社交图标（右） */}
        <div className="relative flex w-full items-center justify-between gap-4">
          <p className="shrink-0 text-sm text-muted-foreground">
            © {year} COS&AI · 智能交互工作台
          </p>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute left-1/2 -translate-x-1/2 shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            京ICP备xxxxxxxx号
          </a>
          <div className="flex shrink-0 items-center gap-5">
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={label}
              >
                <Icon className="size-5" strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
