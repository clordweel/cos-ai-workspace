import { type ReactNode } from 'react';
import { clsx } from 'clsx';

export type PageGridProps = {
  /** 子区块；建议使用 Block 组件 */
  children: ReactNode;
  /** 网格列数（CSS grid-template-columns）；不传则用响应式 class：grid-cols-1 md:grid-cols-2 */
  columns?: string;
  /** 行模板（仅在使用 columns 时生效） */
  rows?: string;
  /** 间距，默认 gap-4 */
  gap?: string;
  className?: string;
};

/**
 * 页面级 grid 容器。主内容区使用此布局，子区块用 Block 获得容器查询能力。
 */
export function PageGrid({
  children,
  columns,
  rows = 'minmax(0, 1fr)',
  gap = 'gap-4',
  className,
}: PageGridProps) {
  const useStyle = columns != null;
  return (
    <div
      className={clsx(
        'grid min-h-0 w-full',
        gap,
        !useStyle && 'grid-cols-1 grid-rows-[minmax(0,1fr)] md:grid-cols-2',
        className
      )}
      style={
        useStyle
          ? { gridTemplateColumns: columns, gridTemplateRows: rows }
          : undefined
      }
    >
      {children}
    </div>
  );
}
