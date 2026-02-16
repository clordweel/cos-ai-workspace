'use client';

import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { cn } from '@/lib/utils';

export type ExpandableCardItem = {
  id: string;
  title: string;
  description: string;
  /** 图片 URL，与 media 二选一 */
  src?: string;
  /** 自定义媒体区（图标等），与 src 二选一 */
  media?: ReactNode;
  ctaText?: string;
  ctaLink?: string;
  /** 展开区内容（函数或节点） */
  content?: ReactNode | (() => ReactNode);
  /** 展开区自定义操作（覆盖 ctaText/ctaLink） */
  actions?: ReactNode;
  /** 该项下方显示分隔线，用于与后续项区隔 */
  separatorAfter?: boolean;
  /** 是否可删除，默认 true；设为 false 时后续删除 UI 不展示 */
  deletable?: boolean;
};

type ExpandableCardProps = {
  items: ExpandableCardItem[];
  className?: string;
  listClassName?: string;
  /** 列表项类名 */
  itemClassName?: string;
  /** 若提供，列表右侧统一显示「打开」，点击直接调用该回调且不展开详情；点击条目其它区域才展开 */
  onEnterClick?: (item: ExpandableCardItem) => void;
};

function CloseIcon() {
  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.05 } }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-foreground"
      aria-hidden
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </motion.svg>
  );
}

export function ExpandableCard({
  items,
  className,
  listClassName,
  itemClassName,
  onEnterClick,
}: ExpandableCardProps) {
  const [active, setActive] = useState<ExpandableCardItem | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setActive(null);
    }
    if (active) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  useOutsideClick(ref, () => setActive(null));

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 h-full w-full bg-black/20"
            aria-hidden
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {active ? (
          <div className="fixed inset-0 z-[100] grid place-items-center">
            <motion.button
              key={`button-${active.title}-${id}`}
              type="button"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.05 } }}
              className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-background lg:hidden"
              onClick={() => setActive(null)}
              aria-label="关闭"
            >
              <CloseIcon />
            </motion.button>
            <motion.div
              layoutId={`card-${active.id}-${id}`}
              ref={ref}
              className={cn(
                'flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-card text-card-foreground',
                'md:h-fit md:max-h-[90%] sm:rounded-3xl'
              )}
            >
              <motion.div layoutId={`media-${active.id}-${id}`}>
                {active.src ? (
                  <img
                    width={200}
                    height={200}
                    src={active.src}
                    alt={active.title}
                    className="h-80 w-full object-cover object-top sm:rounded-tl-lg sm:rounded-tr-lg lg:h-80"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-primary/10 sm:rounded-tl-lg sm:rounded-tr-lg lg:h-52">
                    {active.media}
                  </div>
                )}
              </motion.div>
              <div>
                <div className="flex items-start justify-between p-4">
                  <div>
                    <motion.h3
                      layoutId={`title-${active.id}-${id}`}
                      className="font-bold text-foreground"
                    >
                      {active.title}
                    </motion.h3>
                    <motion.p
                      layoutId={`description-${active.id}-${id}`}
                      className="text-muted-foreground"
                    >
                      {active.description}
                    </motion.p>
                  </div>
                  {active.actions != null ? (
                    <motion.div
                      layoutId={`cta-${active.id}-${id}`}
                      className="flex shrink-0 gap-2"
                    >
                      {active.actions}
                    </motion.div>
                  ) : active.ctaLink && active.ctaText ? (
                    <motion.a
                      layoutId={`cta-${active.id}-${id}`}
                      href={active.ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
                    >
                      {active.ctaText}
                    </motion.a>
                  ) : null}
                </div>
                {active.content != null && (
                  <div className="relative px-4 pt-4 pb-10">
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex h-40 flex-col items-start gap-4 overflow-auto text-muted-foreground [mask:linear-gradient(to_bottom,white,white,transparent)] [scrollbar-width:none] md:h-fit md:text-sm [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] lg:text-base"
                    >
                      {typeof active.content === 'function'
                        ? active.content()
                        : active.content}
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <ul className={cn('mx-auto w-full max-w-2xl gap-4', listClassName, className)}>
        {items.map((card) => (
          <li key={`card-${card.id}-${id}`} className="list-none">
            <motion.div
              layoutId={`card-${card.id}-${id}`}
              role="button"
              tabIndex={0}
              onClick={() => setActive(card)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActive(card);
                }
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center rounded-lg p-4 transition-colors hover:bg-muted/40 md:flex-row md:justify-between',
                itemClassName
              )}
            >
              <div className="flex flex-col gap-4 md:flex-row">
                <motion.div layoutId={`media-${card.id}-${id}`}>
                  {card.src ? (
                    <img
                      width={100}
                      height={100}
                      src={card.src}
                      alt={card.title}
                      className="size-40 rounded-lg object-cover object-top md:size-14"
                    />
                  ) : (
                    <div className="flex size-40 items-center justify-center rounded-lg bg-primary/10 text-primary md:size-14">
                      {card.media}
                    </div>
                  )}
                </motion.div>
                <div className="flex min-w-0 flex-col gap-0.5 text-center md:text-left">
                  <motion.h3
                    layoutId={`title-${card.id}-${id}`}
                    className="text-base font-semibold leading-tight text-foreground"
                  >
                    {card.title}
                  </motion.h3>
                  <motion.p
                    layoutId={`description-${card.id}-${id}`}
                    className="text-sm leading-snug text-muted-foreground"
                  >
                    {card.description}
                  </motion.p>
                </div>
              </div>
              {onEnterClick ? (
                <button
                  type="button"
                  className="mt-4 shrink-0 text-sm font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80 md:mt-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onEnterClick(card);
                  }}
                >
                  打开
                </button>
              ) : (
                <motion.span
                  layoutId={`cta-${card.id}-${id}`}
                  className="mt-4 shrink-0 text-sm font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80 md:mt-0"
                >
                  {card.ctaText ?? '打开'}
                </motion.span>
              )}
            </motion.div>
            {card.separatorAfter && (
              <div
                className="my-3 border-t border-border"
                role="separator"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
