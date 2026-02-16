'use client';

import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';
import { cn } from '@/lib/utils';

/** 可调整大小的面板组，基于 react-resizable-panels */
function ResizablePanelGroup({
  className,
  orientation = 'horizontal',
  ...props
}: GroupProps) {
  return (
    <Group
      className={cn('flex min-h-0 min-w-0 data-[orientation=horizontal]:w-full', className)}
      orientation={orientation}
      {...props}
    />
  );
}

/** 可调整大小的单个面板；contain-layout 减少拖拽时布局重算范围以提升顺滑度 */
function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <Panel
      className={cn('min-h-0 min-w-0 [contain:layout]', className)}
      {...props}
    />
  );
}

/** 面板之间的拖拽分隔条 */
function ResizableHandle({ className, ...props }: SeparatorProps) {
  return (
    <Separator
      className={cn(
        'shrink-0 bg-border transition-colors',
        'data-[orientation=horizontal]:w-px data-[orientation=horizontal]:cursor-col-resize data-[orientation=horizontal]:hover:bg-primary/30 data-[orientation=horizontal]:data-[resize-handle-active]:bg-primary/50',
        'data-[orientation=vertical]:h-px data-[orientation=vertical]:cursor-row-resize data-[orientation=vertical]:hover:bg-primary/30 data-[orientation=vertical]:data-[resize-handle-active]:bg-primary/50',
        className
      )}
      data-separator
      {...props}
    />
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
