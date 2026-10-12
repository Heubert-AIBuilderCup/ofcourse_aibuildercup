'use client'

import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils'

/** The line above a step's heading: where she is, and after a dot, a quieter `detail`. */
export function StepKicker({
  detail,
  className,
  children,
}: {
  detail?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <p className={cn('m-0 text-overline uppercase text-accent-700', className)}>
      {children}
      {detail === undefined ? null : (
        <>
          {' · '}
          <b className="font-medium text-muted-foreground">{detail}</b>
        </>
      )}
    </p>
  )
}

/**
 * A step's heading. With `focusOnArrival` it takes focus once it opens, so a screen reader starts
 * there; a screen that moves focus itself passes its own `ref` and `tabIndex`.
 */
export function StepHeading({
  focusOnArrival = false,
  className,
  ref,
  ...props
}: ComponentProps<'h1'> & { focusOnArrival?: boolean }) {
  const own = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusOnArrival) own.current?.focus({ preventScroll: true })
  }, [focusOnArrival])

  return (
    <h1
      ref={focusOnArrival ? own : ref}
      tabIndex={focusOnArrival ? -1 : undefined}
      className={cn(
        'm-0 font-heading text-h1 font-semibold tracking-[-0.015em] outline-none',
        className,
      )}
      {...props}
    />
  )
}
