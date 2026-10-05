import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

const MARKS = ['tl', 'tr', 'bl', 'br'] as const

/**
 * The four corner marks of a framed object. Place inside a positioned element (`relative`).
 * They show only when the active design system sets --ds-frame-marks (globals.css).
 */
export function FrameMarks() {
  return (
    <>
      {MARKS.map((m) => (
        <span key={m} data-frame-mark={m} aria-hidden="true" />
      ))}
    </>
  )
}

type BlueprintProps<T extends ElementType> = {
  /** The element to render; a div unless the frame is a section, form or figure. */
  as?: T
  children?: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

/**
 * A blueprint object: a square hairline frame with a "+" mark at each corner, the design
 * system's drawing of a card, figure, dialog or button. Transparent, so the ground shows through.
 * Pass `as` to frame a section or a form; the marks follow --ds-frame-marks, so under a design
 * system without them this is a plain bordered box.
 */
export function Blueprint<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: BlueprintProps<T>) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag className={cn('relative border', className)} {...props}>
      <FrameMarks />
      {children}
    </Tag>
  )
}
