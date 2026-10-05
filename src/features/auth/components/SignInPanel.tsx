'use client'

import { Layers } from 'lucide-react'
import { type MouseEvent, useRef, useState } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
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
 * grid, with a scanline and a crosshair that follows the pointer and reads out its position.
 *
 * As the artboard's stylesheet says: the layout follows the page's own width (the page is the
 * container); the cells hide under 560px, and the crosshair hides on touch screens, which have no
 * pointer to follow.
 */
export function SignInPanel({ productName, lede }: { productName: string; lede: string }) {
  // Only shown/hidden is React state. The position changes at pointer-event rate, so it is written
  // straight to the DOM: --mx/--my on the section place the lines and the label, and the readout's
  // text is set through a ref. The offsets are pointer coordinates, so they are in px by nature.
  const [shown, setShown] = useState(false)
  const readout = useRef<HTMLDivElement>(null)

  const track = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(e.clientX - r.left)
    const y = Math.round(e.clientY - r.top)
    e.currentTarget.style.setProperty('--mx', `${x}px`)
    e.currentTarget.style.setProperty('--my', `${y}px`)
    if (readout.current) readout.current.textContent = `X ${pad(x)} · Y ${pad(y)}`
    if (!shown) setShown(true)
  }

  return (
    <section
      aria-label="About"
      onMouseMove={track}
      onMouseLeave={() => setShown(false)}
      className={cn(
        styles.grid,
        'relative flex flex-col justify-between gap-block overflow-hidden px-gutter py-section text-panel-foreground @max-[60rem]:justify-start @max-[60rem]:pb-11 @max-[35rem]:gap-6 @max-[35rem]:px-5 @max-[35rem]:pt-6 @max-[35rem]:pb-8',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(styles.scanline, 'pointer-events-none absolute inset-x-0 -top-[2%] h-px')}
      />

      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 no-hover:hidden', !shown && 'hidden')}
      >
        <div className="absolute inset-y-0 left-(--mx) w-px bg-panel-foreground/22" />
        <div className="absolute inset-x-0 top-(--my) h-px bg-panel-foreground/22" />
        <div
          ref={readout}
          className="absolute top-[calc(var(--my)+0.5rem)] left-[calc(var(--mx)+0.625rem)] whitespace-nowrap text-micro text-panel-accent"
        >
          X 0000 · Y 0000
        </div>
      </div>

      <div className={cn(styles.rise, styles.d1, 'relative flex items-center gap-3')}>
        <Blueprint
          className={cn(
            styles.frame,
            styles.d1,
            styles.onPanel,
            'flex size-9 items-center justify-center',
          )}
        >
          <Layers aria-hidden="true" className="size-4.5" />
        </Blueprint>
        <span className="font-heading text-xl font-semibold tracking-[-0.015em]">
          {productName}
        </span>
      </div>

      <div className="relative flex max-w-130 flex-col gap-stack @max-[60rem]:max-w-150 @max-[35rem]:gap-4">
        <div
          className={cn(
            styles.rise,
            styles.d2,
            'text-overline tracking-widest uppercase text-panel-accent',
          )}
        >
          Workspace access
          <span aria-hidden="true" className={cn(styles.cursor, 'ml-1')}>
            _
          </span>
        </div>
        {/* 48 to 56px from tablet to desktop; the design's compact layout drops to 38px. */}
        <h1 className="m-0 font-heading text-display font-semibold text-panel-foreground @max-[35rem]:text-[2.375rem]">
          <span className={styles.line}>
            <span className={styles.d3}>Pick up where</span>
          </span>
          <span className={styles.line}>
            <span className={styles.d4}>you left off.</span>
          </span>
        </h1>
        <p className={cn(styles.rise, styles.d5, 'm-0 text-lead text-panel-foreground/80')}>
          {lede}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="relative grid max-w-130 grid-cols-4 gap-5 @max-[60rem]:max-w-90 @max-[60rem]:gap-4 @max-[35rem]:hidden"
      >
        {CELLS.map(([label, position]) => (
          <Blueprint
            key={label}
            className={cn(
              styles.cell,
              position,
              styles.onPanel,
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
