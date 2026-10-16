'use client'

import { type ReactNode, useRef } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet'

/**
 * The phone's sheet (the reference's rb-sheet): the shared shadcn Sheet from the bottom, so it
 * slides up and away, dims the board, keeps focus inside, closes on Escape and the overlay, and
 * gives focus back. It stays mounted and opens by `open`; while it slides away it keeps what it
 * last showed. `label` names it; the content brings its own Close.
 */
export function BottomSheet({
  open,
  label,
  onClose,
  children,
}: {
  open: boolean
  /** The dialog's name. */
  label: string
  onClose: () => void
  children?: ReactNode
}) {
  const shown = useRef({ label, children })
  if (open) shown.current = { label, children }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-4/5 flex-col gap-4 overflow-auto px-4 pt-3 pb-5 text-foreground"
      >
        <span aria-hidden="true" className="h-1 w-10 shrink-0 self-center bg-neutral-400" />
        <SheetTitle className="sr-only">{shown.current.label}</SheetTitle>
        {shown.current.children}
      </SheetContent>
    </Sheet>
  )
}
