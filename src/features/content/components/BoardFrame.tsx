'use client'

import { type ReactNode, useEffect, useRef } from 'react'

/**
 * The board's columns in one scroll area (17 Oct): from @5xl as tall as the viewport less what is
 * above it (the admin bar and nav, the board's title and filters, measured) and the page's bottom
 * padding, so the page itself does not scroll and the title and filters stay put; the columns
 * scroll inside it together, so their sticky headers stay aligned. Below @5xl the columns stack
 * and the page scrolls as before. As StepAreas sizes the workbench's frame.
 */
export function BoardFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = frame.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      const main = el.closest('main')
      const below = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0
      el.style.setProperty('--board-frame', `max(20rem, calc(100dvh - ${top}px - ${below}px))`)
    }
    fit()
    // What is above grows and shrinks (the filters wrap, a filter clears) as the window does.
    const watch = new ResizeObserver(fit)
    watch.observe(document.body)
    return () => watch.disconnect()
  }, [])
  return (
    <div ref={frame} className="min-w-0 @5xl:h-[var(--board-frame,100dvh)] @5xl:overflow-y-auto">
      {children}
    </div>
  )
}
