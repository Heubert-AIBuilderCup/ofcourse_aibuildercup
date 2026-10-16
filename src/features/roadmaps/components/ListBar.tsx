'use client'

import { LayoutGrid, TextAlignJustify } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import type { ListView } from '../hooks/useListView'
import { type RoadmapOrder, SORTS } from '../model/roadmap'

const SEG =
  'h-11 rounded-none border-0 px-4 font-sans text-base font-medium aria-pressed:bg-brand aria-pressed:text-brand-foreground aria-pressed:hover:bg-brand-hover focus-visible:ring-inset focus-visible:ring-offset-0'

/**
 * The bar under the title: "Sort" (last opened, date made, name; never "best") and "Show as"
 * Cards or Table, a pair of pressed buttons. On a phone the word "Sort" is read, not shown.
 */
export function ListBar({
  sort,
  onSort,
  view,
  onView,
}: {
  sort: RoadmapOrder
  onSort: (by: RoadmapOrder) => void
  view: ListView
  onView: (view: ListView) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <div className="flex items-center gap-2.5">
        <span
          id={`${id}-sort`}
          className="font-heading text-overline font-medium text-muted-foreground uppercase @max-xl:sr-only"
        >
          Sort
        </span>
        <Select value={sort} onValueChange={(value) => onSort(value as RoadmapOrder)}>
          <SelectTrigger
            aria-labelledby={`${id}-sort`}
            className="h-11 w-auto min-w-40 gap-3 text-base"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map(([by, label]) => (
              <SelectItem key={by} value={by} className="text-base">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset
        aria-label="Show as"
        className="m-0 inline-flex min-w-0 border border-foreground/30 p-0"
      >
        <Button
          type="button"
          variant="square"
          aria-pressed={view === 'cards'}
          onClick={() => onView('cards')}
          className={SEG}
        >
          <LayoutGrid aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Cards
        </Button>
        <Button
          type="button"
          variant="square"
          aria-pressed={view === 'table'}
          onClick={() => onView('table')}
          className={cn(SEG, 'border-l border-foreground/30')}
        >
          <TextAlignJustify aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Table
        </Button>
      </fieldset>
    </div>
  )
}
