import { useEffect, useState } from 'react';
import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

/** Logo 图形，与 frontend IconCos.vue 同源；支持 playTrigger 点击播放路径描边动画 */
export function IconCos({
  size = 84,
  color = 'currentColor',
  className,
  playTrigger,
  ...props
}: SVGProps<SVGSVGElement> & {
  size?: number;
  color?: string;
  /** 变化时播放路径描边动画（如页脚点击传入递增数字） */
  playTrigger?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const s = typeof size === 'number' ? size : undefined;

  useEffect(() => {
    if (playTrigger === undefined || playTrigger === 0) return;
    setPlaying(false);
    const raf = requestAnimationFrame(() => setPlaying(true));
    const t = setTimeout(() => setPlaying(false), 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [playTrigger]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 84 55"
      fill="none"
      width={s}
      height={s}
      className={cn('logo-path-draw', playing && 'playing', className)}
      aria-hidden
      {...props}
    >
      <g>
        <path
          fillRule="evenodd"
          fill={color}
          stroke={color}
          strokeWidth={1.5}
          pathLength={1}
          d="M50.7529 53.8421C53.8795 56.1579 58.5693 54.6141 54.2703 50.3684C41.3734 38.0175 44.109 0 28.0857 0C12.0622 0 14.7979 38.0175 1.901 50.3684C-2.78877 55 2.2918 56.1579 5.41834 53.8421C17.5337 45.7368 16.752 24.5088 28.0857 24.5088C39.4193 24.5088 38.6377 45.7368 50.7529 53.8421Z"
          transform="matrix(-1,0,0,-1,70,55)"
        />
        <path
          className="logo-path-line"
          fillRule="evenodd"
          fill={color}
          stroke={color}
          strokeWidth={1.5}
          pathLength={1}
          d="M60.2452 29C60.5851 27.6725 60.9253 26.3363 61.2706 25L82 25C83.1046 25 84 25.8954 84 27C84 28.1046 83.1046 29 82 29L60.2452 29ZM22.5215 25C22.8667 26.3363 23.2069 27.6725 23.5468 29L2 29C0.895432 29 0 28.1046 0 27C0 25.8954 0.895432 25 2 25L22.5215 25ZM41.9235 28.1649C44.4965 28.1649 46.3701 26.9422 47.9115 25L35.9356 25C37.477 26.9422 39.3506 28.1649 41.9235 28.1649Z"
        />
      </g>
    </svg>
  );
}
