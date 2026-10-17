'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet'
import { ROADMAPS_PATH, roadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'

/** A roadmap the drawer offers: its id and its name as her list names it. */
export type RoadmapLink = { id: string; name: string }

/**
 * Another of her roadmaps without going back to the list: the open one's name (below 64rem,
 * "Switch") opens a drawer from the left with each of her roadmaps, last opened first, the open
 * one marked, then All roadmaps. Choosing one closes the drawer.
 */
export function RoadmapDrawer({
  name,
  openId,
  roadmaps,
}: {
  name: string
  openId: string
  roadmaps: RoadmapLink[]
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="text"
          aria-label={`Switch roadmap · ${name}`}
          className="min-w-0 gap-1 px-2 font-heading text-lead font-semibold"
        >
          <span className="truncate @max-5xl:hidden">{name}</span>
          <span className="hidden font-sans text-base font-medium @max-5xl:inline">Switch</span>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" aria-describedby={undefined} className="flex flex-col gap-4">
        <SheetTitle className="text-h3">Your roadmaps</SheetTitle>
        <ul className="m-0 flex list-none flex-col p-0">
          {roadmaps.map((r) => (
            <li key={r.id} className="border-t">
              <SheetClose asChild>
                <Link
                  href={roadmapPath(r.id)}
                  aria-current={r.id === openId ? 'page' : undefined}
                  className="block border-l-4 border-transparent px-3 py-3.5 font-heading text-lead font-semibold hover:bg-muted aria-[current=page]:border-brand aria-[current=page]:bg-muted"
                >
                  {r.name}
                </Link>
              </SheetClose>
            </li>
          ))}
        </ul>
        <SheetClose asChild>
          <Link
            href={ROADMAPS_PATH}
            className={cn(buttonVariants({ variant: 'outline' }), 'self-start')}
          >
            All roadmaps
          </Link>
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}
