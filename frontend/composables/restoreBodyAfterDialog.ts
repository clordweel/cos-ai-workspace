/**
 * reka-ui Dialog/Sheet 打开时通过 useBodyScrollLock 给 body 设置
 * overflow: hidden、pointer-events: none 等，关闭后可能未正确移除。
 * 在弹窗关闭逻辑中调用本函数，在多个时机强制恢复 body 样式。
 */
export function restoreBodyStylesAfterDialog(): void {
  if (typeof document === 'undefined') return

  const restore = () => {
    const { body } = document
    body.style.pointerEvents = ''
    body.style.overflow = ''
    body.style.paddingRight = ''
    body.style.marginRight = ''
    document.documentElement.style.removeProperty('--scrollbar-width')
  }

  restore()
  queueMicrotask(restore)
  setTimeout(restore, 0)
  setTimeout(restore, 100)
  setTimeout(restore, 300)
}
