'use client'

import { type ReactNode, useId } from 'react'
import { cn } from '@/shared/lib/utils'

type FieldProps = {
  label: string
  hint?: string
  className?: string
  /** Render the control with the id the label points at. */
  children: (id: string) => ReactNode
}

/** A visible label above its control, linked by id, with an optional hint below. */
export function Field({ label, hint: help, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {help && <span className="text-sm text-muted-foreground">{help}</span>}
    </div>
  )
}
