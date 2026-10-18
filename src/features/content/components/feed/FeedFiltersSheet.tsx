'use client'

import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet'
import type { Filters } from '../../lib/feed'
import { FeedFilters } from './FeedFilters'

/**
 * The feed's filters on a narrow screen (below 64rem): a Filters button in the feed's top bar that
 * opens them in a sheet from the left, so the posts keep the whole screen under the bar.
 */
export function FeedFiltersSheet({
  pathname,
  filters,
  updateCount,
}: {
  pathname: string
  filters: Filters
  updateCount: number
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="square" className="h-11 gap-2 px-3.5 font-sans font-medium">
          <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-sm flex-col gap-6 overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <SheetTitle className="text-h4">Filters</SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="outline" size="sm">
              Done
            </Button>
          </SheetClose>
        </div>
        <FeedFilters pathname={pathname} filters={filters} updateCount={updateCount} />
      </SheetContent>
    </Sheet>
  )
}
