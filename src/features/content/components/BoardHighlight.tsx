'use client'

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { columnHeadingId } from '../lib/board'
import type { ColumnId } from '../model/stages'

/** How long a column stays lit after a press on the band, as the design's board does. */
const LIT_MS = 1600

const Highlight = createContext<{
  highlighted: ColumnId | null
  highlight: (id: ColumnId) => void
}>({ highlighted: null, highlight: () => {} })

/**
 * The column the band's numbers light up: a press lights it for a moment and brings it into view
 * (below @5xl the columns stack, so it may be off screen). Around the band and the columns, which
 * stay server components inside it.
 */
export function BoardHighlight({ children }: { children: ReactNode }) {
  const [highlighted, setHighlighted] = useState<ColumnId | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const highlight = (id: ColumnId) => {
    clearTimeout(timer.current)
    setHighlighted(id)
    timer.current = setTimeout(() => setHighlighted(null), LIT_MS)
    document.getElementById(columnHeadingId(id))?.scrollIntoView({ block: 'nearest' })
  }

  return <Highlight value={{ highlighted, highlight }}>{children}</Highlight>
}

export const useBoardHighlight = () => useContext(Highlight)

/** A column's section, named by its heading and marked `data-highlighted` while it is lit. */
export function StageColumn({
  id,
  className,
  children,
}: {
  id: ColumnId
  className?: string
  children: ReactNode
}) {
  const { highlighted } = useBoardHighlight()
  return (
    <section
      aria-labelledby={columnHeadingId(id)}
      data-highlighted={highlighted === id ? '' : undefined}
      className={className}
    >
      {children}
    </section>
  )
}
