'use client'

import { Layers } from 'lucide-react'
import { type MouseEvent, useEffect, useRef } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'
import styles from './sign-in.module.css'

const CELLS = [
  ['A1', styles.c1],
  ['B1', styles.c2],
  ['C1', styles.c3],
  ['D1', styles.c4],
] as const

const pad = (n: number) => String(Math.max(0, n)).padStart(4, '0')

/**
 * The sign-in page's left side: the brand mark, the headline and four blueprint cells on a dark
 * grid, with a scanline and a crosshair that follows the pointer and reads out its position. It is
 * where the splash lands (data-splash-target).
 *
 * As the artboard's stylesheet says: the layout follows the page's own width (the page is the
 * container); the cells hide on phones (below @xl, 36rem), and the crosshair hides on touch screens, which have no
 * pointer to follow. Its loops hold still while the tab is hidden.
 */
export function SignInPanel({
  productName,
  overline = 'Workspace access',
  lede,
}: {
  productName: string
  overline?: string
  lede: string
}) {
  // The crosshair never goes through React state: the pointer's latest position is kept, and one
  // animation frame writes it as --mx/--my on the section (the lines and the label move by
  // transform) and as the readout's text. The offsets are pointer coordinates, so px by nature.
  const section = useRef<HTMLElement>(null)
  const cross = useRef<HTMLDivElement>(null)
  const readout = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const frame = useRef(0)

  useEffect(() => {
    const onVisibility = () => section.current?.toggleAttribute('data-paused', document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(frame.current)
    }
  }, [])

  const draw = () => {
    frame.current = 0
    const el = section.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.round(pointer.current.x - r.left)
    const y = Math.round(pointer.current.y - r.top)
    el.style.setProperty('--mx', `${x}px`)
    el.style.setProperty('--my', `${y}px`)
    if (readout.current) readout.current.textContent = `X ${pad(x)} · Y ${pad(y)}`
    cross.current?.setAttribute('data-on', '')
  }

  const track = (e: MouseEvent<HTMLElement>) => {
    pointer.current = { x: e.clientX, y: e.clientY }
    if (!frame.current) frame.current = requestAnimationFrame(draw)
  }

  const untrack = () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    cross.current?.removeAttribute('data-on')
  }

  return (
    <section
      ref={section}
      aria-label="About"
      // Marked light: the hero keeps its look in a dark page (Industry's light tokens).
      data-theme="light"
      data-splash-target
      onMouseMove={track}
      onMouseLeave={untrack}
      className={cn(
        motion.grid,
        styles.paused,
        'split-panel relative flex flex-col justify-between gap-block overflow-hidden py-section text-panel-foreground @max-5xl:justify-start @max-5xl:pb-11 @max-xl:gap-6 @max-xl:px-5 @max-xl:pt-6 @max-xl:pb-8',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(styles.scanArea, 'pointer-events-none absolute inset-0')}
      >
        <div className={cn(styles.scanline, 'absolute inset-x-0 top-0 h-px')} />
      </div>

      <div
        ref={cross}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 data-on:visible no-hover:hidden"
      >
        <div className="absolute inset-y-0 left-0 w-px translate-x-(--mx) bg-panel-foreground/22" />
        <div className="absolute inset-x-0 top-0 h-px translate-y-(--my) bg-panel-foreground/22" />
        <div
          ref={readout}
          className="absolute top-0 left-0 translate-x-[calc(var(--mx)+0.625rem)] translate-y-[calc(var(--my)+0.5rem)] whitespace-nowrap text-micro text-panel-accent"
        >
          X 0000 · Y 0000
        </div>
      </div>

      <div className={cn(motion.rise, motion.d1, 'relative flex items-center gap-3')}>
        <Blueprint
          className={cn(
            styles.frame,
            styles.markFrame,
            motion.onPanel,
            'flex size-9 items-center justify-center',
          )}
        >
          <Layers aria-hidden="true" className="size-icon-md" />
        </Blueprint>
        <span className="font-heading text-xl font-semibold tracking-[-0.015em]">
          {productName}
        </span>
      </div>

      <div className="relative flex max-w-130 flex-col gap-stack @max-5xl:max-w-150 @max-xl:gap-4">
        <div
          className={cn(
            motion.rise,
            motion.d2,
            'text-overline tracking-widest uppercase text-panel-accent',
          )}
        >
          {overline}
          <span aria-hidden="true" className={cn(styles.cursor, 'ml-1')}>
            _
          </span>
        </div>
        {/* 48 to 56px from tablet to desktop; the design's compact layout drops to 38px. */}
        <h1 className="m-0 font-heading text-display font-semibold text-panel-foreground @max-xl:text-[2.375rem]">
          <span className={styles.line}>
            <span className={motion.d3}>Pick up where</span>
          </span>
          <span className={styles.line}>
            <span className={motion.d4}>you left off.</span>
          </span>
        </h1>
        <p
          className={cn(
            motion.rise,
            motion.d5,
            'm-0 text-lead text-panel-foreground dark:text-panel-foreground/78',
          )}
        >
          {lede}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="relative grid max-w-130 grid-cols-4 gap-5 @max-5xl:max-w-90 @max-5xl:gap-4 @max-xl:hidden"
      >
        {CELLS.map(([label, position]) => (
          <Blueprint
            key={label}
            className={cn(
              styles.cell,
              position,
              motion.onPanel,
              'aspect-square p-[0.425rem] text-micro text-panel-foreground/55',
            )}
          >
            {label}
          </Blueprint>
        ))}
      </div>
    </section>
  )
}
