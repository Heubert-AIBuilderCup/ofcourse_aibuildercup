'use client'

import { Lock } from 'lucide-react'
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'
import { columnHeadingId } from '../lib/board'
import type { ColumnId } from '../model/stages'

/** How long a column stays lit after a press on the band, as the design's board does. */
const LIT_MS = 1600

const Highlight = createContext<{
  highlighted: ColumnId | null
  highlight: (id: ColumnId) => void
  /** The one stage a phone shows. */
  picked: ColumnId
  pick: (id: ColumnId) => void
}>({ highlighted: null, highlight: () => {}, picked: 'structures', pick: () => {} })

/**
 * The column the band's numbers light up, and the one stage a phone shows: a press on the band
 * lights its column for a moment, picks it on a phone, and brings it into view (below @5xl the
 * columns stack, so it may be off screen). Around the band and the columns, which stay server
 * components inside it.
 */
export function BoardHighlight({ children }: { children: ReactNode }) {
  const [highlighted, setHighlighted] = useState<ColumnId | null>(null)
  const [picked, pick] = useState<ColumnId>('structures')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const highlight = (id: ColumnId) => {
    clearTimeout(timer.current)
    setHighlighted(id)
    pick(id)
    timer.current = setTimeout(() => setHighlighted(null), LIT_MS)
    document.getElementById(columnHeadingId(id))?.scrollIntoView({ block: 'nearest' })
  }

  return <Highlight value={{ highlighted, highlight, picked, pick }}>{children}</Highlight>
}

export const useBoardHighlight = () => useContext(Highlight)

/**
 * A column's section, named by its heading, marked `data-highlighted` while it is lit and
 * `data-picked` while it is the stage a phone shows; below @xl the others hide.
 */
export function StageColumn({
  id,
  className,
  children,
}: {
  id: ColumnId
  className?: string
  children: ReactNode
}) {
  const { highlighted, picked } = useBoardHighlight()
  return (
    <section
      aria-labelledby={columnHeadingId(id)}
      data-highlighted={highlighted === id ? '' : undefined}
      data-picked={picked === id ? '' : undefined}
      className={cn(className, picked !== id && '@max-xl:hidden')}
    >
      {children}
    </section>
  )
}

/**
 * A phone's stages (below @xl only): one button per stage with its number, name and count, the
 * pressed one filled, the render gate's lock tile between the first two. They wrap rather than
 * scroll, as the board never scrolls sideways.
 */
export function StageTabs({
  stages,
  gateAfter,
  gateWhy,
}: {
  stages: { id: ColumnId; label: string; count: number }[]
  gateAfter: ColumnId
  gateWhy: string
}) {
  const { picked, pick } = useBoardHighlight()
  return (
    <fieldset
      aria-label="Stages"
      className="m-0 hidden min-w-0 flex-wrap gap-1.5 border-0 p-0 @max-xl:flex"
    >
      {stages.map((s, i) => (
        <span key={s.id} className="contents">
          <button
            type="button"
            aria-pressed={picked === s.id}
            aria-label={`${s.label} · ${s.count}`}
            onClick={() => pick(s.id)}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 border px-3 font-heading font-semibold',
              picked === s.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-foreground/30 bg-transparent text-foreground',
            )}
          >
            <span className="text-caption opacity-65">{String(i + 1).padStart(2, '0')}</span>
            {s.label}
            <span className="border-l border-current pl-1.5 text-caption opacity-80">
              {s.count}
            </span>
          </button>
          {s.id === gateAfter && (
            <span
              title={gateWhy}
              data-theme="light"
              className={cn(
                motion.grid,
                'relative flex w-7 cursor-help items-center justify-center overflow-hidden text-panel-foreground',
              )}
            >
              <Lock aria-hidden="true" strokeWidth={1.5} className="relative size-icon-sm" />
            </span>
          )}
        </span>
      ))}
    </fieldset>
  )
}

/** The render gate between the columns: on a phone, shown only with the stage after it. */
export function PhoneGate({ after, children }: { after: ColumnId; children: ReactNode }) {
  const { picked } = useBoardHighlight()
  return <div className={cn('flex', picked !== after && '@max-xl:hidden')}>{children}</div>
}
