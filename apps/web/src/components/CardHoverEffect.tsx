import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type CardHoverEffectItem = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  /** 主操作区（如按钮组） */
  actions: ReactNode;
};

type CardHoverEffectProps = {
  items: CardHoverEffectItem[];
  className?: string;
  /** 卡片容器类名 */
  cardClassName?: string;
};

/**
 * 工作区选择卡片组：悬停时滑动高亮到当前卡片（Aceternity Card Hover Effect 风格）。
 * 大屏下为等宽三列，小屏为单列/双列无滑动效果。
 */
export function CardHoverEffect({
  items,
  className,
  cardClassName,
}: CardHoverEffectProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number>(0);

  const columns = Math.min(items.length, 3);
  const slideWidthPercent = 100 / columns;

  return (
    <div
      className={cn('relative min-h-0 w-full', className)}
      onMouseLeave={() => setHoveredIndex(0)}
    >
      {/* 大屏下：滑动高亮背景，不参与网格布局 */}
      <motion.div
        className="pointer-events-none absolute inset-0 hidden rounded-xl lg:block"
        initial={false}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        aria-hidden
      >
        <motion.div
          className="h-full rounded-xl bg-primary/8 dark:bg-primary/12"
          style={{ width: `${slideWidthPercent}%` }}
          animate={{ x: `${hoveredIndex * slideWidthPercent}%` }}
        />
      </motion.div>
      <div className="@container relative grid min-h-0 w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'relative flex min-h-[200px] flex-col rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-shadow @md:min-h-[220px] @lg:p-6',
            cardClassName
          )}
          onMouseEnter={() => setHoveredIndex(index)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3 @sm:flex-row @sm:items-center @md:flex-col @md:items-stretch">
            <div className="flex shrink-0 items-center gap-3 @sm:min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {item.icon}
              </div>
              <div className="min-w-0">
                <h2 className="font-medium text-foreground">{item.title}</h2>
                <p className="text-sm text-muted-foreground @sm:text-xs @md:text-sm">
                  {item.description}
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 @sm:ml-auto @sm:mt-0 @md:ml-0 @md:mt-auto">
              {item.actions}
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
