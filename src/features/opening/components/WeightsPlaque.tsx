'use client'

import { DIMENSION_LABELS, DIMENSIONS, type Dimension, type Weights } from '@/features/engine'
import { Button } from '@/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet'
import { cn } from '@/shared/lib/utils'

/** A weight of 0–3 as the bar's filled share. */
const BAR = ['w-0', 'w-1/3', 'w-2/3', 'w-full'] as const

/**
 * "Your weights" (frame p3fix-2, its top half): each dimension's weight, 0–3, with the rule that
 * set it. The design's "What if I were flexible on…" half is not part of this slice.
 */
export function WeightsPlaque({
  weights,
  reasons,
}: {
  weights: Weights
  reasons: Record<Dimension, string>
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Your weights
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto">
        <SheetHeader className="gap-2 space-y-0 text-left">
          <p className="m-0 text-overline uppercase text-muted-foreground">What you're weighing</p>
          <SheetTitle className="font-heading text-h2">Your weights</SheetTitle>
          <SheetDescription className="text-base">
            These shape what each future is drawn around. Nothing here says what to do.
          </SheetDescription>
        </SheetHeader>
        <section className="flex flex-col gap-3">
          <p className="m-0 text-overline uppercase text-muted-foreground">
            Weighing · from your opening taps
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {DIMENSIONS.map((dim) => (
              <li key={dim} className="grid grid-cols-2 items-center gap-3">
                <div className="flex flex-col">
                  <span className={cn('font-heading', weights[dim] === 3 ? 'text-h4' : '')}>
                    {DIMENSION_LABELS[dim]}
                  </span>
                  <span className="text-caption text-muted-foreground">{reasons[dim]}</span>
                </div>
                <span aria-hidden="true" className="h-2 border border-primary">
                  <span className={cn('block h-full bg-primary', BAR[weights[dim]])} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </SheetContent>
    </Sheet>
  )
}
