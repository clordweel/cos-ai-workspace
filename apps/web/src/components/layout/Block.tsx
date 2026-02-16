import { type ReactNode } from 'react';
import { clsx } from 'clsx';

export type BlockProps = {
  children: ReactNode;
  /** 容器名，用于命名容器查询，避免多容器冲突；如 'card' 则子元素用 @sm/card: */
  containerName?: string;
  /** 是否作为 grid 子项撑满单元格 */
  fill?: boolean;
  /** 最小高度，如 min-h-[200px] */
  minHeight?: string;
  className?: string;
};

/**
 * 区块容器：带 @container，子元素可用 Tailwind 容器查询变体（@sm:、@md: 等）响应本区块尺寸。
 * 作为 PageGrid 子项使用时，可设 fill 以 min-h-0 flex-1 overflow-auto 撑满格子。
 */
export function Block({
  children,
  containerName,
  fill = true,
  minHeight,
  className,
}: BlockProps) {
  return (
    <section
      className={clsx(
        '@container',
        fill && 'min-h-0 flex flex-col overflow-hidden',
        minHeight,
        className
      )}
      style={containerName ? { containerName } : undefined}
      aria-label={undefined}
    >
      {children}
    </section>
  );
}
