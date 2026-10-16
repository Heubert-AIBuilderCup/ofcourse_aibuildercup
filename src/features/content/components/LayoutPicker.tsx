'use client'

import { useId } from 'react'
import { cn } from '@/shared/lib/utils'
import { LAYOUT_LABELS, type LayoutOption } from '../layout/relayout'
import type { LayoutId } from '../model/types'
import { reasonText } from './parts'

/** Each layout drawn as a few blocks, so the choice reads as a picture before its name. */
const SKETCH: Record<LayoutId, string[]> = {
  cover: ['h-1/2 w-full bg-muted', 'h-1 w-3/4 bg-foreground/40', 'h-1 w-1/2 bg-foreground/40'],
  picture: ['h-2/5 w-full bg-muted', 'h-1 w-full bg-foreground/40', 'h-1 w-2/3 bg-foreground/20'],
  number: ['h-1/3 w-2/3 bg-foreground/40', 'h-1 w-full bg-foreground/20'],
  bars: ['h-1.5 w-full bg-foreground/40', 'h-1.5 w-1/2 bg-foreground/40'],
  quote: [
    'h-1 w-1/4 bg-foreground/40',
    'h-1 w-full bg-foreground/20',
    'h-1 w-5/6 bg-foreground/20',
  ],
  checklist: [
    'h-1 w-full bg-foreground/20',
    'h-1 w-full bg-foreground/20',
    'h-1 w-full bg-foreground/20',
  ],
  bullets: [
    'h-1 w-2/3 bg-foreground/40',
    'ml-1 h-1 w-3/4 bg-foreground/20',
    'ml-1 h-1 w-3/4 bg-foreground/20',
    'ml-1 h-1 w-3/4 bg-foreground/20',
  ],
  takeaway: ['h-1/3 w-full bg-muted', 'h-1 w-2/3 bg-foreground/40'],
}

/**
 * A look slide's eight layouts as small labelled previews (GD5): the one it is in pressed, one its
 * content cannot fill disabled (layout/relayout.ts layoutOptions), any other laid out again on a
 * click, with no model call. The reasons are written once under the grid, one line for the
 * options that share one (C2), each disabled option described by its line.
 */
export function LayoutPicker(props: {
  slide: number
  options: LayoutOption[]
  current: LayoutId
  disabled: boolean
  onChoose: (layout: LayoutId) => void
}) {
  const ids = useId()
  // Each reason once, in the options' order, as the line that describes its options.
  const reasons = [
    ...new Set(props.options.flatMap((option) => (option.ok ? [] : [option.reason]))),
  ]
  const reasonId = (reason: string) => `${ids}-why-${reasons.indexOf(reason)}`
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-overline uppercase text-muted-foreground">
        {`Layout · Slide ${props.slide}`}
      </legend>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-2">
        {props.options.map((option) => {
          const current = option.id === props.current
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={current}
                aria-describedby={option.ok ? undefined : reasonId(option.reason)}
                disabled={props.disabled || !option.ok}
                onClick={() => {
                  if (option.ok && !current) props.onChoose(option.id)
                }}
                className={cn(
                  'flex w-full items-center gap-2 border p-1.5 text-left text-caption hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
                  current && 'border-primary',
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex aspect-4/5 w-6 shrink-0 flex-col justify-end gap-0.5 border p-0.5"
                >
                  {SKETCH[option.id].map((bar, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a sketch's bars never move.
                    <span key={i} className={cn('block', bar)} />
                  ))}
                </span>
                <span>{LAYOUT_LABELS[option.id]}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {reasons.map((reason) => (
        <p key={reason} id={reasonId(reason)} className={reasonText}>
          {reason}
        </p>
      ))}
    </fieldset>
  )
}
